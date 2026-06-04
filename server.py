import asyncio
import json
import websockets

from graphLoader import *
from engine import *
from workflowManagement import (
    get_last_workflow_id,
    load_last_workflow,
    load_workflow,
    list_workflows,
    save_workflow,
)


def serialize_value(v):
    if isinstance(v, (int, float, str, bool, type(None))):
        return v
    if isinstance(v, dict):
        return {str(k): serialize_value(val) for k, val in v.items()}
    if isinstance(v, (list, tuple, set)):
        return [serialize_value(item) for item in v]
    return str(v)


def send_node_update(websocket, loop, node_id, stdout, vtab):
    payload = {
        "type": "node.update",
        "nodeStates": {
            node_id: {
                "stdout": serialize_value(stdout),
                "vtab": {k: serialize_value(v) for k, v in (vtab or {}).items() if k != "__builtins__"},
            }
        }
    }
    try:
        future = asyncio.run_coroutine_threadsafe(websocket.send(json.dumps(payload)), loop)
        future.add_done_callback(lambda f: f.exception() if f.exception() else None)
    except RuntimeError:
        pass


async def handler(websocket):
    async for message in websocket:
        data = json.loads(message)
        msg_type = data.get("type")
        loop = asyncio.get_running_loop()

        # Sync the server's memory with the UI's current state
        if "graph" in data:
            update_graph_state(data["graph"])
        
        def progress_callback(node_id, stdout, vtab):
            send_node_update(websocket, loop, node_id, stdout, vtab)

        if msg_type == "execute":
            target_id = data["graph"].get("execute")
            if target_id:
                await loop.run_in_executor(None, lambda: execute_graph(str(target_id), on_output=progress_callback))
            await send_results(websocket)
            continue

        elif msg_type == "execute_persistent":
            node_data = data["node"]
            temp_node = Node(node_data["id"], node_data["code"], [])
            await loop.run_in_executor(None, lambda: execute_persistent(
                temp_node,
                on_output=progress_callback
            ))
            send_node_update(websocket, loop, temp_node.id, temp_node.stdout, persistentState)
            continue

        elif msg_type == "execute_connected":
            target_id = data["graph"].get("execute")
            if target_id:
                target_id_str = str(target_id)
                if target_id_str in nodeMap:
                    nodeMap[target_id_str].isCached = False
                await loop.run_in_executor(None, lambda: execute_graph(target_id_str, on_output=progress_callback))
            await send_results(websocket)
            continue

        elif msg_type == "workflow.save":
            workflow = data.get("workflow", {})
            workflow_id = workflow.get("id", "autosave")
            title = workflow.get("title", workflow_id)
            state = workflow.get("state")
            if state is None:
                await websocket.send(json.dumps({
                    "type": "workflow.error",
                    "message": "Missing workflow state",
                    "requestId": data.get("requestId"),
                }))
            else:
                saved = save_workflow(workflow_id, state, title)
                await websocket.send(json.dumps({
                    "type": "workflow.saved",
                    "workflow": saved,
                    "requestId": data.get("requestId"),
                }))

        elif msg_type == "workflow.load":
            workflow_id = data.get("id")
            loaded = None
            if workflow_id:
                loaded = load_workflow(workflow_id)
            if loaded is None:
                await websocket.send(json.dumps({
                    "type": "workflow.error",
                    "message": f"Workflow not found: {workflow_id}",
                    "requestId": data.get("requestId"),
                }))
            else:
                await websocket.send(json.dumps({
                    "type": "workflow.loaded",
                    "workflow": loaded,
                    "requestId": data.get("requestId"),
                }))

        elif msg_type == "workflow.list":
            workflows = list_workflows()
            await websocket.send(json.dumps({
                "type": "workflow.list",
                "workflows": workflows,
                "requestId": data.get("requestId"),
            }))

        elif msg_type == "workflow.get_last":
            last_id = get_last_workflow_id()
            last_workflow = None
            if last_id:
                last_workflow = load_workflow(last_id)
            await websocket.send(json.dumps({
                "type": "workflow.last",
                "workflow": last_workflow,
                "requestId": data.get("requestId"),
            }))

        elif msg_type == "ping":
            await websocket.send(json.dumps({"type": "pong"}))
            continue


async def send_results(websocket):
    def serialize_value(v):
        if isinstance(v, (int, float, str, bool, type(None))):
            return v
        if isinstance(v, dict):
            return {str(k): serialize_value(val) for k, val in v.items()}
        if isinstance(v, (list, tuple, set)):
            return [serialize_value(item) for item in v]
        return str(v)
    
    result = {
        "type": "done",
        "nodeStates": {
            nid: {
                "vtab": {k: serialize_value(v) for k, v in getattr(node, 'vtab', {}).items() if k != "__builtins__"},
                "stdout": serialize_value(node.stdout)
            } for nid, node in nodeMap.items()
        },
        "persistentState": {
            k: serialize_value(v) for k, v in persistentState.items() if k != "__builtins__"
        }
    }
    await websocket.send(json.dumps(result))

async def main():
    async with websockets.serve(handler, "localhost", 6700):
        print("WebSocket server running on ws://localhost:6700")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())