// --- Speech Bubble ---
// Floating text above an NPC's head. Shows dialogue, holds for a duration,
// then fades out. Repositions each frame to follow the NPC.

const PADDING_X = 6;
const PADDING_Y = 4;
const MAX_WIDTH = 120;
const FADE_DURATION = 800; // ms for fade-out at end of display

export class SpeechBubble {
  constructor(scene) {
    this.scene = scene;
    this._bg = null;
    this._text = null;
    this._timer = null;
    this._visible = false;
  }

  // Display text at (x, y) for the given duration. If already showing,
  // replaces the current text and resets the timer.
  show(text, x, y, duration = 4000) {
    this._cancelTimer();
    this._ensureObjects();

    this._text.setText(text);
    this._text.setAlpha(1);
    this._bg.setAlpha(0.75);
    this._visible = true;

    this._updatePosition(x, y);
    this._text.setVisible(true);
    this._bg.setVisible(true);

    // Hold, then fade out
    const holdTime = Math.max(0, duration - FADE_DURATION);
    this._timer = this.scene.time.delayedCall(holdTime, () => {
      this.scene.tweens.add({
        targets: [this._text, this._bg],
        alpha: 0,
        duration: FADE_DURATION,
        onComplete: () => {
          this._visible = false;
          this._text.setVisible(false);
          this._bg.setVisible(false);
        },
      });
    });
  }

  // Reposition each frame to follow the NPC. Call from NPC.update().
  // bubbleY should be above the name label.
  update(x, y) {
    if (!this._visible) return;
    this._updatePosition(x, y);
  }

  // Update depth to stay above the name label.
  setDepth(depth) {
    if (this._bg) this._bg.setDepth(depth);
    if (this._text) this._text.setDepth(depth + 1);
  }

  get isShowing() {
    return this._visible;
  }

  destroy() {
    this._cancelTimer();
    if (this._text) this._text.destroy();
    if (this._bg) this._bg.destroy();
    this._text = null;
    this._bg = null;
    this._visible = false;
  }

  // --- Internal ---

  _ensureObjects() {
    if (this._text) return;

    this._text = this.scene.add.text(0, 0, '', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1,
      wordWrap: { width: MAX_WIDTH },
      align: 'center',
    }).setOrigin(0.5, 1).setVisible(false);

    this._bg = this.scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.75)
      .setOrigin(0.5, 1).setVisible(false);
  }

  _updatePosition(x, y) {
    if (!this._text) return;

    this._text.setPosition(x, y);

    // Size background to fit text
    const bounds = this._text.getBounds();
    const bgW = bounds.width + PADDING_X * 2;
    const bgH = bounds.height + PADDING_Y * 2;
    this._bg.setPosition(x, y);
    this._bg.setSize(bgW, bgH);
  }

  _cancelTimer() {
    if (this._timer) {
      this._timer.destroy();
      this._timer = null;
    }
    // Kill any running fade tweens on our objects
    if (this._text) this.scene.tweens.killTweensOf(this._text);
    if (this._bg) this.scene.tweens.killTweensOf(this._bg);
  }
}
