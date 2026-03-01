import '../styles/touch-controls.css';

// --- TouchManager ---
// Creates an HTML overlay with a D-pad for mobile play.
// Only activates on touch-capable devices. Provides getSnapshot() for
// the same { moveX, moveY } shape as InputManager.

export class TouchManager {
  constructor() {
    this._moveX = 0;
    this._moveY = 0;
    this._jump = false;
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

    const dpad = document.createElement('div');
    dpad.className = 'dpad';

    const btnUp = this._createButton('btn-up', '\u25B2');
    const btnDown = this._createButton('btn-down', '\u25BC');
    const btnLeft = this._createButton('btn-left', '\u25C0');
    const btnRight = this._createButton('btn-right', '\u25B6');

    dpad.append(btnUp, btnLeft, btnRight, btnDown);
    container.appendChild(dpad);

    // Jump button (right side)
    const btnJump = this._createButton('btn-jump', '\u25B2');
    container.appendChild(btnJump);

    document.body.appendChild(container);

    this._bindButton(btnUp, () => { this._moveY = -1; }, () => { if (this._moveY === -1) this._moveY = 0; });
    this._bindButton(btnDown, () => { this._moveY = 1; }, () => { if (this._moveY === 1) this._moveY = 0; });
    this._bindButton(btnLeft, () => { this._moveX = -1; }, () => { if (this._moveX === -1) this._moveX = 0; });
    this._bindButton(btnRight, () => { this._moveX = 1; }, () => { if (this._moveX === 1) this._moveX = 0; });
    this._bindButton(btnJump, () => { this._jump = true; }, () => { this._jump = false; });
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
    return { moveX: this._moveX, moveY: this._moveY, sprint: false, jump: this._jump };
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
