//----------------------
// File: CodeField.js
//----------------------
export function CodeField(initialCode, onChange) {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
        position: "absolute",
        width: "calc(100% - 44px)",
        height: "calc(100% - 90px)",
        left: "38px",
        top: "60px",
        overflow: "hidden",
        border: "1px solid #444",
        borderRadius: "4px",
        background: "#111",
        boxSizing: "border-box",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "18px"
    });

    this.highlight = document.createElement("pre");
    this.highlight.className = "language-python";
    Object.assign(this.highlight.style, {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        padding: "6px",
        overflow: "hidden",
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        wordWrap: "break-word",
        background: "transparent"
    });

    this.code = document.createElement("code");
    this.code.className = "language-python";
    this.highlight.appendChild(this.code);

    this.textarea = document.createElement("textarea");
    this.textarea.value = initialCode;
    Object.assign(this.textarea.style, {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        resize: "none",
        border: "none",
        outline: "none",
        background: "transparent",
        color: "transparent",
        caretColor: "rgb(255, 0, 0)",
        padding: "6px",
        margin: 0,
        boxSizing: "border-box",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "18px",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordWrap: "break-word",
        zIndex: 1,
        pointerEvents: "auto"
    });
    this.textarea.spellcheck = false;

    const update = () => {
        onChange(this.textarea.value);
        this._updateHighlight();
    };

    this.textarea.oninput = update;
    this.textarea.onscroll = () => {
        this.highlight.scrollTop = this.textarea.scrollTop;
        this.highlight.scrollLeft = this.textarea.scrollLeft;
    };
    this.textarea.onkeydown = (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            const value = this.textarea.value;
            this.textarea.value = value.substring(0, start) + "    " + value.substring(end);
            this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
            update();
        }
    };

    this.container.appendChild(this.highlight);
    this.container.appendChild(this.textarea);
    this._updateHighlight();
}

CodeField.prototype._updateHighlight = function() {
    if (typeof Prism === "undefined" || !Prism.languages || !Prism.languages.python) {
        this.code.textContent = this.textarea.value;
        return;
    }
    this.code.innerHTML = Prism.highlight(this.textarea.value, Prism.languages.python, "python");
};

CodeField.prototype.getElement = function() {
    return this.container;
};

CodeField.prototype.setValue = function(code) {
    this.textarea.value = code;
    this._updateHighlight();
};