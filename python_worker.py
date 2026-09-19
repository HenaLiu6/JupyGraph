"""Persistent Python execution worker and its parent-side process wrapper.

The worker communicates exclusively with newline-delimited JSON on stdout.  User
stdout is captured by ``engine`` and is therefore never allowed to corrupt the
protocol stream.
"""

from __future__ import annotations

import json
import math
import os
import queue
import subprocess
import sys
import threading
from pathlib import Path
from typing import Callable


class WorkerError(RuntimeError):
    """Raised when the persistent worker cannot process a request."""


class WorkerInterrupted(WorkerError):
    """Raised when the active worker request was intentionally interrupted."""


def _serialize(value):
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, (int, float, str, bool, type(None))):
        return value
    if isinstance(value, dict):
        return {str(key): _serialize(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_serialize(item) for item in value]
    return str(value)


def _node_states(node_map):
    return {
        str(node_id): {
            "vtab": {
                key: _serialize(value)
                for key, value in getattr(node, "vtab", {}).items()
                if key != "__builtins__"
            },
            "stdout": _serialize(getattr(node, "stdout", [])),
        }
        for node_id, node in node_map.items()
    }


def _persistent_state(state):
    return {
        key: _serialize(value)
        for key, value in state.items()
        if key != "__builtins__"
    }


def run_worker() -> None:
    """Run the child-side JSON-lines loop."""
    # Keep a reference to the protocol stream.  engine temporarily replaces
    # sys.stdout while executing user code.
    protocol_out = sys.stdout

    def send(payload):
        protocol_out.write(json.dumps(
            payload, separators=(",", ":"), allow_nan=False
        ) + "\n")
        protocol_out.flush()

    try:
        import engine
        from graphLoader import update_graph_state
        from engine import Node
    except Exception as exc:
        send({"type": "startup.error", "message": str(exc)})
        return

    send({"type": "ready", "interpreter": sys.executable})

    for raw_line in sys.stdin:
        request = None
        try:
            request = json.loads(raw_line)
            if not isinstance(request, dict):
                raise ValueError("request must be a JSON object")
            request_id = request.get("requestId")
            request_type = request.get("type")
            graph = request.get("graph")
            if graph is not None:
                update_graph_state(graph)

            if request_type == "update_graph":
                result = {"type": "result", "requestId": request_id}
            elif request_type in ("execute", "execute_connected"):
                target_id = request.get("targetId")
                if target_id is None and graph:
                    target_id = graph.get("execute")
                if target_id is None:
                    raise ValueError("No graph execution target was provided")
                target_id = str(target_id)
                if request_type == "execute_connected" and target_id in engine.nodeMap:
                    engine.nodeMap[target_id].isCached = False

                def progress(node_id, stdout, vtab):
                    send({
                        "type": "node.update",
                        "requestId": request_id,
                        "nodeStates": {
                            str(node_id): {
                                "stdout": _serialize(stdout),
                                "vtab": {
                                    key: _serialize(value)
                                    for key, value in (vtab or {}).items()
                                    if key != "__builtins__"
                                },
                            }
                        },
                    })

                engine.execute_graph(target_id, on_output=progress)
                result = {
                    "type": "done",
                    "requestId": request_id,
                    "nodeStates": _node_states(engine.nodeMap),
                    "persistentState": _persistent_state(engine.persistentState),
                }
            elif request_type == "execute_persistent":
                node_data = request.get("node") or {}
                node = Node(node_data.get("id"), node_data.get("code", ""), [])

                def progress(node_id, stdout, vtab):
                    send({
                        "type": "node.update",
                        "requestId": request_id,
                        "nodeStates": {
                            str(node_id): {
                                "stdout": _serialize(stdout),
                                "vtab": _persistent_state(engine.persistentState),
                            }
                        },
                    })

                engine.execute_persistent(node, on_output=progress)
                result = {
                    "type": "done",
                    "requestId": request_id,
                    "nodeStates": {
                        str(node.id): {
                            "stdout": _serialize(node.stdout),
                            "vtab": _persistent_state(engine.persistentState),
                        }
                    },
                    "persistentState": _persistent_state(engine.persistentState),
                }
            elif request_type == "reset":
                engine.reset()
                result = {"type": "result", "requestId": request_id}
            elif request_type == "shutdown":
                send({"type": "result", "requestId": request_id})
                return
            else:
                raise ValueError(f"Unknown worker request: {request_type}")
            send(result)
        except Exception as exc:
            send({
                "type": "error",
                "requestId": request.get("requestId") if isinstance(request, dict) else None,
                "message": str(exc),
            })


class PythonWorker:
    """Own one persistent worker process for a WebSocket connection."""

    def __init__(self, interpreter: str | None = None, workspace: str | None = None):
        self.interpreter = interpreter or sys.executable
        self.workspace = workspace or str(Path.cwd())
        self._process = None
        self._lock = threading.Lock()
        self._stderr_lines: queue.Queue[str] = queue.Queue()
        self._request_id = 0
        self._interrupt_requested = False
        self.start()

    @property
    def alive(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def start(self):
        self.stop()
        self._interrupt_requested = False
        self._stderr_lines = queue.Queue()
        script = str(Path(__file__).resolve())
        try:
            self._process = subprocess.Popen(
                [self.interpreter, script, "--worker"],
                cwd=self.workspace,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                bufsize=1,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
        except (OSError, ValueError) as exc:
            self._process = None
            raise WorkerError(f"Unable to start Python worker: {exc}") from exc

        threading.Thread(target=self._drain_stderr, daemon=True).start()
        try:
            ready = self._read_message()
        except WorkerError:
            self.stop()
            raise
        if ready.get("type") != "ready":
            self.stop()
            raise WorkerError(ready.get("message", "Python worker failed to start"))

    def restart(self, interpreter: str | None = None, workspace: str | None = None):
        if interpreter:
            self.interpreter = interpreter
        if workspace:
            self.workspace = workspace
        self.start()

    def _drain_stderr(self):
        process = self._process
        if not process or not process.stderr:
            return
        for line in process.stderr:
            self._stderr_lines.put(line.rstrip())

    def _read_message(self):
        process = self._process
        if not process or not process.stdout:
            raise WorkerError("Python worker is not running")
        line = process.stdout.readline()
        if not line:
            details = []
            while True:
                try:
                    details.append(self._stderr_lines.get_nowait())
                except queue.Empty:
                    break
            suffix = f": {' '.join(details)}" if details else ""
            raise WorkerError(f"Python worker exited unexpectedly{suffix}")
        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            raise WorkerError("Python worker emitted invalid JSON") from exc
        if not isinstance(message, dict):
            raise WorkerError("Python worker emitted a non-object message")
        return message

    def request(self, request_type: str, payload: dict | None = None,
                on_update: Callable[[dict], None] | None = None) -> dict:
        with self._lock:
            if not self.alive:
                self.start()
            self._request_id += 1
            request = {"type": request_type, "requestId": self._request_id}
            request.update(payload or {})
            try:
                self._process.stdin.write(json.dumps(request, separators=(",", ":")) + "\n")
                self._process.stdin.flush()
                while True:
                    message = self._read_message()
                    if message.get("type") == "node.update":
                        if on_update:
                            on_update(message)
                        continue
                    if message.get("requestId") != self._request_id:
                        continue
                    if message.get("type") == "error":
                        raise WorkerError(message.get("message", "Python execution failed"))
                    return message
            except (OSError, BrokenPipeError) as exc:
                raise WorkerError(f"Python worker communication failed: {exc}") from exc
            except WorkerError:
                if self._interrupt_requested:
                    raise WorkerInterrupted("Python execution was stopped")
                raise

    def interrupt(self):
        """Terminate the active request without waiting for user code to return."""
        process = self._process
        if not process or process.poll() is not None:
            return
        self._interrupt_requested = True
        process.kill()
        process.wait()

    def stop(self):
        process, self._process = self._process, None
        if not process:
            return
        if process.poll() is None:
            try:
                process.stdin.write(json.dumps({
                    "type": "shutdown", "requestId": -1
                }) + "\n")
                process.stdin.flush()
                process.wait(timeout=2)
            except (OSError, BrokenPipeError, subprocess.TimeoutExpired):
                process.kill()
                process.wait()
        for stream in (process.stdin, process.stdout, process.stderr):
            if stream:
                stream.close()


if __name__ == "__main__":
    run_worker()
