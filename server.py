import asyncio
import json
import websockets

from graphLoader import *
from engine import *


async def handler(websocket):
    async for message in websocket:
        data = json.loads(message)
        msg_type = data.get("type")

        # Sync the server's memory with the UI's current state
        if "graph" in data:
            update_graph_state(data["graph"])
        
        if msg_type == "execute":
            target_id = data["graph"].get("execute")
            if target_id:
                execute_graph(str(target_id))
            
        elif msg_type == "execute_persistent":
            node = data["node"]
            execute_persistent(
                Node(node["id"], node["code"], [])
                )

        # not sure what this should do differently
        elif msg_type == "execute_connected":
            target_id = data["graph"].get("execute")
            if target_id:
                execute_graph(str(target_id))

        elif msg_type == "ping":
            await websocket.send(json.dumps({"type": "pong"}))

        await send_results(websocket)


async def send_results(websocket):
    result = {
        "type": "done",
        "nodeStates": {
            nid: node.vtab for nid, node in nodeMap.items()
        },
        "persistentState": {
            k: v for k, v in persistentState.items() if isinstance(v, (int, float, str, list, dict))
        }
    }
    await websocket.send(json.dumps(result))

async def main():
    async with websockets.serve(handler, "localhost", 6700):
        print("WebSocket server running on ws://localhost:6700")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())