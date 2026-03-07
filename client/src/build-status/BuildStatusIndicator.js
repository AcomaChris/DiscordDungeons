import './build-status.css';

// @doc-dev 01:Debug Panel > Build Status
// A small colored dot in the bottom-left corner shows the current deploy state.
// Click it to expand a tooltip with the **version number**, **git commit hash**, and
// **build timestamp**. The dot color indicates status: green = up to date, yellow =
// new version available or build in progress, red = build failed, grey = unknown.
// It polls `/version.json` and the GitHub Actions API to stay current.

// --- Build Status Indicator ---
// Floating DOM overlay showing deployment state as a colored circle.
// Polls /version.json and GitHub Actions API to determine state.

// AGENT: these globals are injected by Vite at build time (vite.config.mjs `define`).
const LOCAL_COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '?';
const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : null;

const REPO = 'AcomaChris/DiscordDungeons';
const VERSION_POLL_MS = 5_000;
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
    if (this._dot) this._dot.removeEventListener('click', this._onDotClick);
    document.removeEventListener('click', this._onDocClick);
    if (this._el) this._el.remove();
  }

  _createDOM() {
    this._el = document.createElement('div');
    this._el.className = 'build-status-indicator';

    this._dot = document.createElement('div');
    this._dot.className = 'build-status-dot';

    this._tooltip = document.createElement('div');
    this._tooltip.className = 'build-status-tooltip';

    const commitUrl = `https://github.com/${REPO}/commit/${LOCAL_COMMIT}`;
    const buildTimeStr = BUILD_TIME
      ? new Date(BUILD_TIME).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short',
      })
      : 'unknown';

    this._overlay = document.createElement('div');
    this._overlay.className = 'build-status-overlay';
    this._overlay.innerHTML = `
      <div class="build-status-overlay-title">Build Status</div>
      <div class="build-status-overlay-info">
        <span>v${APP_VERSION} · <a class="build-status-commit-link" href="${commitUrl}" target="_blank" rel="noopener">${LOCAL_COMMIT}</a></span>
        <span>Built ${buildTimeStr}</span>
      </div>
      <div class="build-status-overlay-current"></div>
      <hr class="build-status-overlay-divider">
      <div class="build-status-overlay-legend">
        <div class="build-status-legend-row"><span class="build-status-legend-dot" style="background:${COLORS[STATE.CURRENT]}"></span> Up to date</div>
        <div class="build-status-legend-row"><span class="build-status-legend-dot" style="background:${COLORS[STATE.STALE]}"></span> New version available</div>
        <div class="build-status-legend-row"><span class="build-status-legend-dot build-status-legend-flash" style="background:${COLORS[STATE.BUILDING]}"></span> Build deploying</div>
        <div class="build-status-legend-row"><span class="build-status-legend-dot" style="background:${COLORS[STATE.FAILED]}"></span> Build failed</div>
        <div class="build-status-legend-row"><span class="build-status-legend-dot" style="background:${COLORS[STATE.UNKNOWN]}"></span> Unknown</div>
      </div>
    `;

    this._onDotClick = (e) => {
      e.stopPropagation();
      this._overlay.classList.toggle('visible');
    };
    this._onDocClick = () => {
      this._overlay.classList.remove('visible');
    };
    this._dot.addEventListener('click', this._onDotClick);
    document.addEventListener('click', this._onDocClick);

    this._el.append(this._dot, this._tooltip, this._overlay);
    document.body.appendChild(this._el);
    this._render();
  }

  _render() {
    if (!this._dot) return;
    const color = COLORS[this._state];
    this._dot.style.backgroundColor = color;
    this._dot.style.boxShadow = `0 0 6px ${color}`;
    this._tooltip.textContent = `${LABELS[this._state]} · v${APP_VERSION} · ${LOCAL_COMMIT}`;

    // Flashing yellow for building state
    if (this._state === STATE.BUILDING) {
      this._dot.classList.add('flashing');
    } else {
      this._dot.classList.remove('flashing');
    }

    // Update overlay current status line
    const currentEl = this._overlay?.querySelector('.build-status-overlay-current');
    if (currentEl) {
      currentEl.textContent = LABELS[this._state];
      currentEl.style.color = color;
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
