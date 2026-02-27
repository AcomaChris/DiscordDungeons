import '../styles/touch-controls.css';

// --- TouchManager ---
// Creates an HTML overlay with touch buttons for mobile play.
// Only activates on touch-capable devices. Provides getSnapshot() for
// the same { moveX, jump } shape as InputManager.

export class TouchManager {
  constructor() {
    this._moveX = 0;
    this._jumpPressed = false;
    this._container = null;
    this._orientationQuery = null;
    this._onOrientationChange = null;

    if (!TouchManager.isTouchDevice()) return;

    this._buildDOM();
    this._bindOrientation();
  }

  static isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // --- DOM ---

  _buildDOM() {
    const container = document.createElement('div');
    container.id = 'touch-controls';
    this._container = container;

    const btnLeft = this._createButton('btn-left', '\u25C0');
    const btnRight = this._createButton('btn-right', '\u25B6');
    const btnJump = this._createButton('btn-jump', '\u25B2');

    container.append(btnLeft, btnRight, btnJump);
    document.body.appendChild(container);

    this._bindButton(btnLeft, () => { this._moveX = -1; }, () => { if (this._moveX === -1) this._moveX = 0; });
    this._bindButton(btnRight, () => { this._moveX = 1; }, () => { if (this._moveX === 1) this._moveX = 0; });
    this._bindButton(btnJump, () => { this._jumpPressed = true; }, () => {});
  }

  _createButton(className, label) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = label;
    return btn;
  }

  _bindButton(btn, onDown, onUp) {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onDown();
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      onUp();
    }, { passive: false });

    btn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      onUp();
    }, { passive: false });
  }

  // --- Orientation ---

  _bindOrientation() {
    this._orientationQuery = window.matchMedia('(orientation: portrait)');
    this._onOrientationChange = (e) => this._applyOrientation(e.matches);
    this._orientationQuery.addEventListener('change', this._onOrientationChange);
    this._applyOrientation(this._orientationQuery.matches);
  }

  _applyOrientation(isPortrait) {
    if (!this._container) return;
    this._container.classList.toggle('portrait', isPortrait);
    this._container.classList.toggle('landscape', !isPortrait);
  }

  // --- Snapshot ---

  getSnapshot() {
    const jump = this._jumpPressed;
    this._jumpPressed = false;
    return { moveX: this._moveX, jump };
  }

  // --- Visibility ---

  show() {
    if (this._container) this._container.classList.add('visible');
  }

  hide() {
    if (this._container) this._container.classList.remove('visible');
  }

  // --- Cleanup ---

  destroy() {
    if (this._orientationQuery && this._onOrientationChange) {
      this._orientationQuery.removeEventListener('change', this._onOrientationChange);
    }
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
