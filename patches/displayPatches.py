import threading
from patches.matplotlib.matplotlib_patch import *

_thread_local = threading.local()

patch_matplotlib(_thread_local)