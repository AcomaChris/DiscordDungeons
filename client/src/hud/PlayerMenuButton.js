// --- PlayerMenuButton ---
// Fixed button in top-left that opens the player menu panel.

import { PlayerMenuPanel } from './PlayerMenuPanel.js';
import '../styles/player-menu.css';

export class PlayerMenuButton {
  constructor() {
    this._el = null;
    this._panel = null;
  }

  mount() {
    this._el = document.createElement('button');
    this._el.className = 'dd-player-btn';
    this._el.textContent = '\uD83C\uDF92 Player';
    this._el.title = 'Open player menu';
    this._el.addEventListener('click', () => this._openPanel());
    document.body.appendChild(this._el);
  }

  _openPanel() {
    if (this._panel) return;
    this._panel = new PlayerMenuPanel(() => {
      this._panel = null;
    });
    this._panel.open();
  }

  destroy() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    if (this._panel) {
      this._panel.close();
      this._panel = null;
    }
  }
}
