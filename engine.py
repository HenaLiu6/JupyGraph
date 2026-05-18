import sys
import traceback
import io

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
        self.stdout = ""
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


def execute_graph(target_node_id, on_output=None):
    target_id = str(target_node_id)
    node = nodeMap[target_id]
    _recursive_execute(node, on_output=on_output)
    sync_to_persistent(node)


def execute_persistent(node, on_output=None):
    def persistent_stdout(stdout_text):
        if on_output:
            on_output(node.id, stdout_text, persistentState)

    stdout, _ = _execute_code(node.code, persistentState, on_stdout=persistent_stdout if on_output else None)
    vtab = dict(persistentState)

    # Update the node in nodeMap
    if node.id in nodeMap:
        nodeMap[node.id].stdout = stdout
        nodeMap[node.id].vtab = vtab


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


def _execute_code(code, namespace, on_stdout=None):
    class stdout_writer:
        def __init__(self, callback):
            self.buffer = ""
            self.callback = callback

        def write(self, text):
            if text is None:
                return
            self.buffer += str(text)
            if self.callback:
                self.callback(self.buffer)

        def flush(self):
            if self.callback:
                self.callback(self.buffer)

        def isatty(self):
            return False

    old_stdout = sys.stdout
    sys.stdout = stdout_writer(on_stdout)
    had_builtins = "__builtins__" in namespace
    namespace["__builtins__"] = __builtins__
    try:
        exec(code, namespace, namespace)
        stdout = sys.stdout.buffer
        error = False
    except Exception:
        error_text = _format_user_traceback()
        current_output = sys.stdout.buffer
        if current_output:
            stdout = current_output + "\n" + error_text
        else:
            stdout = error_text
        error = True
    finally:
        sys.stdout = old_stdout
        if not had_builtins:
            namespace.pop("__builtins__", None)
    return stdout, error

def _recursive_execute(node, on_output=None):
    if node.isCached:
        return
    for parent in node.inputs:
        _recursive_execute(nodeMap[parent], on_output=on_output)

    def node_stdout(stdout_text):
        node.stdout = stdout_text
        if on_output:
            on_output(node.id, stdout_text, node.vtab)

    node.stdout, _ = _execute_code(node.code, node, on_stdout=node_stdout if on_output else None)
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

