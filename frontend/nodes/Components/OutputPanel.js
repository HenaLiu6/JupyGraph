//----------------------
// File: OutputPanel.js
//----------------------
export function OutputPanel(maxLines, lineHeight) {
    this.maxLines = maxLines;
    this.lineHeight = lineHeight;
    this.expanded = false;

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
        whiteSpace: "pre-wrap",
        lineHeight: `${lineHeight}px`,
        boxSizing: "border-box"
    });

    this.content = document.createElement("div");
    Object.assign(this.content.style, {
        display: "block",
        whiteSpace: "pre-wrap"
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
        pointerEvents: "auto"
    });
    this.expandBtn.onclick = () => {
        this.expanded = !this.expanded;
        this.updateSize(this.content.textContent);
    };

    this.root.appendChild(this.content);
    this.root.appendChild(this.expandBtn);
}
OutputPanel.prototype.getElement = function() {
    return this.root;
};
OutputPanel.prototype.setVisible = function(visible) {
    this.root.style.display = visible ? "block" : "none";
};
OutputPanel.prototype.setText = function(text) {
    this.content.textContent = text || "";
    this.updateSize(this.content.textContent);
};
OutputPanel.prototype.updateSize = function(text) {
    const lineCount = Math.max(1, text.split("\n").length);
    const visibleLines = this.expanded ? lineCount : Math.min(lineCount, this.maxLines);
    const height = visibleLines * this.lineHeight + 14;
    this.root.style.height = `${height}px`;
    this.root.style.bottom = `-${height + 10}px`;

    const needsExpand = lineCount > this.maxLines;
    this.expandBtn.style.display = needsExpand ? "block" : "none";
    this.expandBtn.textContent = this.expanded ? "Collapse" : "Show all";
    if (!needsExpand) {
        this.expanded = false;
    }
};