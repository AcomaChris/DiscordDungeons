import '../styles/state-display.css';

// @doc-dev 01:Debug Panel > State Display
// Toggle **Show State** from the cog menu to display a live badge strip at the bottom
// of the screen. Badges light up for each active player state: **idle**, **moving**,
// **sprinting**, **jumping**, **mantling**, **floating**, and **interacting**. Multiple
// states can be active simultaneously (e.g., jumping + floating). A facing direction
// arrow (▲▼◄►) updates every frame alongside the badges.

// --- State Display Panel ---
// Floating panel showing the player's current states as live badges.
// States can be concurrent (e.g., jumping + floating). Toggled from cog menu.

const STATES = ['idle', 'moving', 'sprinting', 'jumping', 'mantling', 'floating', 'interacting'];

export class StateDisplayPanel {
  constructor() {
    this._panel = null;
    this._badges = {};
    this._facingEl = null;
    this._rafId = null;
    this.active = false;
  }

  toggle() {
    if (this.active) {
      this._unmount();
    } else {
      this._mount();
    }
  }

  _mount() {
    this._panel = document.createElement('div');
    this._panel.className = 'state-display-panel';

    for (const state of STATES) {
      const badge = document.createElement('span');
      badge.className = 'state-display-badge';
      badge.textContent = state;
      this._panel.appendChild(badge);
      this._badges[state] = badge;
    }

    this._facingEl = document.createElement('span');
    this._facingEl.className = 'state-display-facing';
    this._facingEl.textContent = '▼';
    this._panel.appendChild(this._facingEl);

    document.body.appendChild(this._panel);
    this.active = true;
    this._startUpdates();
  }

  _unmount() {
    this._stopUpdates();
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
    this._badges = {};
    this._facingEl = null;
    this.active = false;
  }

  _startUpdates() {
    const loop = () => {
      this._update();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _stopUpdates() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _update() {
    const scene = globalThis.__PHASER_GAME__?.scene?.getScene('GameScene');
    const player = scene?.player;
    if (!player) return;

    const body = player.sprite?.body;
    const isMoving = body && (Math.abs(body.velocity.x) > 1 || Math.abs(body.velocity.y) > 1);
    const input = scene._lastInput;

    const states = {
      idle: !isMoving && !player._isJumping && !player._isMantling,
      moving: !!isMoving,
      sprinting: !!player.abilities.get('movement')?.active,
      jumping: !!player._isJumping,
      mantling: !!player._isMantling,
      floating: player._isJumping && player.vz < 0 && !!player.abilities.get('float'),
      interacting: !!input?.interact,
    };

    for (const state of STATES) {
      this._badges[state]?.classList.toggle('active', states[state]);
    }

    // Facing arrow
    if (this._facingEl) {
      const arrows = { up: '▲', down: '▼', left: '◄', right: '►' };
      this._facingEl.textContent = arrows[player.facing] || '?';
    }
  }
}
