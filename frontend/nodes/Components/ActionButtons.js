//----------------------
// File: ActionButtons.js
//----------------------
export function ActionButtons(onAction) {
    this.dom = document.createElement("div");
    Object.assign(this.dom.style, {
        position: "absolute",
        top: "4px",
        right: "4px",
        display: "flex",
        gap: "4px",
        opacity: 0,
        transition: "opacity 0.2s",
        pointerEvents: "auto"
    });

    const btnConfigs = [
        { icon: "▶", color: "#e1f5fe", action: "run_context" },
        { icon: "P", color: "#fff9c4", action: "run_persistent" },
        { icon: "^", color: "#ffebee", action: "run_connected" }
    ];

    btnConfigs.forEach(cfg => {
        const button = document.createElement("button");
        button.textContent = cfg.icon;
        Object.assign(button.style, {
            width: "25px",
            height: "25px",
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: "3px",
            transition: "background 0.2s",
            backgroundColor: cfg.color
        });
        button.onclick = () => onAction(cfg.action);
        this.dom.appendChild(button);
    });
}
ActionButtons.prototype.getElement = function() {
    return this.dom;
};