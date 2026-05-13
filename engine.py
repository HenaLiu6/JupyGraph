import sys
import traceback

nodeMap = {}
persistentState = {}

class Node(dict):
    def __init__(self, id, code, inputs=None):
        super().__init__()
        self.id = str(id)
        self.code = code
        self.inputs = [str(i) for i in (inputs or [])]
        self.outputs = []

        self.vtab = {}
        self.isCached = False

    def setParents(self):
        for parent in self.inputs:
            nodeMap[parent].outputs.append(self.id)
    
    def __getitem__(self, key):
        # check current node first
        if key in self.vtab:
            return self.vtab[key]

        # search parents depth-first
        for parent in self.inputs:
            try:
                return nodeMap[parent][key]
            except KeyError:
                continue

        raise KeyError(key)

    def __setitem__(self, key, value):
        self.vtab[key] = value

    def __contains__(self, key):
        if key in self.vtab:
            return True
        return any(key in nodeMap[parent] for parent in self.inputs)


def execute_graph(target_node_id):
    target_id = str(target_node_id)    
    node = nodeMap[target_id]
    _recursive_execute(node)
    sync_to_persistent(node)

def _recursive_execute(node):
    if node.isCached: return
    for parent in node.inputs:
        _recursive_execute(nodeMap[parent])
    
    try:
        exec(node.code, {"__builtins__": __builtins__}, node)
        node.isCached = True
    except Exception as e:
        print(f"Error in Node {node.id}: {e}")
        raise

def sync_to_persistent(target_node):
    visited = set()
    order = []

    def build_order(node_id):
        if node_id in visited:
            return
        visited.add(node_id)
        
        node = nodeMap[node_id]
        for parent_id in node.inputs:
            build_order(parent_id)
        
        order.append(node)

    build_order(target_node.id)

    for node in order:
        if node.isCached:
            persistentState.update(node.vtab)

def execute_persistent(node):
    try:
        exec(node.code, {"__builtins__": __builtins__}, persistentState)
    except Exception:
        traceback.print_exc()

def reset():
    global persistentState
    persistentState = {}
    for n in nodeMap.values():
        n.isCached = False
        n.vtab = {}

