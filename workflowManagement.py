import json
import re
import time
from pathlib import Path

WORKFLOW_DIR = Path(__file__).resolve().parent / "workflows"
LAST_WORKFLOW_FILE = WORKFLOW_DIR / ".lastworkflow"
CURRENT_WORKFLOW_ID = "autosave"
VALID_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def ensure_workflow_dir():
    WORKFLOW_DIR.mkdir(parents=True, exist_ok=True)


def normalize_workflow_id(workflow_id):
    if not isinstance(workflow_id, str) or not workflow_id:
        return CURRENT_WORKFLOW_ID

    workflow_id = workflow_id.replace("\\", "/")
    if workflow_id.endswith(".json"):
        workflow_id = workflow_id[:-5]

    segments = [seg for seg in workflow_id.split("/") if seg and seg not in {".", ".."}]
    sanitized_segments = []
    for segment in segments:
        sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", segment)
        if sanitized:
            sanitized_segments.append(sanitized)

    if not sanitized_segments:
        return CURRENT_WORKFLOW_ID

    return "/".join(sanitized_segments)


def workflow_path(workflow_id):
    normalized = normalize_workflow_id(workflow_id)
    path = WORKFLOW_DIR
    for segment in normalized.split("/"):
        path = path / segment
    return path.with_suffix(".json")


def save_workflow(workflow_id, state):
    ensure_workflow_dir()
    workflow_id = normalize_workflow_id(workflow_id)
    payload = {
        "id": workflow_id,
        "title": workflow_id,
        "updatedAt": int(time.time() * 1000),
        "state": state,
    }
    path = workflow_path(workflow_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    set_last_workflow_id(workflow_id)
    return payload

def create_new_workflow(workflow_id):
    state = {"nodes": [], "links": []}
    return save_workflow(workflow_id, state)


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
    for path in WORKFLOW_DIR.rglob("*.json"):
        if path.name == f"{CURRENT_WORKFLOW_ID}.json":
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            workflows.append({
                "id": data.get("id", path.relative_to(WORKFLOW_DIR).with_suffix("").as_posix()),
                "title": data.get("title", path.stem),
                "updatedAt": data.get("updatedAt", path.stat().st_mtime_ns // 1000000),
                "relativePath": path.relative_to(WORKFLOW_DIR).as_posix(),
            })
        except Exception:
            continue
    return sorted(workflows, key=lambda item: item.get("updatedAt", 0), reverse=True)


def get_saved_last_workflow_id():
    if LAST_WORKFLOW_FILE.exists():
        try:
            contents = LAST_WORKFLOW_FILE.read_text(encoding="utf-8").strip()
            if contents:
                return normalize_workflow_id(contents)
        except Exception:
            pass
    return None


def set_last_workflow_id(workflow_id):
    ensure_workflow_dir()
    workflow_id = normalize_workflow_id(workflow_id)
    LAST_WORKFLOW_FILE.write_text(workflow_id, encoding="utf-8")


def get_last_workflow_id():
    current_path = workflow_path(CURRENT_WORKFLOW_ID)
    if current_path.exists():
        return CURRENT_WORKFLOW_ID
    return get_saved_last_workflow_id()


def load_last_workflow():
    last_id = get_last_workflow_id()
    if last_id:
        return load_workflow(last_id)
    return None
