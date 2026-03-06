// --- InteractionPrompt ---
// Floating "E" key indicator shown above interactable objects when the
// player is within range. Fades in/out smoothly. One instance reused
// across all objects — moves to whichever object is currently targeted.
// AGENT: Uses DOM overlay, not Phaser sprites, so it renders above the
// game canvas at native resolution.

const FADE_DURATION = 150; // ms

export class InteractionPrompt {
  constructor() {
    this._el = null;
    this._visible = false;
    this._fadeTimeout = null;
  }

  // Create the DOM element. Call once during scene create.
  create() {
    this._el = document.createElement('div');
    this._el.className = 'interaction-prompt';
    this._el.textContent = 'E';
    this._el.style.cssText = `
      position: absolute;
      pointer-events: none;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      color: #fff;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 3px;
      padding: 1px 5px;
      opacity: 0;
      transition: opacity ${FADE_DURATION}ms ease;
      z-index: 100;
      transform: translate(-50%, -100%);
    `;
    document.body.appendChild(this._el);
  }

  // Show the prompt above a world position.
  // screenX, screenY are the screen-space coordinates of the object.
  show(screenX, screenY, text) {
    if (!this._el) return;
    if (this._fadeTimeout) {
      clearTimeout(this._fadeTimeout);
      this._fadeTimeout = null;
    }
    this._el.textContent = text || 'E';
    this._el.style.left = `${screenX}px`;
    this._el.style.top = `${screenY - 8}px`;
    this._el.style.opacity = '1';
    this._visible = true;
  }

  hide() {
    if (!this._el || !this._visible) return;
    this._el.style.opacity = '0';
    this._visible = false;
  }

  get visible() {
    return this._visible;
  }

  destroy() {
    if (this._fadeTimeout) clearTimeout(this._fadeTimeout);
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._visible = false;
  }
}
