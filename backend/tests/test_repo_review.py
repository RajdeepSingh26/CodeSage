import io
import tarfile
import pytest
from pathlib import Path
import sys

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.services.github_service import (
    parse_github_url,
    is_excluded_path,
    redact_secrets,
    extract_repo_files
)
from app.services.project_profiler import (
    profile_repository,
    prioritize_source_files,
    detect_file_language,
    categorize_file_role
)

client = TestClient(app)


def test_github_url_parsing():
    # Standard HTTPS
    owner, repo, branch = parse_github_url("https://github.com/fastapi/fastapi")
    assert owner == "fastapi"
    assert repo == "fastapi"
    assert branch == "main"

    # With trailing slash and .git
    owner, repo, branch = parse_github_url("https://github.com/encode/uvicorn.git/")
    assert owner == "encode"
    assert repo == "uvicorn"
    assert branch == "main"

    # With branch in tree URL
    owner, repo, branch = parse_github_url("https://github.com/facebook/react/tree/main")
    assert owner == "facebook"
    assert repo == "react"
    assert branch == "main"

    # Shorthand owner/repo
    owner, repo, branch = parse_github_url("pallets/flask", explicit_branch="master")
    assert owner == "pallets"
    assert repo == "flask"
    assert branch == "master"

    # Invalid URL
    with pytest.raises(ValueError):
        parse_github_url("https://gitlab.com/user/project")


def test_file_filtering_exclusions():
    # Excluded directories & files
    assert is_excluded_path(".git/config") is True
    assert is_excluded_path("node_modules/express/index.js") is True
    assert is_excluded_path("backend/__pycache__/main.cpython-310.pyc") is True
    assert is_excluded_path("dist/assets/index.js") is True
    assert is_excluded_path(".env") is True
    assert is_excluded_path("config/.env.local") is True
    assert is_excluded_path("keys/id_rsa") is True
    assert is_excluded_path("certs/server.pem") is True
    assert is_excluded_path("secrets.json") is True
    assert is_excluded_path("package-lock.json") is True
    assert is_excluded_path("assets/hero.png") is True

    # Valid source files
    assert is_excluded_path("backend/main.py") is False
    assert is_excluded_path("src/App.tsx") is False
    assert is_excluded_path("controllers/user_controller.go") is False
    assert is_excluded_path("services/AuthService.java") is False


def test_secret_redaction():
    code_with_secrets = """
    AWS_ACCESS_KEY = "AKIA1234567890ABCDEF"
    GITHUB_PAT = "ghp_123456789012345678901234567890123456"
    api_key = "sk_live_secretkey123456789"
    normal_code = 123
    """
    redacted = redact_secrets(code_with_secrets)
    assert "AKIA1234567890ABCDEF" not in redacted
    assert "[REDACTED_AWS_KEY]" in redacted
    assert "ghp_123456789012345678901234567890123456" not in redacted
    assert "[REDACTED_GITHUB_TOKEN]" in redacted
    assert "[REDACTED_SECRET]" in redacted
    assert "normal_code = 123" in redacted


def test_safe_tar_extraction_and_path_traversal():
    tar_bytes_io = io.BytesIO()
    with tarfile.open(fileobj=tar_bytes_io, mode="w:gz") as tar:
        # Valid file
        valid_data = b"print('hello world')"
        ti_valid = tarfile.TarInfo(name="myrepo-main/app/main.py")
        ti_valid.size = len(valid_data)
        tar.addfile(ti_valid, io.BytesIO(valid_data))

        # Path traversal malicious attempt
        bad_data = b"malicious content"
        ti_bad = tarfile.TarInfo(name="myrepo-main/../../etc/passwd")
        ti_bad.size = len(bad_data)
        tar.addfile(ti_bad, io.BytesIO(bad_data))

        # Excluded file (.env)
        env_data = b"SECRET=supersecret"
        ti_env = tarfile.TarInfo(name="myrepo-main/.env")
        ti_env.size = len(env_data)
        tar.addfile(ti_env, io.BytesIO(env_data))

    extracted = extract_repo_files(tar_bytes_io.getvalue())
    assert "app/main.py" in extracted
    assert "../../etc/passwd" not in extracted
    assert ".env" not in extracted


def test_project_profiler_and_prioritization():
    files_map = {
        "requirements.txt": "fastapi>=0.100.0\npydantic>=2.0.0\nsqlalchemy>=2.0.0",
        "package.json": '{"dependencies": {"react": "^18.0.0", "vite": "^5.0.0"}}',
        "backend/main.py": "from fastapi import FastAPI\napp = FastAPI()",
        "backend/routers/items.py": "from fastapi import APIRouter\nrouter = APIRouter()",
        "backend/services/item_service.py": "class ItemService:\n    def get_items(self): pass",
        "backend/repositories/item_repo.py": "class ItemRepository:\n    def query_all(self): pass",
        "backend/models/item.py": "class Item:\n    id: int",
        "frontend/src/App.tsx": "export default function App() { return <div>App</div>; }",
        "README.md": "# Sample Project"
    }

    profile = profile_repository(files_map)
    assert "FastAPI" in profile.detected_frameworks
    assert "React" in profile.detected_frameworks
    assert "Fullstack" in profile.architecture_summary or "API" in profile.architecture_summary

    selected = prioritize_source_files(files_map, max_files=5)
    assert len(selected) <= 5
    assert len(selected) >= 3

    selected_paths = [s.file_path for s in selected]
    # main.py entrypoint must be selected
    assert "backend/main.py" in selected_paths
    # Routers and services must be prioritized over README
    assert "README.md" not in selected_paths


def test_repo_review_endpoint_validation():
    # Reject invalid URL format
    res = client.post("/api/repository-review", json={
        "repo_url": "invalid-url-format",
        "branch": "main"
    })
    assert res.status_code == 400
    assert "Invalid GitHub repository URL" in res.json()["detail"]
