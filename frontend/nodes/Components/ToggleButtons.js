//----------------------
// File: ToggleButtons.js
//----------------------
export function ToggleButtons(onToggle) {
    this.dom = document.createElement("div");
    Object.assign(this.dom.style, {
        position: "absolute",
        bottom: "0px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "4px",
        pointerEvents: "auto"
    });

    this.outputsBtn = this.createToggleButton("Outputs", () => onToggle('outputs'));
    this.vtableBtn = this.createToggleButton("Vtable", () => onToggle('vtable'));

    this.dom.appendChild(this.outputsBtn);
    this.dom.appendChild(this.vtableBtn);
}
ToggleButtons.prototype.createToggleButton = function(label, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
        padding: "2px 6px",
        fontSize: "10px",
        cursor: "pointer",
        backgroundColor: "#444",
        color: "#fff",
        border: "1px solid #666",
        borderRadius: "3px"
    });
    btn.onclick = onClick;
    return btn;
};
ToggleButtons.prototype.setActive = function(mode) {
    this.outputsBtn.style.backgroundColor = mode === 'outputs' ? "#666" : "#444";
    this.vtableBtn.style.backgroundColor = mode === 'vtable' ? "#666" : "#444";
};
ToggleButtons.prototype.getElement = function() {
    return this.dom;
};