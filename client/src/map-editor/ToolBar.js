// --- ToolBar ---
// Tool button row with selection state. Each button shows "Name (K)"
// where K is the keyboard shortcut. Lives inside the #tool-buttons div.

// @doc-creator-tools 01:Map Editor > Keyboard Shortcuts
// | Shortcut | Action |
// |---|---|
// | `B` | **Brush** tool |
// | `E` | **Eraser** tool |
// | `R` | **Rectangle Fill** tool |
// | `G` | **Flood Fill** tool |
// | `L` | **Line** tool |
// | `S` | **Select** tool |
// | `O` | **Object** tool |
// | `1`-`7` | Quick layer switch |
// | `Ctrl+S` | Export map |
// | `Ctrl+G` | Toggle grid |
// | `Ctrl+Z` | Undo |
// | `Ctrl+Shift+Z` | Redo |
// | `Space+Click` | Pan the viewport |
// | `Scroll` | Zoom in/out |

export class ToolBar {
  constructor(containerEl, tools) {
    this._container = containerEl;
    this._tools = tools;          // [{name, shortcut, tool}]
    this._buttons = new Map();    // name → button element
    this._activeTool = null;

    // Callback — set by owner to handle tool switches
    this.onToolSelect = null;

    this._build();
  }

  // --- Build DOM ---

  _build() {
    this._container.innerHTML = '';

    for (const { name, shortcut, tool } of this._tools) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-tool';
      btn.textContent = `${name} (${shortcut})`;
      btn.addEventListener('click', () => {
        this.setActiveTool(tool);
        if (this.onToolSelect) this.onToolSelect(tool);
      });

      this._container.appendChild(btn);
      this._buttons.set(name, { el: btn, tool });
    }
  }

  // --- Active state ---

  setActiveTool(toolInstance) {
    this._activeTool = toolInstance;
    for (const { el, tool } of this._buttons.values()) {
      el.classList.toggle('active', tool === toolInstance);
    }
  }

  selectByName(name) {
    const entry = this._buttons.get(name);
    if (!entry) return;
    this.setActiveTool(entry.tool);
    if (this.onToolSelect) this.onToolSelect(entry.tool);
  }
}
