import sys
import json
from pathlib import Path


def build_tree(path: Path, base: Path):
    rel_path = str(path.relative_to(base)).replace("\\", "/")

    node = {
        "path": rel_path
    }

    if path.is_dir():
        try:
            children = sorted(path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
            items = [build_tree(child, base) for child in children]
            if items:
                node["items"] = items
        except PermissionError:
            node["items"] = []
    return node


def list_folder():
    if len(sys.argv) < 2:
        return {"error": "No folder provided"}

    root = Path(sys.argv[1]).resolve()

    if not root.exists():
        return {"error": "Folder does not exist"}

    children = sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))

    return {
        "path": str(root).replace("\\", "/"),
        "items": [build_tree(child, root) for child in children]
    }