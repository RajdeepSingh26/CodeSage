import io
import re
import os
import tarfile
import logging
from typing import Dict, Tuple, Optional, List
import httpx

logger = logging.getLogger("engram.github")

# Directories to exclude from repository scanning
EXCLUDED_DIR_NAMES = {
    ".git", "node_modules", "vendor", "dist", "build", ".next",
    "coverage", ".cache", "__pycache__", "target", "bin", "obj",
    ".venv", "venv", ".idea", ".vscode", ".tox", ".eggs", "eggs"
}

# Binary/Media/Static extensions to exclude
EXCLUDED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
    ".mp4", ".mov", ".mp3", ".wav", ".zip", ".gz", ".tar",
    ".pdf", ".exe", ".dll", ".so", ".dylib", ".class", ".pyc",
    ".woff", ".woff2", ".ttf", ".eot", ".jar", ".war", ".min.js",
    ".min.css", ".map"
}

# Lockfiles to exclude from code review
EXCLUDED_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "cargo.lock", "poetry.lock", "composer.lock", "gemfile.lock"
}

# Secret / credential file patterns to exclude entirely
SECRET_FILE_PATTERNS = [
    re.compile(r"^\.env(\..+)?$", re.IGNORECASE),
    re.compile(r"^id_rsa(\..+)?$", re.IGNORECASE),
    re.compile(r"^.*\.(pem|key|pfx|pkcs12)$", re.IGNORECASE),
    re.compile(r"^.*(credentials|secrets|passwords).*\.(json|yaml|yml|txt|env)$", re.IGNORECASE)
]

# In-content secret patterns to redact before LLM consumption
SECRET_PATTERNS = [
    (re.compile(r"(?i)(api[_-]?key|secret|password|token|auth)\s*[:=]\s*['\"][A-Za-z0-9_\-\.]{8,}['\"]"), r"\1 = '[REDACTED_SECRET]'"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
    (re.compile(r"ghp_[A-Za-z0-9_]{36}"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    (re.compile(r"eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+"), "[REDACTED_JWT_TOKEN]")
]

MAX_FILE_SIZE_BYTES = 100 * 1024  # 100 KB limit per file


def parse_github_url(url: str, explicit_branch: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Parses a GitHub URL into (owner, repo, branch).
    Supports:
      - https://github.com/owner/repo
      - https://github.com/owner/repo.git
      - https://github.com/owner/repo/tree/branch-name
      - owner/repo
    """
    cleaned = url.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    cleaned = cleaned.rstrip("/")

    branch = explicit_branch or "main"

    # Match https://github.com/owner/repo/tree/branch_name
    tree_match = re.search(r"github\.com/([^/]+)/([^/]+)/tree/(.+)$", cleaned)
    if tree_match:
        owner = tree_match.group(1)
        repo = tree_match.group(2)
        branch = explicit_branch or tree_match.group(3)
        return owner, repo, branch

    # Match https://github.com/owner/repo
    http_match = re.search(r"github\.com/([^/]+)/([^/]+)$", cleaned)
    if http_match:
        return http_match.group(1), http_match.group(2), branch

    # Match owner/repo
    shorthand_match = re.match(r"^([^/]+)/([^/]+)$", cleaned)
    if shorthand_match:
        return shorthand_match.group(1), shorthand_match.group(2), branch

    raise ValueError(f"Invalid GitHub repository URL: '{url}'. Expected format: 'https://github.com/owner/repo' or 'owner/repo'.")


def is_safe_path(base_dir: str, path: str) -> bool:
    """Verifies that an extracted path does not escape the destination directory (anti-Zip Slip)."""
    matchpath = os.path.abspath(os.path.join(base_dir, path))
    basepath = os.path.abspath(base_dir)
    return matchpath.startswith(basepath + os.sep) or matchpath == basepath


def is_excluded_path(rel_path: str) -> bool:
    """Checks whether a relative path inside the repository should be ignored."""
    parts = rel_path.replace("\\", "/").split("/")
    filename = parts[-1].lower()

    # Check directory components
    for part in parts[:-1]:
        if part in EXCLUDED_DIR_NAMES or part.startswith("."):
            return True

    # Check filenames
    if filename in EXCLUDED_FILENAMES:
        return True

    # Check secret filename patterns
    for pat in SECRET_FILE_PATTERNS:
        if pat.match(filename):
            return True

    # Check file extension
    _, ext = os.path.splitext(filename)
    if ext in EXCLUDED_EXTENSIONS:
        return True

    return False


def redact_secrets(content: str) -> str:
    """Redacts common secret and credential signatures from source code text."""
    redacted = content
    for pattern, replacement in SECRET_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


def download_github_tarball(owner: str, repo: str, branch: str = "main") -> bytes:
    """
    Downloads the repository tarball from GitHub codeload endpoint.
    Attempts primary branch, falls back between 'main' and 'master' if needed.
    """
    branches_to_try = [branch]
    if branch == "main":
        branches_to_try.append("master")
    elif branch == "master":
        branches_to_try.append("main")

    last_error = None
    with httpx.Client(follow_redirects=True, timeout=35.0) as client:
        for b in branches_to_try:
            url = f"https://codeload.github.com/{owner}/{repo}/tar.gz/refs/heads/{b}"
            logger.info(f"Fetching GitHub archive: {url}")
            try:
                resp = client.get(url, headers={"User-Agent": "Engram-Agent/1.0"})
                if resp.status_code == 200:
                    return resp.content
                elif resp.status_code == 404:
                    last_error = f"Branch '{b}' not found for repository '{owner}/{repo}' (HTTP 404)"
                    continue
                else:
                    last_error = f"GitHub returned status {resp.status_code}: {resp.text[:200]}"
            except Exception as e:
                last_error = f"Network error downloading repository: {str(e)}"

    raise ValueError(f"Failed to fetch repository '{owner}/{repo}'. {last_error or 'Please check URL and branch.'}")


def extract_repo_files(tar_bytes: bytes) -> Dict[str, str]:
    """
    Safely extracts text source files from a repository tarball in-memory.
    Returns: Dict[relative_file_path, file_content_text]
    """
    files_map: Dict[str, str] = {}
    tar_stream = io.BytesIO(tar_bytes)

    with tarfile.open(fileobj=tar_stream, mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue

            # Check safe path against Zip Slip
            norm_name = os.path.normpath(member.name)
            if ".." in norm_name or norm_name.startswith(("/", "\\")):
                logger.warning(f"Skipping dangerous tar member path: {member.name}")
                continue

            # Strip leading '{repo}-{branch}/' directory created by GitHub tarballs
            parts = norm_name.replace("\\", "/").split("/")
            if len(parts) <= 1:
                continue
            rel_path = "/".join(parts[1:])

            # Apply filtering
            if is_excluded_path(rel_path):
                continue

            # Check file size limit
            if member.size > MAX_FILE_SIZE_BYTES or member.size == 0:
                continue

            # Extract file content
            f = tar.extractfile(member)
            if f is None:
                continue

            raw_bytes = f.read()
            try:
                # Attempt UTF-8 decoding
                text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError:
                try:
                    # Fallback to latin-1
                    text = raw_bytes.decode("latin-1")
                except Exception:
                    continue  # Skip binary file

            # Redact detected secrets
            sanitized_text = redact_secrets(text)
            files_map[rel_path] = sanitized_text

    return files_map


def fetch_repository_files(repo_url: str, branch: Optional[str] = None) -> Tuple[str, str, str, Dict[str, str]]:
    """
    High-level entrypoint: parses URL, downloads tarball, and safely extracts filtered source files.
    Returns: (owner, repo, resolved_branch, files_map)
    """
    owner, repo, requested_branch = parse_github_url(repo_url, branch)
    tar_bytes = download_github_tarball(owner, repo, requested_branch)
    files_map = extract_repo_files(tar_bytes)

    if not files_map:
        raise ValueError(f"Repository '{owner}/{repo}' contains no valid text source files to review.")

    return owner, repo, requested_branch, files_map
