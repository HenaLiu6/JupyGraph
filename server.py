import asyncio
import json
import sys
from pathlib import Path

import websockets

from fileExplorer import list_folder
from python_environment import (
    available_interpreters,
    validate_interpreter,
)
from python_worker import PythonWorker, WorkerError, WorkerInterrupted
from workflowManagement import (
    CURRENT_WORKFLOW_ID,
    get_last_workflow_id,
    get_saved_last_workflow_id,
    load_workflow,
    save_workflow,
    set_last_workflow_id,
    create_new_workflow,
    set_workflow_root,
)

MAX_WEBSOCKET_MESSAGE_SIZE = 16 * 1024 * 1024


def serialize_value(value):
    if isinstance(value, (int, float, str, bool, type(None))):
        return value
    if isinstance(value, dict):
        return {str(key): serialize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [serialize_value(item) for item in value]
    return str(value)


def _send_node_update(websocket, loop, message):
    try:
        future = asyncio.run_coroutine_threadsafe(
            websocket.send(json.dumps(message)), loop
        )
        future.add_done_callback(lambda future: future.exception())
    except RuntimeError:
        # The browser may have disconnected while execution was in progress.
        pass


def _workspace(value):
    path = Path(value or Path.cwd()).expanduser().resolve()
    if not path.is_dir():
        raise ValueError(f"Workspace does not exist: {value}")
    return str(path)


async def _send_python_environments(websocket, request, workspace, selected):
    environments = available_interpreters(workspace)
    await websocket.send(json.dumps({
        "type": "python.environments",
        "environments": environments,
        "workspace": workspace,
        "selectedInterpreter": selected,
        "requestId": request.get("requestId"),
    }))


async def handler(websocket):
    workspace = _workspace(sys.argv[1] if len(sys.argv) > 1 else str(Path.cwd()))
    set_workflow_root(workspace)
    selected_interpreter = sys.executable
    worker = None
    latest_graph = None
    active_execution = None
    stopping_execution = False
    execution_queue = []
    loop = asyncio.get_running_loop()

    try:
        worker = PythonWorker(selected_interpreter, workspace)
        await websocket.send(json.dumps({
            "type": "python.ready",
            "interpreter": selected_interpreter,
            "workspace": workspace,
        }))

        async for raw_message in websocket:
            data = None
            try:
                data = json.loads(raw_message)
                if not isinstance(data, dict):
                    raise ValueError("WebSocket messages must be JSON objects")
                message_type = data.get("type")
                request_id = data.get("requestId")

                if "workspace" in data:
                    workspace = _workspace(data["workspace"])
                    set_workflow_root(workspace)

                if message_type in ("python.environments", "python.discover",
                                    "python.get_interpreters"):
                    await _send_python_environments(
                        websocket, data, workspace, selected_interpreter
                    )
                    continue

                if message_type in ("python.select", "python.select_interpreter"):
                    requested = data.get("interpreter") or data.get("path")
                    if not requested:
                        raise ValueError("An interpreter path is required")
                    new_interpreter = validate_interpreter(requested)
                    previous_interpreter = selected_interpreter
                    previous_workspace = workspace
                    try:
                        if worker:
                            worker.restart(new_interpreter, workspace)
                        selected_interpreter = new_interpreter
                    except WorkerError:
                        # Keep the session usable if the selected environment
                        # does not contain GraphNote's runtime dependencies.
                        if worker:
                            worker.restart(previous_interpreter, previous_workspace)
                        raise
                    await websocket.send(json.dumps({
                        "type": "python.selected",
                        "interpreter": selected_interpreter,
                        "workspace": workspace,
                        "environments": available_interpreters(workspace),
                        "requestId": request_id,
                    }))
                    continue

                if message_type == "python.status":
                    await websocket.send(json.dumps({
                        "type": "python.status",
                        "interpreter": selected_interpreter,
                        "workspace": workspace,
                        "alive": bool(worker and worker.alive),
                        "requestId": request_id,
                    }))
                    continue

                if "graph" in data:
                    latest_graph = data["graph"]

                if message_type in ("execute", "execute_connected",
                                    "execute_persistent"):
                    if worker is None:
                        raise WorkerError("Python worker is not available")
                    payload = {}
                    if latest_graph is not None:
                        payload["graph"] = latest_graph
                    if message_type == "execute_persistent":
                        payload["node"] = data.get("node", {})
                    else:
                        payload["targetId"] = (
                            data.get("graph", latest_graph or {}).get("execute")
                        )

                    def progress(message):
                        _send_node_update(websocket, loop, message)

                    execution_queue.append({
                        "type": message_type,
                        "payload": payload,
                        "requestId": request_id,
                        "progress": progress,
                    })

                    async def start_next_execution():
                        nonlocal active_execution
                        if (active_execution and not active_execution.done()) or stopping_execution:
                            return
                        if not execution_queue:
                            return

                        job = execution_queue.pop(0)

                        async def finish_execution():
                            nonlocal active_execution
                            try:
                                await websocket.send(json.dumps({
                                    "type": "execution.started",
                                    "requestId": job["requestId"],
                                    "queueLength": len(execution_queue) + 1,
                                }))
                                result = await loop.run_in_executor(
                                    None,
                                    lambda: worker.request(
                                        job["type"], job["payload"], job["progress"]
                                    ),
                                )
                                await websocket.send(json.dumps({
                                    "type": "execution.completed",
                                    "requestId": job["requestId"],
                                }))
                                await websocket.send(json.dumps(result))
                            except WorkerInterrupted:
                                if not stopping_execution:
                                    await websocket.send(json.dumps({
                                        "type": "execution.stopped",
                                        "requestId": job["requestId"],
                                    }))
                            except WorkerError as exc:
                                await websocket.send(json.dumps({
                                    "type": "execution.error",
                                    "message": str(exc),
                                    "requestId": job["requestId"],
                                }))
                            finally:
                                active_execution = None
                                if not stopping_execution:
                                    await start_next_execution()

                        active_execution = asyncio.create_task(finish_execution())

                    if active_execution and not active_execution.done():
                        await websocket.send(json.dumps({
                            "type": "execution.queued",
                            "requestId": request_id,
                            "position": len(execution_queue) + 1,
                        }))
                    stopping_execution = False
                    await start_next_execution()
                    continue

                if message_type == "execution.stop":
                    if not active_execution or active_execution.done():
                        execution_queue.clear()
                        await websocket.send(json.dumps({
                            "type": "execution.stopped",
                            "requestId": request_id,
                            "message": "No execution is currently running",
                        }))
                        continue
                    stopping_execution = True
                    execution_queue.clear()
                    worker.interrupt()
                    await active_execution
                    try:
                        worker.start()
                    except WorkerError as exc:
                        await websocket.send(json.dumps({
                            "type": "execution.error",
                            "requestId": request_id,
                            "message": f"Execution stopped, but the worker could not restart: {exc}",
                        }))
                        continue
                    await websocket.send(json.dumps({
                        "type": "execution.stopped",
                        "requestId": request_id,
                        "message": "Execution stopped; Python state was reset",
                    }))
                    stopping_execution = False
                    await start_next_execution()
                    continue

                if message_type == "workflow.save":
                    workflow = data.get("workflow", {})
                    workflow_id = workflow.get("id", CURRENT_WORKFLOW_ID)
                    state = workflow.get("state")
                    if state is None:
                        raise ValueError("Missing workflow state")
                    saved = save_workflow(workflow_id, state)
                    await websocket.send(json.dumps({
                        "type": "workflow.saved",
                        "workflow": saved,
                        "requestId": request_id,
                    }))
                    continue

                if message_type == "workflow.load":
                    workflow_id = data.get("id")
                    loaded = load_workflow(workflow_id) if workflow_id else None
                    if loaded is None:
                        raise ValueError(f"Workflow not found: {workflow_id}")
                    if workflow_id != CURRENT_WORKFLOW_ID:
                        set_last_workflow_id(workflow_id)
                    await websocket.send(json.dumps({
                        "type": "workflow.loaded",
                        "workflow": loaded,
                        "requestId": request_id,
                    }))
                    continue

                if message_type == "directory.list":
                    requested_folder = data.get("folder") or workspace
                    await websocket.send(json.dumps({
                        "type": "directory.list",
                        "paths": list_folder(requested_folder),
                        "requestId": request_id,
                    }))
                    continue

                if message_type == "workflow.get_last":
                    last_id = get_last_workflow_id()
                    last_saved_id = get_saved_last_workflow_id()
                    last_workflow = load_workflow(last_id) if last_id else None
                    await websocket.send(json.dumps({
                        "type": "workflow.last",
                        "workflow": last_workflow,
                        "selectedWorkflowId": last_saved_id,
                        "requestId": request_id,
                    }))
                    continue

                if message_type == "workflow.createnew":
                    new_workflow = create_new_workflow(data.get("title", "Untitled"))
                    await websocket.send(json.dumps({
                        "type": "workflow.created",
                        "workflow": new_workflow,
                        "requestId": request_id,
                    }))
                    continue

                if message_type == "ping":
                    await websocket.send(json.dumps({"type": "pong"}))
                    continue

                raise ValueError(f"Unknown message type: {message_type}")
            except json.JSONDecodeError as exc:
                await websocket.send(json.dumps({
                    "type": "protocol.error",
                    "message": f"Invalid JSON message: {exc.msg}",
                }))
            except (ValueError, WorkerError) as exc:
                message_name = data.get("type", "") if isinstance(data, dict) else ""
                if str(message_name).startswith("python."):
                    response_type = "python.error"
                elif str(message_name).startswith("execute"):
                    response_type = "execution.error"
                else:
                    response_type = "workflow.error"
                await websocket.send(json.dumps({
                    "type": response_type,
                    "message": str(exc),
                    "requestId": data.get("requestId") if isinstance(data, dict) else None,
                }))
    finally:
        if active_execution and not active_execution.done():
            stopping_execution = True
            if worker:
                worker.interrupt()
            await active_execution
        if worker:
            worker.stop()


async def main():
    async with websockets.serve(
        handler,
        "localhost",
        6700,
        max_size=MAX_WEBSOCKET_MESSAGE_SIZE,
    ):
        print("WebSocket server running on ws://localhost:6700")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
