// CodeField.js

const PYTHON_KEYWORDS = [
    "False", "None", "True", "and", "as", "assert", "async", "await",
    "break", "class", "continue", "def", "del", "elif", "else", "except",
    "finally", "for", "from", "global", "if", "import", "in", "is",
    "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
    "try", "while", "with", "yield"
];

const PYTHON_BUILTINS = [
    "abs", "all", "any", "bin", "bool", "bytearray", "bytes", "callable",
    "chr", "classmethod", "compile", "complex", "delattr", "dict", "dir",
    "divmod", "enumerate", "eval", "exec", "filter", "float", "format",
    "frozenset", "getattr", "globals", "hasattr", "hash", "help", "hex",
    "id", "input", "int", "isinstance", "issubclass", "iter", "len",
    "list", "locals", "map", "max", "memoryview", "min", "next", "object",
    "oct", "open", "ord", "pow", "print", "property", "range", "repr",
    "reversed", "round", "set", "setattr", "slice", "sorted", "staticmethod",
    "str", "sum", "super", "tuple", "type", "vars", "zip"
];

const PYTHON_COMPLETION_SOURCE = [...new Set([...PYTHON_KEYWORDS, ...PYTHON_BUILTINS])];
const registeredCompletionLanguages = new Set();
let scrollbarStylesAdded = false;

function buildPythonCompletionItems(prefix = "") {
    const cleanPrefix = prefix || "";
    const suggestions = new Map();

    for (const item of PYTHON_COMPLETION_SOURCE) {
        if (!item.toLowerCase().startsWith(cleanPrefix.toLowerCase())) {
            continue;
        }

        suggestions.set(item, {
            label: item,
            kind: PYTHON_KEYWORDS.includes(item) ? 14 : 21,
            insertText: item,
            detail: PYTHON_KEYWORDS.includes(item) ? "Python keyword" : "Python builtin"
        });
    }

    return Array.from(suggestions.values());
}

export function CodeField({
    initialCode = "",
    onChange = () => {},
    language = "python",
    style = {}
} = {}) {
    this.language = language;
    this.onChange = onChange;
    this._isSettingValue = false;
    this._lastValue = initialCode;
    this._pendingValue = initialCode;

    const baseContainerStyle = {
        position: "absolute",
        overflow: "hidden",
        border: "1px solid #444",
        borderRadius: "4px",
        background: "#111",
        boxSizing: "border-box",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "18px"
    };

    this.container = document.createElement("div");
    Object.assign(this.container.style, baseContainerStyle, style.container);
    this.container.style.pointerEvents = "auto";

    this.editorHost = document.createElement("div");
    Object.assign(this.editorHost.style, {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "transparent"
    });

    this.container.appendChild(this.editorHost);
    this.textarea = null;
    this.editor = null;

    this._initEditor(initialCode);
}

CodeField.prototype._ensureMonacoTheme = function () {
    if (typeof window === "undefined" || !window.monaco) return;

    window.monaco.editor.defineTheme("graphnote-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "6A9955" },
            { token: "keyword", foreground: "C586C0" },
            { token: "string", foreground: "CE9178" },
            { token: "number", foreground: "B5CEA8" },
            { token: "identifier", foreground: "9CDCFE" },
            { token: "function", foreground: "DCDCAA" }
        ],
        colors: {
            "editor.background": "#111111",
            "editorLineNumber.foreground": "#6B7280",
            "editorLineNumber.activeForeground": "#D1D5DB",
            "editorCursor.foreground": "#FF3B30",
            "editor.selectionBackground": "#264F78",
            "editor.inactiveSelectionBackground": "#3A3D41"
        }
    });
};

CodeField.prototype._ensureScrollbarStyles = function () {
    if (scrollbarStylesAdded || typeof document === "undefined") return;

    const style = document.createElement("style");
    style.textContent = `
        .monaco-editor:not(.focused) .scrollbar.vertical,
        .monaco-editor:not(.focused) .scrollbar.horizontal {
            opacity: 0;
            pointer-events: none;
        }
        .monaco-editor.focused .scrollbar.vertical,
        .monaco-editor.focused .scrollbar.horizontal {
            opacity: 1;
            transition: opacity 120ms ease;
        }
    `;
    document.head.appendChild(style);
    scrollbarStylesAdded = true;
};

CodeField.prototype._notifyChange = function () {
    if (this._isSettingValue) return;

    const value = this.getValue();
    this._lastValue = value;
    this.onChange(value);
};

CodeField.prototype._registerPythonCompletions = function () {
    if (
        typeof window === "undefined" ||
        !window.monaco ||
        this.language !== "python" ||
        registeredCompletionLanguages.has(this.language)
    ) {
        return;
    }

    registeredCompletionLanguages.add(this.language);

    window.monaco.languages.registerCompletionItemProvider(this.language, {
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const prefix = word.word || "";
            const suggestions = new Map(
                buildPythonCompletionItems(prefix).map((item) => [item.label, item])
            );

            const currentText = model.getValue();
            const variableNames = new Set();
            const regex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
            let match;

            while ((match = regex.exec(currentText)) !== null) {
                const name = match[1];
                if (!PYTHON_KEYWORDS.includes(name) && !PYTHON_BUILTINS.includes(name)) {
                    variableNames.add(name);
                }
            }

            for (const name of variableNames) {
                if (!name.toLowerCase().startsWith(prefix.toLowerCase())) continue;
                if (suggestions.has(name)) continue;
                suggestions.set(name, {
                    label: name,
                    kind: 4,
                    insertText: name,
                    detail: "Variable in current code"
                });
            }

            return { suggestions: Array.from(suggestions.values()) };
        },
        triggerCharacters: ["."]
    });
};

CodeField.prototype._initEditor = function (initialCode) {
    if (typeof window === "undefined") return;

    if (!window.require) {
        this._initFallbackEditor(initialCode);
        return;
    }

    window.require.config({
        paths: {
            vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs"
        }
    });

    window.require(["vs/editor/editor.main"], () => {
        if (!window.monaco) {
            this._initFallbackEditor(initialCode);
            return;
        }

        const initialValue = this._pendingValue ?? initialCode;
        this._ensureMonacoTheme();
        this._ensureScrollbarStyles();
        this.editor = window.monaco.editor.create(this.editorHost, {
            value: initialValue,
            language: this.language,
            theme: "graphnote-dark",
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontFamily: "Consolas, 'Courier New', monospace",
            fontSize: 12,
            lineNumbersMinChars: 3,
            padding: { top: 6, bottom: 6 },
            tabSize: 4,
            insertSpaces: true,
            smoothScrolling: true,
            hideCursorInOverviewRuler: true,
            scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false
            },
            quickSuggestions: { other: true, comments: true, strings: true },
            wordBasedSuggestions: "off",
            suggestionTimeout: 200,
            renderWhitespace: "selection"
        });

        this._registerPythonCompletions();
        this.editor.onDidChangeModelContent(() => this._notifyChange());
        this.editor.onDidBlurEditorWidget(() => this._notifyChange());
        this.textarea = this.editorHost;
        this._lastValue = this.editor.getValue();
        this._pendingValue = this._lastValue;
    }, () => {
        this._initFallbackEditor(initialCode);
    });
};

CodeField.prototype._initFallbackEditor = function (initialCode) {
    if (this.editorHost && this.editorHost.parentNode) {
        this.editorHost.parentNode.removeChild(this.editorHost);
    }
    this.editorHost = null;

    this.highlight = document.createElement("pre");
    this.highlight.className = `language-${this.language}`;

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
    this.code.className = `language-${this.language}`;
    this.highlight.appendChild(this.code);

    this.textarea = document.createElement("textarea");
    this.textarea.value = initialCode;
    this.textarea.spellcheck = false;

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

    const update = () => {
        this._lastValue = this.textarea.value;
        this.onChange(this.textarea.value);
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
            this.textarea.selectionStart = start + 4;
            this.textarea.selectionEnd = start + 4;
            update();
        }
    };

    this.container.appendChild(this.highlight);
    this.container.appendChild(this.textarea);
    this._updateHighlight();
};

CodeField.prototype._updateHighlight = function () {
    if (this.editor) return;

    const code = this.getValue();

    if (
        typeof Prism === "undefined" ||
        !Prism.languages ||
        !Prism.languages[this.language]
    ) {
        this.code.textContent = code;
        return;
    }

    this.code.innerHTML = Prism.highlight(
        code,
        Prism.languages[this.language],
        this.language
    );
};

CodeField.prototype.focus = function () {
    if (this.editor) {
        this.editor.focus();
        return;
    }

    if (this.textarea && typeof this.textarea.focus === "function") {
        this.textarea.focus();
    }
};

CodeField.prototype.getElement = function() {
    return this.container;
};

CodeField.prototype.setValue = function(code) {
    this._pendingValue = code ?? "";

    if (this.editor) {
        if (this.editor.getValue() === this._pendingValue) {
            this._lastValue = this._pendingValue;
            return;
        }

        this._isSettingValue = true;
        this.editor.setValue(this._pendingValue);
        this._lastValue = this.editor.getValue();
        this._pendingValue = this._lastValue;
        this._isSettingValue = false;
        return;
    }

    if (this.textarea && typeof this.textarea.value !== "undefined") {
        if (this.textarea.value === this._pendingValue) {
            this._lastValue = this._pendingValue;
            return;
        }

        this.textarea.value = this._pendingValue;
        this._lastValue = this.textarea.value;
        this._pendingValue = this._lastValue;
        if (this.code) {
            this._updateHighlight();
        }
    }
};

CodeField.prototype.getValue = function () {
    if (this.editor) {
        return this.editor.getValue();
    }

    if (this.textarea && typeof this.textarea.value !== "undefined") {
        return this.textarea.value;
    }

    return this._lastValue;
};