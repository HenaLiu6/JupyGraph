//----------------------
// File: OutputPanel.js
//----------------------
export function OutputPanel(maxLines, lineHeight) {
    this.maxLines = maxLines;
    this.lineHeight = lineHeight;
    this.expanded = false;
    
    this.collapsedMaxHeight = maxLines * lineHeight + 14; 

    this.root = document.createElement("div");
    Object.assign(this.root.style, {
        position: "absolute",
        left: "5px",
        width: "calc(100% - 10px)",
        background: "#222",
        color: "#0f0",
        border: "1px solid #444",
        fontFamily: "monospace",
        fontSize: "10px",
        padding: "8px 6px 6px 6px",
        overflowY: "auto",
        display: "none",
        pointerEvents: "auto",
        boxSizing: "border-box",
        zIndex: "10"
    });

    this.content = document.createElement("div");
    Object.assign(this.content.style, {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        width: "100%"
    });

    this.expandBtn = document.createElement("button");
    this.expandBtn.textContent = "Show all";
    Object.assign(this.expandBtn.style, {
        position: "absolute",
        top: "4px",
        right: "6px",
        fontSize: "10px",
        padding: "2px 4px",
        cursor: "pointer",
        backgroundColor: "#333",
        color: "#fff",
        border: "1px solid #555",
        borderRadius: "3px",
        display: "none",
        pointerEvents: "auto",
        zIndex: "11"
    });
    
    this.expandBtn.onclick = () => {
        this.expanded = !this.expanded;
        this.updateSize();
    };

    this.root.appendChild(this.content);
    this.root.appendChild(this.expandBtn);
    this._sizeUpdateRAF = null;
}

OutputPanel.prototype.getElement = function() {
    return this.root;
};

OutputPanel.prototype.setVisible = function(visible) {
    this.root.style.display = visible ? "block" : "none";
};

OutputPanel.prototype.setOutputs = function(outputsArray) {
    this.content.innerHTML = ""; // Clear old visual outputs
    
    if (!outputsArray || outputsArray.length === 0) {
        this.updateSize();
        return;
    }

    outputsArray.forEach(output => {
        if (output.type === "text") {
            const pre = document.createElement("pre");
            pre.textContent = output.text;
            Object.assign(pre.style, {
                margin: "0",
                padding: "0",
                whiteSpace: "pre-wrap",
                lineHeight: `${this.lineHeight}px`,
                color: "#0f0"
            });
            this.content.appendChild(pre);
        } 
        else if (output.type === "image") {
            const img = document.createElement("img");
            img.src = `data:${output.mime_type};base64,${output.data}`;
            Object.assign(img.style, {
                maxWidth: "100%",
                height: "auto",
                border: "1px solid #333",
                borderRadius: "2px",
                marginTop: "4px",
                marginBottom: "4px",
                display: "block"
            });
            
            // Images take time to load base64 data strings into the DOM renderer.
            // We recalculate sizing parameters when the layout knows its real dimensions.
            img.onload = () => this.updateSize();
            this.content.appendChild(img);
        } 
        else if (output.type === "error") {
            const errorPre = document.createElement("pre");
            errorPre.textContent = output.message;
            Object.assign(errorPre.style, {
                margin: "0",
                padding: "4px",
                whiteSpace: "pre-wrap",
                backgroundColor: "#311",
                color: "#ff6b6b",
                borderLeft: "3px solid #f44336"
            });
            this.content.appendChild(errorPre);
        }
    });

    this.updateSize();
};

OutputPanel.prototype.updateSize = function() {
    if (typeof window === 'undefined') {
        return;
    }

    if (this._sizeUpdateRAF !== null) {
        window.cancelAnimationFrame(this._sizeUpdateRAF);
    }

    this._sizeUpdateRAF = window.requestAnimationFrame(() => {
        this._sizeUpdateRAF = null;

        const style = window.getComputedStyle(this.root);
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const borderTop = parseFloat(style.borderTopWidth) || 0;
        const borderBottom = parseFloat(style.borderBottomWidth) || 0;
        const extras = paddingTop + paddingBottom + borderTop + borderBottom;

        const contentHeight = this.content.scrollHeight + extras;
        const needsExpand = contentHeight > this.collapsedMaxHeight + extras;

        let finalHeight;

        if (needsExpand && !this.expanded) {
            finalHeight = this.collapsedMaxHeight;
            this.root.style.overflowY = "auto";
        } else {
            finalHeight = contentHeight;
            this.root.style.overflowY = "hidden";
        }

        this.root.style.height = `${finalHeight}px`;
        this.root.style.bottom = `-${finalHeight + 10}px`;

        this.expandBtn.style.display = needsExpand ? "block" : "none";
        this.expandBtn.textContent = this.expanded ? "Collapse" : "Show all";

        if (!needsExpand) {
            this.expanded = false;
        }
    });
};