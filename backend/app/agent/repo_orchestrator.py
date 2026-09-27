import time
import logging
from typing import Optional, List, Dict, Any

from app.config import settings
from app.schemas import (
    RepoReviewResponse,
    ProjectProfileInfo,
    RepoSelectedFileInfo,
    ReviewFinding,
    ProposedFix,
    TimelineStep
)
from app.services.github_service import fetch_repository_files
from app.services.project_profiler import profile_repository, prioritize_source_files
from app.services.hindsight_service import hindsight_service
from app.agent.graph import run_engram_pipeline

logger = logging.getLogger("engram.repo_orchestrator")


def run_repository_review(
    repo_url: str,
    branch: Optional[str] = "main",
    bank_id: Optional[str] = None,
    bypass_memory: bool = False
) -> RepoReviewResponse:
    """
    Executes a bounded, multi-agent GitHub repository review.
    1. Downloads & safely extracts public repository tarball.
    2. Filters noise, binaries, and secrets.
    3. Profiles architecture, language, and frameworks.
    4. Selects top 5 architectural files using deterministic heuristics.
    5. Recalls persistent team conventions from Hindsight Cloud.
    6. Runs each file through the existing LangGraph pipeline.
    7. Synthesizes repository-level findings, diffs, and executive summary.
    """
    start_total_time = time.perf_counter()
    target_bank = bank_id or settings.HINDSIGHT_BANK_ID
    timeline: List[TimelineStep] = []

    # ---------------------------------------------------------
    # Step 1: Ingestion & Safe Extraction
    # ---------------------------------------------------------
    t0 = time.perf_counter()
    owner, repo, resolved_branch, files_map = fetch_repository_files(repo_url, branch)
    ingest_ms = int((time.perf_counter() - t0) * 1000)

    timeline.append(TimelineStep(
        step_id="step-repo-fetch",
        node_name="repo_fetch_agent",
        title="Repository Ingestion & Safe Extraction",
        description=f"Fetched {owner}/{repo} ({resolved_branch}). Extracted {len(files_map)} clean source files after security filtering.",
        status="completed",
        duration_ms=ingest_ms,
        details={
            "owner": owner,
            "repo": repo,
            "branch": resolved_branch,
            "total_files_extracted": len(files_map)
        }
    ))

    # ---------------------------------------------------------
    # Step 2: Project Profiling
    # ---------------------------------------------------------
    t1 = time.perf_counter()
    profile = profile_repository(files_map)
    profile_ms = int((time.perf_counter() - t1) * 1000)

    timeline.append(TimelineStep(
        step_id="step-repo-profile",
        node_name="project_profiler",
        title="Project Topology & Framework Profiling",
        description=profile.architecture_summary,
        status="completed",
        duration_ms=profile_ms,
        details={
            "primary_language": profile.primary_language,
            "detected_stack": profile.detected_stack,
            "key_directories": profile.key_directories
        }
    ))

    # ---------------------------------------------------------
    # Step 3: Deterministic File Prioritization (Max 5 files)
    # ---------------------------------------------------------
    t2 = time.perf_counter()
    selected_files = prioritize_source_files(files_map, max_files=5)
    prioritize_ms = int((time.perf_counter() - t2) * 1000)

    timeline.append(TimelineStep(
        step_id="step-repo-prioritize",
        node_name="file_prioritizer",
        title="Architectural File Prioritization",
        description=f"Selected top {len(selected_files)} core source files representing key architectural layers.",
        status="completed",
        duration_ms=prioritize_ms,
        details={
            "selected_files": [f.file_path for f in selected_files],
            "roles": [f"{f.file_path} ({f.role})" for f in selected_files]
        }
    ))

    # ---------------------------------------------------------
    # Step 4: Hindsight Team Memory Recall
    # ---------------------------------------------------------
    t3 = time.perf_counter()
    recalled_memories: List[str] = []
    if not bypass_memory:
        frameworks_str = ", ".join(profile.detected_frameworks) if profile.detected_frameworks else profile.primary_language
        query = (
            f"Code review conventions, architectural rules, and engineering decisions for "
            f"{profile.primary_language} with {frameworks_str}. Architecture: {profile.architecture_summary}"
        )
        try:
            recalled_memories = hindsight_service.recall_memories(query=query, bank_id=target_bank)
            logger.info(f"Recalled {len(recalled_memories)} team memories for repository {owner}/{repo}")
        except Exception as e:
            logger.warning(f"Error querying Hindsight memories for repo: {e}")
            recalled_memories = []

    recall_ms = int((time.perf_counter() - t3) * 1000)
    timeline.append(TimelineStep(
        step_id="step-repo-recall",
        node_name="recall_node",
        title="Team Memory Consultation (Hindsight Cloud)",
        description=(
            f"Retrieved {len(recalled_memories)} team conventions from Hindsight memory bank '{target_bank}'"
            if not bypass_memory else "Bypassed Hindsight memory (Baseline Mode)"
        ),
        status="completed",
        duration_ms=recall_ms,
        details={
            "bank_id": target_bank,
            "memories_count": len(recalled_memories),
            "memories": recalled_memories
        }
    ))

    # ---------------------------------------------------------
    # Step 5: Multi-File Pipeline Execution
    # ---------------------------------------------------------
    all_findings: List[ReviewFinding] = []
    proposed_fixes: List[ProposedFix] = []
    finding_counter = 1

    for file_info in selected_files:
        file_path = file_info.file_path
        code_content = files_map.get(file_path, "")
        if not code_content.strip():
            continue

        # Truncate content intelligently if huge, preserving top 300 lines
        lines = code_content.splitlines()
        if len(lines) > 300:
            truncated_code = "\n".join(lines[:300]) + f"\n\n# ... [Truncated: remaining {len(lines) - 300} lines omitted for context efficiency] ..."
        else:
            truncated_code = code_content

        logger.info(f"Executing LangGraph pipeline on repository file: {file_path} ({file_info.role})")
        t_file = time.perf_counter()

        # Run file through the existing LangGraph pipeline
        file_res = run_engram_pipeline(
            code=truncated_code,
            file_name=file_path,
            language=file_info.language,
            bank_id=target_bank,
            bypass_memory=bypass_memory
        )
        file_ms = int((time.perf_counter() - t_file) * 1000)

        # Append findings with file path prefix for clarity
        for f in file_res.findings:
            if f.id == "finding-err":
                continue
            all_findings.append(ReviewFinding(
                id=f"repo-finding-{finding_counter}",
                severity=f.severity,
                category=f.category,
                title=f"{f.title} ({file_path})",
                description=f"[{file_path}] {f.description}",
                suggestion=f.suggestion,
                memory_used=f.memory_used,
                memory_citation=f.memory_citation
            ))
            finding_counter += 1

        # Collect proposed fix if one was generated
        if file_res.proposed_fix and file_res.proposed_fix.diff:
            fix = file_res.proposed_fix
            fix.file_name = file_path
            proposed_fixes.append(fix)

        timeline.append(TimelineStep(
            step_id=f"step-file-{finding_counter}",
            node_name="agentic_file_pipeline",
            title=f"Analyzed {file_path}",
            description=f"Role: {file_info.role}. Discovered {len(file_res.findings)} issues with AST validation.",
            status="completed",
            duration_ms=file_ms,
            details={
                "file_path": file_path,
                "role": file_info.role,
                "language": file_info.language,
                "findings": len(file_res.findings),
                "fix_generated": bool(file_res.proposed_fix and file_res.proposed_fix.diff)
            }
        ))

    # ---------------------------------------------------------
    # Step 6: Repository-Level Synthesis
    # ---------------------------------------------------------
    t_synth = time.perf_counter()
    high_count = sum(1 for f in all_findings if f.severity == "high")
    med_count = sum(1 for f in all_findings if f.severity == "medium")
    sec_count = sum(1 for f in all_findings if f.category == "security")
    mem_count = sum(1 for f in all_findings if f.memory_used)

    mode = "memory_informed" if mem_count > 0 or len(recalled_memories) > 0 else "baseline_no_memory"

    summary = (
        f"Repository Review for {owner}/{repo} ({resolved_branch}) completed. "
        f"Analyzed {len(selected_files)} core architectural files across {profile.primary_language.capitalize()}. "
        f"Identified {len(all_findings)} findings ({high_count} High, {med_count} Medium, {sec_count} Security). "
    )
    if mem_count > 0:
        summary += f"Directly enforced {mem_count} team convention(s) recalled from persistent Hindsight memory."
    else:
        summary += "Baseline engineering standards applied."

    synth_ms = int((time.perf_counter() - t_synth) * 1000)
    timeline.append(TimelineStep(
        step_id="step-repo-synthesis",
        node_name="final_review_node",
        title="Repository Review Synthesis & Packaging",
        description=f"Assembled final report with {len(all_findings)} issues and {len(proposed_fixes)} verified diffs.",
        status="completed",
        duration_ms=synth_ms,
        details={
            "total_findings": len(all_findings),
            "high_severity": high_count,
            "medium_severity": med_count,
            "security_findings": sec_count,
            "hindsight_citations": mem_count,
            "proposed_diffs": len(proposed_fixes)
        }
    ))

    # Format selected files list
    selected_files_models = [
        RepoSelectedFileInfo(
            file_path=f.file_path,
            language=f.language,
            role=f.role,
            size_bytes=f.size_bytes,
            line_count=f.line_count
        )
        for f in selected_files
    ]

    project_profile_info = ProjectProfileInfo(
        primary_language=profile.primary_language,
        detected_stack=profile.detected_stack,
        architecture_summary=profile.architecture_summary,
        key_directories=profile.key_directories
    )

    return RepoReviewResponse(
        repository=f"{owner}/{repo}",
        owner=owner,
        repo_name=repo,
        branch=resolved_branch,
        project_profile=project_profile_info,
        files_reviewed=selected_files_models,
        findings=all_findings,
        proposed_fixes=proposed_fixes,
        memories_retrieved=recalled_memories,
        review_mode=mode,
        bank_id=target_bank,
        summary=summary,
        timeline=timeline,
        total_files_discovered=len(files_map),
        pipeline_status="completed"
    )
