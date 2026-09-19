"""Python interpreter and virtual-environment discovery helpers."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Iterable


_ENVIRONMENT_NAMES = (".venv", "venv", "env", ".env")
_PYTHON_NAMES = ("python.exe", "python", "python3")


def _python_executable(environment: Path) -> Path | None:
    """Return the interpreter in a venv, if the venv has one."""
    bin_dir = environment / ("Scripts" if os.name == "nt" else "bin")
    for name in _PYTHON_NAMES:
        candidate = bin_dir / name
        if candidate.is_file():
            return candidate
    return None


def _environment(path: Path, workspace: Path) -> dict[str, str] | None:
    path = path.resolve()
    interpreter = _python_executable(path)
    if interpreter is None:
        return None
    try:
        relative_path = path.relative_to(workspace)
        display_name = str(relative_path) if str(relative_path) != "." else path.name
    except ValueError:
        display_name = path.name
    return {
        "name": display_name or str(path),
        "path": str(path),
        "interpreter": str(interpreter.resolve()),
    }


def _candidate_directories(workspace: Path) -> Iterable[Path]:
    """Yield venv locations in the workspace and one directory below it."""
    yield workspace
    for child in sorted(workspace.iterdir(), key=lambda item: item.name.lower()):
        if not child.is_dir() or child.name.startswith(".git"):
            continue
        yield child


def discover_virtual_environments(workspace: str | os.PathLike[str] | None = None) -> list[dict[str, str]]:
    """Find common virtualenv names at *workspace* and its immediate children.

    Discovery deliberately does not recurse through arbitrary project trees.  This
    keeps the settings dialog quick and prevents accidentally selecting an
    unrelated environment deep inside a workspace.
    """
    root = Path(workspace or Path.cwd()).expanduser().resolve()
    if not root.is_dir():
        return []

    found: dict[str, dict[str, str]] = {}
    try:
        locations = _candidate_directories(root)
        for location in locations:
            # The workspace itself may be a venv; otherwise inspect its conventional
            # environment directories and environments directly below child projects.
            names = ("",) if (location / "pyvenv.cfg").is_file() else _ENVIRONMENT_NAMES
            for name in names:
                environment = location if not name else location / name
                item = _environment(environment, root)
                if item:
                    found[item["interpreter"].lower()] = item
    except OSError:
        return sorted(found.values(), key=lambda item: item["name"].lower())
    return sorted(found.values(), key=lambda item: item["name"].lower())


def available_interpreters(workspace: str | os.PathLike[str] | None = None) -> list[dict[str, str]]:
    """Return discovered environments plus the interpreter running the server."""
    current = Path(sys.executable).resolve()
    result = [{
        "name": "Server Python",
        "path": str(current.parent.parent if current.parent.name.lower() in ("scripts", "bin") else current.parent),
        "interpreter": str(current),
    }]
    known = {current.as_posix().lower()}
    for item in discover_virtual_environments(workspace):
        if item["interpreter"].lower() not in known:
            result.append(item)
            known.add(item["interpreter"].lower())
    return result


def validate_interpreter(interpreter: str | os.PathLike[str]) -> str:
    """Validate and normalize a user-selected interpreter path."""
    path = Path(interpreter).expanduser().resolve()
    if not path.is_file():
        raise ValueError(f"Python interpreter does not exist: {interpreter}")
    if path.name.lower() not in _PYTHON_NAMES:
        raise ValueError("Selected interpreter must be a Python executable")
    return str(path)


# Backwards-friendly names for callers that describe discovery as "finding"
# environments rather than discovering them.
find_virtual_environments = discover_virtual_environments
