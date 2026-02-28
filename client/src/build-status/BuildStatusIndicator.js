import './build-status.css';

// --- Build Status Indicator ---
// Floating DOM overlay showing deployment state as a colored circle.
// Polls /version.json and GitHub Actions API to determine state.

// AGENT: __GIT_COMMIT__ is injected by Vite at build time (vite.config.mjs `define`).
const LOCAL_COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';

const REPO = 'AcomaChris/DiscordDungeons';
const VERSION_POLL_MS = 30_000;
const ACTIONS_POLL_MS = 120_000;
const ACTIONS_API = `https://api.github.com/repos/${REPO}/actions/runs`;

export const STATE = {
  CURRENT: 'current',
  STALE: 'stale',
  BUILDING: 'building',
  FAILED: 'failed',
  UNKNOWN: 'unknown',
};

const COLORS = {
  [STATE.CURRENT]: '#22c55e',
  [STATE.STALE]: '#eab308',
  [STATE.BUILDING]: '#eab308',
  [STATE.FAILED]: '#ef4444',
  [STATE.UNKNOWN]: '#6b7280',
};

const LABELS = {
  [STATE.CURRENT]: 'Up to date',
  [STATE.STALE]: 'New version available \u2014 refresh to update',
  [STATE.BUILDING]: 'New build deploying\u2026',
  [STATE.FAILED]: 'Latest build failed',
  [STATE.UNKNOWN]: 'Build status unknown',
};

export class BuildStatusIndicator {
  constructor() {
    this._state = STATE.UNKNOWN;
    this._remoteCommit = null;
    this._deploying = false;
    this._runFailed = false;
    this._versionTimer = null;
    this._actionsTimer = null;
    this._el = null;
    this._dot = null;
    this._tooltip = null;
  }

  get state() {
    return this._state;
  }

  mount() {
    this._createDOM();
    this._pollVersion();
    this._pollActions();
    this._versionTimer = setInterval(() => this._pollVersion(), VERSION_POLL_MS);
    this._actionsTimer = setInterval(() => this._pollActions(), ACTIONS_POLL_MS);
  }

  destroy() {
    clearInterval(this._versionTimer);
    clearInterval(this._actionsTimer);
    if (this._el) this._el.remove();
  }

  _createDOM() {
    this._el = document.createElement('div');
    this._el.className = 'build-status-indicator';

    this._dot = document.createElement('div');
    this._dot.className = 'build-status-dot';

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'build-status-tooltip';

    this._el.append(this._dot, this._tooltip);
    document.body.appendChild(this._el);
    this._render();
  }

  _render() {
    if (!this._dot) return;
    const color = COLORS[this._state];
    this._dot.style.backgroundColor = color;
    this._dot.style.boxShadow = `0 0 6px ${color}`;
    this._tooltip.textContent = LABELS[this._state];

    // Flashing yellow for building state
    if (this._state === STATE.BUILDING) {
      this._dot.classList.add('flashing');
    } else {
      this._dot.classList.remove('flashing');
    }
  }

  _deriveState() {
    if (this._deploying) {
      this._state = STATE.BUILDING;
    } else if (this._runFailed) {
      this._state = STATE.FAILED;
    } else if (this._remoteCommit && this._remoteCommit !== LOCAL_COMMIT) {
      this._state = STATE.STALE;
    } else if (this._remoteCommit && this._remoteCommit === LOCAL_COMMIT) {
      this._state = STATE.CURRENT;
    }
    this._render();
  }

  async _pollVersion() {
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      this._remoteCommit = data.commit;
    } catch {
      // Network error — degrade gracefully
    }
    this._deriveState();
  }

  async _pollActions() {
    try {
      const res = await fetch(`${ACTIONS_API}?branch=main&per_page=1&event=push`);
      if (!res.ok) return;
      const data = await res.json();
      const run = data.workflow_runs?.[0];
      if (!run) return;

      this._deploying = run.status === 'in_progress' || run.status === 'queued';
      this._runFailed = run.status === 'completed' &&
        (run.conclusion === 'failure' || run.conclusion === 'cancelled');
    } catch {
      // Rate limited or network error — degrade gracefully
      this._deploying = false;
      this._runFailed = false;
    }
    this._deriveState();
  }
}
