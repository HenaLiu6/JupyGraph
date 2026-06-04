def patch_matplotlib(local_thread):
    import io
    import base64
    import threading

    from outputTypes import mime_output

    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.figure as mpl_fig

    if getattr(plt, "_patched_for_engine", False):
        return

    def jupy_show():
        callback = getattr(local_thread, "callback", None)

        for num in plt.get_fignums():
            fig = plt.figure(num)

            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)

            mime_dict = mime_output("image/png", buf.getvalue())

            if callback:
                callback(mime_dict)

        plt.close('all')

    def fig_show(self):
        callback = getattr(local_thread, "callback", None)

        buf = io.BytesIO()
        self.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)

        mime_dict = mime_output("image/png", buf.getvalue())

        if callback:
            callback(mime_dict)

    mpl_fig.Figure.show = fig_show
    plt.show = jupy_show

    plt._patched_for_engine = True