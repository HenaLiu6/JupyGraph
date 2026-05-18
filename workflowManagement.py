import json
import re
import time
from pathlib import Path

WORKFLOW_DIR = Path(__file__).resolve().parent / "workflows"
LAST_WORKFLOW_FILE = WORKFLOW_DIR / ".lastworkflow"
DEFAULT_WORKFLOW_ID = "autosave"
VALID_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def ensure_workflow_dir():
    WORKFLOW_DIR.mkdir(parents=True, exist_ok=True)


def normalize_workflow_id(workflow_id):
    if not isinstance(workflow_id, str) or not workflow_id:
        return DEFAULT_WORKFLOW_ID
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", workflow_id)
    if not sanitized:
        return DEFAULT_WORKFLOW_ID
    return sanitized


def workflow_path(workflow_id):
    return WORKFLOW_DIR / f"{normalize_workflow_id(workflow_id)}.json"


def save_workflow(workflow_id, state, title=None):
    ensure_workflow_dir()
    workflow_id = normalize_workflow_id(workflow_id)
    payload = {
        "id": workflow_id,
        "title": title or workflow_id,
        "updatedAt": int(time.time() * 1000),
        "state": state,
    }
    path = workflow_path(workflow_id)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    set_last_workflow_id(workflow_id)
    return payload


def load_workflow(workflow_id):
    path = workflow_path(workflow_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def list_workflows():
    ensure_workflow_dir()
    workflows = []
    for path in WORKFLOW_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            workflows.append({
                "id": data.get("id", path.stem),
                "title": data.get("title", path.stem),
                "updatedAt": data.get("updatedAt", path.stat().st_mtime_ns // 1000000),
            })
        except Exception:
            continue
    return sorted(workflows, key=lambda item: item.get("updatedAt", 0), reverse=True)


def set_last_workflow_id(workflow_id):
    ensure_workflow_dir()
    workflow_id = normalize_workflow_id(workflow_id)
    LAST_WORKFLOW_FILE.write_text(workflow_id, encoding="utf-8")


def get_last_workflow_id():
    if LAST_WORKFLOW_FILE.exists():
        try:
            contents = LAST_WORKFLOW_FILE.read_text(encoding="utf-8").strip()
            if contents:
                return normalize_workflow_id(contents)
        except Exception:
            pass
    autosave_path = workflow_path(DEFAULT_WORKFLOW_ID)
    if autosave_path.exists():
        return DEFAULT_WORKFLOW_ID
    return None


def load_last_workflow():
    last_id = get_last_workflow_id()
    if last_id:
        return load_workflow(last_id)
    return None
