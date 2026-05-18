from engine import nodeMap, Node

def update_graph_state(graph_json):
    """
    Synchronizes the server's nodeMap with the UI state.
    Only resets 'isCached' if the code or connections actually changed.
    """
    incoming_nodes = graph_json.get("nodes", [])
    present_ids = set()

    for n_data in incoming_nodes:
        # Convert IDs to strings to ensure dictionary key consistency
        nid = str(n_data["id"])
        present_ids.add(nid)
        
        code = n_data.get("code", "")
        inputs = [str(i) for i in n_data.get("inputs", [])] # Ensure input IDs are strings

        if nid in nodeMap:
            node = nodeMap[nid]
            # Detect changes to avoid unnecessary re-execution
            if node.code != code or node.inputs != inputs:
                node.code = code
                node.inputs = inputs
                node.isCached = False  
                # Invalidate children so they re-run with new parent data
                invalidate_descendants(nid)
        else:
            # Add new node to the existing persistent map
            nodeMap[nid] = Node(nid, code, inputs)

    # Cleanup: Remove nodes from server memory that were deleted in UI
    keys_to_delete = [nid for nid in nodeMap if nid not in present_ids]
    for nid in keys_to_delete:
        del nodeMap[nid]

    # Rebuild outputs/parent links after all nodes are present.
    for node in nodeMap.values():
        node.outputs = []
    for node in nodeMap.values():
        node.setParents()

def invalidate_descendants(node_id):
    """
    Recursively clears the cache of all nodes downstream 
    of a changed node.
    """
    for node in nodeMap.values():
        if str(node_id) in [str(i) for i in node.inputs]:
            if node.isCached:
                node.isCached = False
                invalidate_descendants(node.id)

def get_entry_node(graph_json):
    """Retrieves the specific node the user requested to execute."""
    execute_id = str(graph_json.get("execute"))
    return nodeMap.get(execute_id)