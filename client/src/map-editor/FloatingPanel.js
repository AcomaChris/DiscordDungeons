// --- FloatingPanel ---
// Reusable draggable/collapsible floating panel container.
// Positions persist in localStorage per panel ID.

const STORAGE_KEY_PREFIX = 'map-editor-panel-';

export class FloatingPanel {
  constructor({ title, id, x = 100, y = 100, width = 260, visible = true }) {
    this.id = id;
    this.title = title;
    this._visible = visible;
    this._collapsed = false;

    // Create DOM
    this.el = document.createElement('div');
    this.el.className = 'floating-panel';
    this.el.id = id;
    this.el.style.width = `${width}px`;

    // Titlebar
    this._titlebar = document.createElement('div');
    this._titlebar.className = 'floating-panel-titlebar';

    const titleEl = document.createElement('span');
    titleEl.className = 'floating-panel-title';
    titleEl.textContent = title;
    this._titlebar.appendChild(titleEl);

    const btnGroup = document.createElement('span');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '4px';

    this._collapseBtn = document.createElement('button');
    this._collapseBtn.className = 'floating-panel-btn';
    this._collapseBtn.textContent = '\u2212';
    this._collapseBtn.title = 'Collapse';
    this._collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });
    btnGroup.appendChild(this._collapseBtn);

    this._closeBtn = document.createElement('button');
    this._closeBtn.className = 'floating-panel-btn';
    this._closeBtn.textContent = '\u00d7';
    this._closeBtn.title = 'Close';
    this._closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    btnGroup.appendChild(this._closeBtn);

    this._titlebar.appendChild(btnGroup);
    this.el.appendChild(this._titlebar);

    // Content area
    this._content = document.createElement('div');
    this._content.className = 'floating-panel-content';
    this.el.appendChild(this._content);

    // Restore saved position or use defaults
    const saved = this._loadPosition();
    this.el.style.left = `${saved ? saved.x : x}px`;
    this.el.style.top = `${saved ? saved.y : y}px`;
    if (saved && saved.collapsed) this.toggleCollapse();

    // Drag handling
    this._isDragging = false;
    this._dragOffset = { x: 0, y: 0 };
    this._titlebar.addEventListener('mousedown', (e) => this._onDragStart(e));
    this._onDragMoveBound = (e) => this._onDragMove(e);
    this._onDragEndBound = () => this._onDragEnd();

    // Visibility
    if (!visible) this.el.style.display = 'none';

    // Mount
    const mount = document.getElementById('panel-mount') || document.body;
    mount.appendChild(this.el);
  }

  // --- Content ---

  setContent(domElement) {
    this._content.innerHTML = '';
    this._content.appendChild(domElement);
  }

  getContentElement() {
    return this._content;
  }

  // --- Visibility ---

  show() {
    this._visible = true;
    this.el.style.display = '';
  }

  hide() {
    this._visible = false;
    this.el.style.display = 'none';
    if (this.onClose) this.onClose();
  }

  toggle() {
    if (this._visible) this.hide();
    else this.show();
  }

  get isVisible() {
    return this._visible;
  }

  // --- Collapse ---

  toggleCollapse() {
    this._collapsed = !this._collapsed;
    this.el.classList.toggle('collapsed', this._collapsed);
    this._collapseBtn.textContent = this._collapsed ? '+' : '\u2212';
    this._savePosition();
  }

  // --- Drag ---

  _onDragStart(e) {
    // Only drag from titlebar, not buttons
    if (e.target.closest('.floating-panel-btn')) return;
    this._isDragging = true;
    const rect = this.el.getBoundingClientRect();
    this._dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.addEventListener('mousemove', this._onDragMoveBound);
    document.addEventListener('mouseup', this._onDragEndBound);
    e.preventDefault();
  }

  _onDragMove(e) {
    if (!this._isDragging) return;
    const x = e.clientX - this._dragOffset.x;
    const y = e.clientY - this._dragOffset.y;
    // Clamp to viewport
    const maxX = window.innerWidth - 40;
    const maxY = window.innerHeight - 40;
    this.el.style.left = `${Math.max(0, Math.min(maxX, x))}px`;
    this.el.style.top = `${Math.max(0, Math.min(maxY, y))}px`;
  }

  _onDragEnd() {
    this._isDragging = false;
    document.removeEventListener('mousemove', this._onDragMoveBound);
    document.removeEventListener('mouseup', this._onDragEndBound);
    this._savePosition();
  }

  // --- Persistence ---

  _savePosition() {
    try {
      const rect = this.el.getBoundingClientRect();
      localStorage.setItem(STORAGE_KEY_PREFIX + this.id, JSON.stringify({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        collapsed: this._collapsed,
      }));
    } catch { /* localStorage not available */ }
  }

  _loadPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + this.id);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // --- Callbacks ---
  onClose = null;

  // --- Cleanup ---

  destroy() {
    this.el.remove();
    document.removeEventListener('mousemove', this._onDragMoveBound);
    document.removeEventListener('mouseup', this._onDragEndBound);
  }
}
