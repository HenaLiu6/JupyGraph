import { getDOMLayer } from "../domLayer.js";
import { CodeField } from "./Components/CodeField.js";
import { ActionButtons } from "./Components/ActionButtons.js";
import { ToggleButtons } from "./Components/ToggleButtons.js";
import { OutputPanel } from "./Components/OutputPanel.js";

function CodeNode() {
    this.addInput("in1", "any");
    this.addOutput("out", "any");
    this.inputCount = 1;
    this.properties = { code: "x = 2\nprint(x*x)", vtab: {}, stdout: "" };
    this.size = [300, 220];
    this.displayMode = 'outputs';

    this.codeField = new CodeField({
        initialCode: this.properties.code,
        onChange: (code) => {
            this.setCode(code);
        },
        language: "python",
        style: {
            container: {
                width: "calc(100% - 44px)", 
                height: "calc(100% - 90px)", 
                left: "38px", 
                top: "60px",
            }
        }
    });
    this.actionButtons = new ActionButtons(action => {
        if (this.graph && this.graph.onNodeAction) {
            this.graph.onNodeAction(action, this);
        }
    });
    this.toggleButtons = new ToggleButtons(mode => this.toggleDisplay(mode));
    this.outputPanel = new OutputPanel(6, 16);
    this.collapsedPreview = this.createCollapsedPreview();

    this.onDrawBackground = function() {
        this.updateCollapsedState();
    };

    this.initUI();
}

CodeNode.prototype.createCollapsedPreview = function() {
    const preview = document.createElement("div");
    Object.assign(preview.style, {
        position: "absolute",
        left: "5px",
        width: "200px",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: "10px",
        padding: "6px",
        overflowY: "auto",
        display: "none",
        pointerEvents: "auto",
        whiteSpace: "pre-wrap",
        lineHeight: "16px",
        boxSizing: "border-box",
        bottom: "-30px"
    });
    return preview;
};

CodeNode.prototype.initUI = function() {
    this.dom = document.createElement("div");
    Object.assign(this.dom.style, { pointerEvents: "none", position: "absolute", zIndex: 10 });

    this.dom.appendChild(this.codeField.getElement());
    this.dom.appendChild(this.actionButtons.getElement());
    this.dom.appendChild(this.toggleButtons.getElement());
    this.dom.appendChild(this.outputPanel.getElement());
    this.dom.appendChild(this.collapsedPreview);

    this.dom.onmouseenter = () => this.actionButtons.getElement().style.opacity = 1;
    this.dom.onmouseleave = () => this.actionButtons.getElement().style.opacity = 0;

    this.toggleButtons.setActive(this.displayMode);
    this.outputPanel.setVisible(true);
    this.outputPanel.setText(this.properties.stdout);
    this.updateCollapsedState();
};

CodeNode.prototype.toggleDisplay = function(mode) {
    if (this.displayMode === mode) {
        this.displayMode = null;
        this.outputPanel.setVisible(false);
        this.toggleButtons.setActive(null);
    } else {
        this.displayMode = mode;
        this.outputPanel.setVisible(true);
        this.toggleButtons.setActive(mode);
        this.updateDisplay();
    }
};

CodeNode.prototype.updateDisplay = function() {
    let text = "";
    if (this.displayMode === 'outputs') {
        text = this.properties.stdout || "";
    } else if (this.displayMode === 'vtable') {
        text = JSON.stringify(this.properties.vtab, null, 2) || "{}";
    }
    this.outputPanel.setText(text);
    this.updateCollapsedState();
};

CodeNode.prototype.updateCollapsedState = function() {
    const collapsed = this.collapsed || (this.flags && this.flags.collapsed);
    const showPreview = Boolean(collapsed);

    this.codeField.getElement().style.display = showPreview ? "none" : "block";
    this.actionButtons.getElement().style.display = showPreview ? "none" : "flex";
    this.toggleButtons.getElement().style.display = showPreview ? "none" : "flex";
    this.outputPanel.setVisible(!showPreview && this.displayMode !== null);
    this.collapsedPreview.style.display = showPreview ? "block" : "none";

    if (showPreview) {
        const vtab = this.properties.vtab || {};
        const functions = Object.keys(vtab).filter(key => {
            const val = vtab[key];
            return typeof val === 'string' && val.startsWith('<function ');
        }).map(key => {
            const match = vtab[key].match(/^<function (\w+)/);
            return match ? match[1] : key;
        });
        const text = functions.length ? functions.join('\n') : '(no function declarations)';
        this.collapsedPreview.textContent = text;
        const lineCount = text.split('\n').length;
        const height = Math.max(20, lineCount * 16 + 12);
        this.collapsedPreview.style.height = `${height}px`;
        this.collapsedPreview.style.bottom = `-${height + 10}px`;
    }
};

CodeNode.prototype.ensureOpenInput = function() {
    const hasOpenInput = this.inputs ? this.inputs.some(input => input.link == null) : false;
    if (!hasOpenInput) {
        const prevSize = this.size ? [this.size[0], this.size[1]] : null;
        this.inputCount += 1;
        this.addInput(`in${this.inputCount}`, "any");
        if (prevSize) {
            this.size = prevSize;
        }
        if (this.graph) {
            this.graph.setDirtyCanvas(true);
        }
    }
};

CodeNode.prototype.onConnectInput = function() {
    this.ensureOpenInput();
};

CodeNode.prototype.onDisconnectInput = function() {
};

CodeNode.prototype.onConnectionsChange = function() {
    this.ensureOpenInput();
};

CodeNode.prototype.extractFunctionDeclarations = function(code) {
    const lines = code.split("\n");
    const declarations = [];
    const declarationRegex = /^\s*function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)/;
    const expressionRegex = /^\s*[A-Za-z_$][\w$]*\s*=\s*function\s*\([^)]*\)/;
    const arrowRegex = /^\s*[A-Za-z_$][\w$]*\s*=\s*\(?[^)]*\)?\s*=>\s*\{/;

    for (const line of lines) {
        if (declarationRegex.test(line) || expressionRegex.test(line) || arrowRegex.test(line)) {
            declarations.push(line.trim());
        }
    }
    return declarations;
};

CodeNode.prototype.onAdded = function() {
    if (this.codeField && this.properties && typeof this.properties.code === "string") {
        this.codeField.setValue(this.properties.code);
    }

    this.ensureOpenInput();
    const layer = getDOMLayer();
    if (layer && this.dom.parentNode !== layer) {
        layer.appendChild(this.dom);
    }
};

CodeNode.prototype.setCode = function(code) {
    if (this.properties.code === code) return;
    this.properties.code = code;

    // Push to inline editor (setValue does not fire events, so no loop)
    if (this.codeField) {
        this.codeField.setValue(code);
    }

    if (this.graph) {
        this.graph.setDirtyCanvas(true, true);
    }

    if (window.workflowManager && typeof window.workflowManager.scheduleSave === 'function') {
        window.workflowManager.scheduleSave();
    }
};


CodeNode.prototype.onRemoved = function() {
    this.dom.remove();
};

CodeNode.title = "Code Node";
export { CodeNode };