import '../styles/touch-controls.css';

// --- TouchManager ---
// Creates an HTML overlay with an analog joystick (left) and action buttons (right)
// for mobile play. Only activates on touch-capable devices.
// Provides getSnapshot() returning { moveX, moveY, sprint, jump } where
// moveX/moveY are floats in [-1, 1] from the joystick.

export class TouchManager {
  constructor() {
    this._moveX = 0;
    this._moveY = 0;
    this._jump = false;
    this._sprint = false;
    this._container = null;
    this._orientationQuery = null;
    this._onOrientationChange = null;

    // Joystick geometry (set during _buildDOM, updated on touch)
    this._baseRadius = 0;
    this._baseCenterX = 0;
    this._baseCenterY = 0;
    this._deadZone = 0.15;
    this._activePointerId = null;

    // Action button references
    this._btnJump = null;
    this._btnSprint = null;

    if (!TouchManager.isTouchDevice()) return;

    this._buildDOM();
    this._bindOrientation();
  }

  static isTouchDevice() {
    // ?touch=1 in the URL forces touch mode (used by /localtest mobile)
    if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // --- DOM ---

  _buildDOM() {
    const container = document.createElement('div');
    container.id = 'touch-controls';
    this._container = container;

    // --- Joystick (left side) ---
    const joystickArea = document.createElement('div');
    joystickArea.className = 'joystick-area';

    this._base = document.createElement('div');
    this._base.className = 'joystick-base';

    this._knob = document.createElement('div');
    this._knob.className = 'joystick-knob';

    this._base.appendChild(this._knob);
    joystickArea.appendChild(this._base);
    container.appendChild(joystickArea);

    // --- Action Buttons (right side) ---
    const actionArea = document.createElement('div');
    actionArea.className = 'action-buttons';

    this._btnJump = this._createButton('btn-action btn-jump', 'JUMP');
    this._btnSprint = this._createButton('btn-action btn-sprint', 'RUN');

    actionArea.appendChild(this._btnSprint);
    actionArea.appendChild(this._btnJump);
    container.appendChild(actionArea);

    document.body.appendChild(container);

    // --- Bind joystick touch events ---
    this._bindJoystick(joystickArea);

    // --- Bind action button events ---
    this._bindButton(this._btnJump,
      () => { this._jump = true; },
      () => { this._jump = false; },
    );
    this._bindButton(this._btnSprint,
      () => { this._sprint = true; },
      () => { this._sprint = false; },
    );
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

  // --- Joystick ---

  _bindJoystick(area) {
    area.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._activePointerId !== null) return;

      const touch = e.changedTouches[0];
      this._activePointerId = touch.identifier;
      this._updateBaseGeometry();
      this._processJoystickTouch(touch.clientX, touch.clientY);
    }, { passive: false });

    area.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._activePointerId) {
          this._processJoystickTouch(touch.clientX, touch.clientY);
          break;
        }
      }
    }, { passive: false });

    const onEnd = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this._activePointerId) {
          this._activePointerId = null;
          this._moveX = 0;
          this._moveY = 0;
          this._knob.style.transform = 'translate(-50%, -50%)';
          break;
        }
      }
    };

    area.addEventListener('touchend', onEnd, { passive: false });
    area.addEventListener('touchcancel', onEnd, { passive: false });
  }

  _updateBaseGeometry() {
    const rect = this._base.getBoundingClientRect();
    this._baseRadius = rect.width / 2;
    this._baseCenterX = rect.left + this._baseRadius;
    this._baseCenterY = rect.top + this._baseRadius;
  }

  _processJoystickTouch(clientX, clientY) {
    const dx = clientX - this._baseCenterX;
    const dy = clientY - this._baseCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = this._baseRadius;

    // Clamp to circle boundary
    let clampedDx = dx;
    let clampedDy = dy;
    if (dist > radius) {
      clampedDx = (dx / dist) * radius;
      clampedDy = (dy / dist) * radius;
    }

    const normDist = Math.min(dist / radius, 1);

    // Apply dead zone
    if (normDist < this._deadZone) {
      this._moveX = 0;
      this._moveY = 0;
    } else {
      // Remap from [deadZone, 1] to [0, 1] for smooth ramp
      const remapped = (normDist - this._deadZone) / (1 - this._deadZone);
      const angle = Math.atan2(dy, dx);
      this._moveX = Math.cos(angle) * remapped;
      this._moveY = Math.sin(angle) * remapped;
    }

    // Move knob visual
    this._knob.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;
  }

  // --- Ability Visibility ---

  setAbilityManager(abilityManager) {
    this._abilityManager = abilityManager;
    this._updateButtonVisibility();
  }

  _updateButtonVisibility() {
    if (!this._abilityManager || !this._container) return;
    if (this._btnJump) {
      this._btnJump.style.display = this._abilityManager.has('jump') ? '' : 'none';
    }
    if (this._btnSprint) {
      this._btnSprint.style.display = this._abilityManager.has('movement') ? '' : 'none';
    }
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
    return { moveX: this._moveX, moveY: this._moveY, sprint: this._sprint, jump: this._jump };
  }

  // --- Visibility ---

  show() {
    if (!this._container) return;
    this._container.classList.add('visible');
    // Override the hover+fine-pointer CSS hide when ?touch=1 is in the URL
    if (new URLSearchParams(window.location.search).get('touch') === '1') {
      this._container.classList.add('force-touch');
    }
  }

  hide() {
    if (this._container) this._container.classList.remove('visible');
  }

  // --- Cleanup ---

  destroy() {
    this._activePointerId = null;
    if (this._orientationQuery && this._onOrientationChange) {
      this._orientationQuery.removeEventListener('change', this._onOrientationChange);
    }
    if (this._container) {
      this._container.remove();
      this._container = null;
    }
  }
}
