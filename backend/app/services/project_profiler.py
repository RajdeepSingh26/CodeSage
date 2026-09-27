import os
import re
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

class SelectedFileInfo(BaseModel):
    file_path: str
    language: str
    role: str
    size_bytes: int
    line_count: int

class ProjectProfile(BaseModel):
    primary_language: str
    detected_languages: List[str]
    detected_frameworks: List[str]
    detected_stack: List[str]
    architecture_summary: str
    key_directories: List[str]

EXTENSION_LANGUAGE_MAP = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".php": "php",
    ".rb": "ruby",
    ".sql": "sql",
    ".sh": "shell"
}

FRAMEWORK_SIGNATURES = {
    # Python
    "fastapi": ("FastAPI", "Python"),
    "flask": ("Flask", "Python"),
    "django": ("Django", "Python"),
    "sqlalchemy": ("SQLAlchemy", "Python"),
    "pydantic": ("Pydantic", "Python"),
    "pytest": ("PyTest", "Python"),
    "langchain": ("LangChain", "Python"),
    "langgraph": ("LangGraph", "Python"),
    # JS/TS
    "react": ("React", "TypeScript/JavaScript"),
    "next": ("Next.js", "TypeScript/JavaScript"),
    "express": ("Express", "Node.js"),
    "nestjs": ("NestJS", "Node.js"),
    "vue": ("Vue", "JavaScript"),
    "vite": ("Vite", "JavaScript"),
    "tailwindcss": ("TailwindCSS", "CSS"),
    # Java
    "spring-boot": ("Spring Boot", "Java"),
    "quarkus": ("Quarkus", "Java"),
    "hibernate": ("Hibernate", "Java"),
    # Go
    "gin-gonic": ("Gin", "Go"),
    "fiber": ("Fiber", "Go"),
    # Rust
    "actix-web": ("Actix Web", "Rust"),
    "axum": ("Axum", "Rust"),
    "tokio": ("Tokio", "Rust")
}


def detect_file_language(file_path: str) -> str:
    """Infers programming language from file extension."""
    _, ext = os.path.splitext(file_path.lower())
    return EXTENSION_LANGUAGE_MAP.get(ext, "plaintext")


def profile_repository(files_map: Dict[str, str]) -> ProjectProfile:
    """
    Deterministic repository profiling without invoking an LLM.
    Identifies languages, frameworks, manifests, and architectural patterns.
    """
    lang_counts: Dict[str, int] = {}
    frameworks: set = set()
    dir_counts: Dict[str, int] = {}

    for path in files_map.keys():
        norm_path = path.replace("\\", "/")
        parts = norm_path.split("/")
        if len(parts) > 1:
            top_dir = parts[0]
            dir_counts[top_dir] = dir_counts.get(top_dir, 0) + 1

        lang = detect_file_language(path)
        if lang != "plaintext":
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

    # Inspect package manifests for framework signatures
    manifest_files = [
        "package.json", "requirements.txt", "pyproject.toml",
        "pom.xml", "build.gradle", "go.mod", "Cargo.toml", "Pipfile"
    ]

    for mfile in manifest_files:
        for path, content in files_map.items():
            if path.endswith(mfile):
                content_lower = content.lower()
                for key, (fw_name, _) in FRAMEWORK_SIGNATURES.items():
                    if key in content_lower:
                        frameworks.add(fw_name)

    # Determine primary language
    sorted_langs = sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
    primary_lang = sorted_langs[0][0] if sorted_langs else "plaintext"
    all_langs = [l[0] for l in sorted_langs[:4]]

    detected_stack = list(frameworks)
    for l in all_langs:
        cap_lang = l.capitalize()
        if cap_lang not in detected_stack:
            detected_stack.append(cap_lang)

    key_dirs = sorted(dir_counts.keys())[:5]

    # Generate architecture summary string
    arch_type = "Modular Single-Repo"
    if "backend" in key_dirs and "frontend" in key_dirs:
        arch_type = "Fullstack Separated (Frontend + Backend)"
    elif any("api" in d or "routes" in d for d in key_dirs):
        arch_type = "API / Web Service"
    elif any("service" in d or "repo" in d for d in key_dirs):
        arch_type = "Layered Architecture (Services & Data Access)"

    framework_str = ", ".join(frameworks) if frameworks else "Standard Library"
    lang_str = ", ".join(all_langs) if all_langs else primary_lang
    arch_summary = (
        f"Project Type: {arch_type}. Primary Stack: {framework_str} ({lang_str}). "
        f"Key modules identified: {', '.join(key_dirs) if key_dirs else 'root structure'}."
    )

    return ProjectProfile(
        primary_language=primary_lang,
        detected_languages=all_langs,
        detected_frameworks=list(frameworks),
        detected_stack=detected_stack,
        architecture_summary=arch_summary,
        key_directories=key_dirs
    )


def categorize_file_role(path: str) -> str:
    """Heuristically tags a source file with its architectural role."""
    p = path.lower().replace("\\", "/")
    base = os.path.basename(p)

    if base in {"main.py", "app.py", "server.py", "server.ts", "server.js", "index.ts", "main.go"}:
        return "Application Entrypoint"
    if any(k in p for k in {"route", "controller", "endpoint", "api/"}):
        return "API Router / Controller"
    if any(k in p for k in {"auth", "security", "jwt", "login", "permission"}):
        return "Auth & Security Guard"
    if any(k in p for k in {"service", "handler", "manager", "business"}):
        return "Service & Business Logic"
    if any(k in p for k in {"repo", "repository", "db", "database", "crud"}):
        return "Repository & Data Access"
    if any(k in p for k in {"model", "schema", "entity", "dto"}):
        return "Data Model & Schema"
    if any(k in p for k in {"component", "view", "page", "layout"}):
        return "Frontend Component"
    if any(k in p for k in {"util", "helper", "common"}):
        return "Utility / Helper"
    return "Source Module"


def calculate_file_importance(path: str, content: str) -> int:
    """Calculates deterministic architectural importance score for a source file."""
    p = path.lower().replace("\\", "/")
    base = os.path.basename(p)
    _, ext = os.path.splitext(base)

    # Ignore manifest/config files from direct code review (profiler already parsed them)
    if base in {"setup.py", "vite.config.js", "vite.config.ts", "tailwind.config.js", "webpack.config.js"}:
        return -50
    if "test" in p or "spec" in p:
        return -20
    if ext not in EXTENSION_LANGUAGE_MAP:
        return -100

    score = 0
    # Entrypoints have highest priority
    if base in {"main.py", "app.py", "server.ts", "server.js", "server.py", "index.ts", "main.go"}:
        score += 100
    elif any(k in p for k in {"route", "controller", "endpoint", "api/"}):
        score += 85
    elif any(k in p for k in {"auth", "security", "jwt"}):
        score += 80
    elif any(k in p for k in {"service", "manager", "handler"}):
        score += 75
    elif any(k in p for k in {"repo", "repository", "db", "crud"}):
        score += 70
    elif any(k in p for k in {"model", "schema", "entity"}):
        score += 60
    elif any(k in p for k in {"component", "view", "page"}):
        score += 50
    else:
        score += 30

    # Content hints
    content_lower = content[:1500].lower()
    if "class " in content_lower:
        score += 5
    if "def " in content_lower or "function " in content_lower or "=>" in content_lower:
        score += 5
    if "router" in content_lower or "route" in content_lower or "endpoint" in content_lower:
        score += 10
    if "repository" in content_lower or "select " in content_lower or "execute(" in content_lower:
        score += 10

    return score


def prioritize_source_files(files_map: Dict[str, str], max_files: int = 5) -> List[SelectedFileInfo]:
    """
    Selects up to `max_files` (default 5) key source files using deterministic heuristics.
    Ensures architectural layer diversity (e.g. entrypoint, router, service, repository, model).
    """
    candidates = []

    for path, content in files_map.items():
        score = calculate_file_importance(path, content)
        if score > 0:
            lang = detect_file_language(path)
            role = categorize_file_role(path)
            lines = content.count("\n") + 1
            size = len(content.encode("utf-8"))
            candidates.append({
                "path": path,
                "score": score,
                "role": role,
                "lang": lang,
                "lines": lines,
                "size": size,
                "dir": os.path.dirname(path)
            })

    # Sort descending by score
    candidates.sort(key=lambda x: x["score"], reverse=True)

    selected: List[Dict[str, Any]] = []
    used_roles = set()
    used_dirs: Dict[str, int] = {}

    # Pass 1: Select files prioritizing diverse roles & directories
    for c in candidates:
        if len(selected) >= max_files:
            break
        directory = c["dir"]
        role = c["role"]

        # Limit max 2 files from the exact same directory in pass 1
        if used_dirs.get(directory, 0) < 2 or role not in used_roles:
            selected.append(c)
            used_roles.add(role)
            used_dirs[directory] = used_dirs.get(directory, 0) + 1

    # Pass 2: Fill up to max_files if still under limit
    if len(selected) < max_files:
        for c in candidates:
            if len(selected) >= max_files:
                break
            if c not in selected:
                selected.append(c)

    # Convert to SelectedFileInfo models
    result = [
        SelectedFileInfo(
            file_path=item["path"],
            language=item["lang"],
            role=item["role"],
            size_bytes=item["size"],
            line_count=item["lines"]
        )
        for item in selected[:max_files]
    ]

    return result
