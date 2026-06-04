import sys
import traceback
import io
import threading

from outputTypes import *
from patches.displayPatches import _thread_local

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
        self.stdout = []
        self.isCached = False

    def setParents(self):
        for parent in self.inputs:
            if parent in nodeMap:
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


def execute_graph(target_node_id, on_output):
    target_id = str(target_node_id)
    node = nodeMap[target_id]
    _recursive_execute(node, on_output=on_output)
    sync_to_persistent(node)


def execute_persistent(node, on_output):
    node.stdout = []
    def stdout(out_dict):
        if on_output:
            node.stdout.append(out_dict)
            on_output(node.id, node.stdout, persistentState)

    _ = _execute_code(node.code, persistentState, on_stdout=stdout)
    # node.vtab = dict(persistentState) # This adds the entire persistent state to the nodes vtable


def _format_user_traceback():
    exc_type, exc_value, tb = sys.exc_info()
    extracted = traceback.extract_tb(tb)
    user_frames = [frame for frame in extracted if frame.filename == "<string>"]
    if user_frames:
        lines = []
        for frame in user_frames:
            lines.append(f'File "{frame.filename}", line {frame.lineno}, in {frame.name}')
            if frame.line:
                lines.append(f'  {frame.line.strip()}')
        lines.append(f"{exc_type.__name__}: {exc_value}")
        return "\n".join(lines)
    return traceback.format_exc()


def _execute_code(code, namespace, on_stdout):
    class stdout_writer:
        def __init__(self, callback):
            self.callback = callback

        def write(self, text):
            if text is None: return
            if text == '\n' or not text.strip():
                return
            if self.callback:
                self.callback(text_output(text))

        def flush(self):
            pass

        def isatty(self):
            return False

    old_stdout = sys.stdout
    sys.stdout = stdout_writer(on_stdout)
    had_builtins = "__builtins__" in namespace
    namespace["__builtins__"] = __builtins__

    _thread_local.callback = on_stdout

    try:
        exec(code, namespace, namespace)
        error = False
    except Exception:
        error_text = _format_user_traceback()
        on_stdout(error_output(error_text))
        error = True
    finally:
        sys.stdout = old_stdout
        if not had_builtins:
            namespace.pop("__builtins__", None)

    return error

def _recursive_execute(node, on_output):
    if node.isCached:
        return
    
    for parent in node.inputs:
        _recursive_execute(nodeMap[parent], on_output=on_output)
    
    node.stdout = []
    node.vtab = {}
    def node_stdout(out_dict):
        node.stdout.append(out_dict)
        on_output(node.id, node.stdout, node.vtab)

    _ = _execute_code(node.code, node, on_stdout=node_stdout)
    node.isCached = True

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

def reset():
    global persistentState
    persistentState = {}
    for n in nodeMap.values():
        n.isCached = False
        n.vtab = {}
        n.stdout = []
