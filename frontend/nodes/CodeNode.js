import { getDOMLayer } from "../domLayer.js";

// CodeNode.js
function CodeNode() {
    this.addInput("in", "any");
    this.addOutput("out", "any");
    this.properties = { code: "x = 2\nprint(x*x)" };
    this.size = [300, 220];

    this.initUI();
}

CodeNode.prototype.initUI = function() {
    this.dom = document.createElement("div");
    Object.assign(this.dom.style, { pointerEvents: "none", position: "absolute", zIndex: 10 });

    // Textarea Setup
    this.codeArea = document.createElement("textarea");
    this.codeArea.value = this.properties.code;
    
    Object.assign(this.codeArea.style, {
        position: "absolute",
        resize: "none",
        background: "#111",
        color: "#0f0",
        border: "1px solid #444",
        fontFamily: "monospace",
        fontSize: "12px",
        padding: "6px",
        zIndex: 10,
        pointerEvents: "auto",
        width: "calc(100% - 25px)",
        height: "calc(100% - 90px)",
        left: "5px",
        top: "60px",
    });


    this.codeArea.oninput = () => { this.properties.code = this.codeArea.value; };

    // Buttons Container
    this.buttons = document.createElement("div");
    Object.assign(this.buttons.style, {
        position: "absolute",
        top: "4px",
        right: "4px",
        display: "flex",
        gap: "4px",
        opacity: 0,
        transition: "opacity 0.2s",
        pointerEvents: "auto"
    });

    // Setup Buttons via a simple loop to keep it clean
    const btnConfigs = [
        { icon: "▶", color: "#e1f5fe", action: "run_context" },
        { icon: "P", color: "#fff9c4", action: "run_persistent" },
        { icon: "^", color: "#ffebee", action: "run_connected" }
    ];

    btnConfigs.forEach(cfg => {
        const btn = this.createBaseButton(cfg.icon, cfg.color);
        btn.onclick = () => {
            if (this.graph && this.graph.onNodeAction) {
                this.graph.onNodeAction(cfg.action, this);
            }
        };
    });
    this.dom.onmouseenter = () => this.buttons.style.opacity = 1;
    this.dom.onmouseleave = () => this.buttons.style.opacity = 0;

    this.dom.appendChild(this.codeArea);
    this.dom.appendChild(this.buttons);
};

/**
 * Interface Helper: Creates a button with base styles and unique color.
 */
CodeNode.prototype.createBaseButton = function(icon, bgColor) {
    const btn = document.createElement("button");
    btn.textContent = icon;
    
    Object.assign(btn.style, {
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
        backgroundColor: bgColor // Added color as a parameter for cleanliness
    });

    this.buttons.appendChild(btn);
    return btn; 
};

CodeNode.prototype.onAdded = function() {
  getDOMLayer().appendChild(this.dom);
};

CodeNode.prototype.onRemoved = function() {
  this.dom.remove();
};

CodeNode.title = "Code Node";
LiteGraph.registerNodeType("basic/code", CodeNode);