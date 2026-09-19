import sys
import json
from pathlib import Path

VISIBLE_EXTENSIONS = {".py", ".json"}
IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    ".venv",
    "venv",
    "env",
    ".env",
    "__pycache__",
    "node_modules",
    ".mypy_cache",
    ".pytest_cache",
    ".ipynb_checkpoints",
    ".tox",
}


def should_skip_path(path: Path):
    if path.name in IGNORED_DIRS:
        return True
    if path.name.startswith(".") and path.name not in {".env"}:
        return True
    return False


def build_tree_entry(path: Path, base: Path):
    rel_path = str(path.relative_to(base)).replace("\\", "/")
    node = {"path": rel_path}
    if path.is_dir():
        node["items"] = []
    return node


def list_folder(folder=None):
    root = Path(folder or (sys.argv[1] if len(sys.argv) >= 2 else Path.cwd())).expanduser().resolve()

    if not root.exists():
        return {"error": "Folder does not exist"}

    children = []
    for child in sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
        if should_skip_path(child):
            continue
        if child.is_dir() or child.suffix.lower() in VISIBLE_EXTENSIONS:
            children.append(build_tree_entry(child, root))

    return {
        "path": str(root).replace("\\", "/"),
        "items": children,
    }