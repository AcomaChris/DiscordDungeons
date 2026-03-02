import './bug-report.css';
import { acquireInputFocus, releaseInputFocus } from '../core/InputContext.js';
import authManager from '../auth/AuthManager.js';
import { isDiscordActivity } from '../discord/activitySdk.js';

// --- Bug Reporter ---
// Settings cog with "File Issue" option. Opens a dialog to file GitHub issues
// with optional screenshots, proxied through the game server.

const API_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';

const PRIORITIES = ['low', 'medium', 'high'];

export class BugReporter {
  constructor() {
    this._el = null;
    this._cog = null;
    this._menu = null;
    this._backdrop = null;
    this._dialog = null;
    this._screenshotData = null;
  }

  mount() {
    this._createCog();
  }

  addMenuItem(label, callback) {
    const btn = document.createElement('button');
    btn.className = 'bug-report-menu-item';
    btn.textContent = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._menu.classList.remove('visible');
      callback();
    });
    this._menu.appendChild(btn);
    return btn;
  }

  destroy() {
    if (this._cog) this._cog.removeEventListener('click', this._onCogClick);
    document.removeEventListener('click', this._onDocClick);
    this._closeDialog();
    if (this._el) this._el.remove();
    this._el = null;
  }

  // --- Cog Button + Menu ---

  _createCog() {
    this._el = document.createElement('div');
    this._el.className = 'bug-report-container';

    this._cog = document.createElement('button');
    this._cog.className = 'bug-report-cog';
    this._cog.textContent = '\u2699';
    this._cog.title = 'Settings';

    this._menu = document.createElement('div');
    this._menu.className = 'bug-report-menu';

    const fileIssueBtn = document.createElement('button');
    fileIssueBtn.className = 'bug-report-menu-item';
    fileIssueBtn.textContent = 'File Issue';
    fileIssueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._menu.classList.remove('visible');
      this._openDialog();
    });

    this._menu.appendChild(fileIssueBtn);
    this._el.append(this._cog, this._menu);
    document.body.appendChild(this._el);

    this._onCogClick = (e) => {
      e.stopPropagation();
      this._menu.classList.toggle('visible');
    };
    this._onDocClick = () => {
      this._menu.classList.remove('visible');
    };
    this._cog.addEventListener('click', this._onCogClick);
    document.addEventListener('click', this._onDocClick);
  }

  // --- Dialog ---

  _openDialog() {
    if (this._backdrop) return;

    this._captureScreenshot();

    this._backdrop = document.createElement('div');
    this._backdrop.className = 'bug-report-backdrop';
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this._closeDialog();
    });

    this._dialog = document.createElement('div');
    this._dialog.className = 'bug-report-dialog';
    this._dialog.innerHTML = `
      <h2 class="bug-report-dialog-title">File a Bug Report</h2>
      <label class="bug-report-label">
        Title <span class="bug-report-required">*</span>
        <input type="text" class="bug-report-input" data-field="title" placeholder="Brief description of the issue" maxlength="256" />
      </label>
      <label class="bug-report-label">
        Description
        <textarea class="bug-report-textarea" data-field="description" placeholder="Steps to reproduce, expected vs actual behavior..." rows="4"></textarea>
      </label>
      <label class="bug-report-label">
        Priority
        <select class="bug-report-select" data-field="priority">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label class="bug-report-checkbox-label">
        <input type="checkbox" data-field="screenshot" checked />
        Include screenshot
      </label>
      <div class="bug-report-preview-container">
        <img class="bug-report-preview" alt="Screenshot preview" />
      </div>
      <div class="bug-report-actions">
        <button class="bug-report-btn bug-report-btn-cancel">Cancel</button>
        <button class="bug-report-btn bug-report-btn-submit">Submit</button>
      </div>
      <div class="bug-report-status"></div>
    `;

    // Wire up screenshot preview
    const preview = this._dialog.querySelector('.bug-report-preview');
    const previewContainer = this._dialog.querySelector('.bug-report-preview-container');
    if (this._screenshotData) {
      preview.src = this._screenshotData;
    } else {
      previewContainer.style.display = 'none';
    }

    const screenshotCheckbox = this._dialog.querySelector('[data-field="screenshot"]');
    screenshotCheckbox.addEventListener('change', () => {
      if (screenshotCheckbox.checked) {
        this._captureScreenshot();
        if (this._screenshotData) {
          preview.src = this._screenshotData;
          previewContainer.style.display = '';
        }
      } else {
        previewContainer.style.display = 'none';
      }
    });

    // Wire up buttons
    this._dialog.querySelector('.bug-report-btn-cancel')
      .addEventListener('click', () => this._closeDialog());
    this._dialog.querySelector('.bug-report-btn-submit')
      .addEventListener('click', () => this._submit());

    this._backdrop.appendChild(this._dialog);
    document.body.appendChild(this._backdrop);

    acquireInputFocus();

    // Focus the title input
    this._dialog.querySelector('[data-field="title"]').focus();
  }

  _closeDialog() {
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
      this._dialog = null;
      releaseInputFocus();
    }
    this._screenshotData = null;
  }

  _captureScreenshot() {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      try {
        this._screenshotData = canvas.toDataURL('image/png');
      } catch {
        this._screenshotData = null;
      }
    }
  }

  // --- Submit ---

  async _submit() {
    const title = this._dialog.querySelector('[data-field="title"]').value.trim();
    const description = this._dialog.querySelector('[data-field="description"]').value.trim();
    const priority = this._dialog.querySelector('[data-field="priority"]').value;
    const includeScreenshot = this._dialog.querySelector('[data-field="screenshot"]').checked;

    if (!title) {
      this._showStatus('Title is required.', 'error');
      return;
    }

    const submitBtn = this._dialog.querySelector('.bug-report-btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting\u2026';
    this._showStatus('', '');

    try {
      const body = { title, description, priority };
      if (includeScreenshot && this._screenshotData) {
        body.screenshot = this._screenshotData;
      }

      // Include build metadata and environment info for triage
      if (typeof __GIT_COMMIT__ !== 'undefined') body.commit = __GIT_COMMIT__;
      if (typeof __APP_VERSION__ !== 'undefined') body.version = __APP_VERSION__;
      if (typeof __BUILD_TIME__ !== 'undefined') body.buildTime = __BUILD_TIME__;

      body.reporter = authManager.identity?.playerName || 'Unknown';
      body.discordId = authManager.identity?.discordId || null;
      body.platform = isDiscordActivity ? 'discord-activity' : 'web';
      body.device = navigator.userAgent;
      body.resolution = `${window.innerWidth}x${window.innerHeight}`;

      const res = await fetch(`${API_URL}/api/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      this._showStatus(
        `Issue filed! <a href="${data.issueUrl}" target="_blank" rel="noopener">#${data.issueNumber}</a>`,
        'success',
      );

      submitBtn.textContent = 'Done';
      setTimeout(() => this._closeDialog(), 3000);
    } catch (err) {
      this._showStatus(err.message || 'Failed to file issue.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  }

  _showStatus(html, type) {
    const el = this._dialog?.querySelector('.bug-report-status');
    if (!el) return;
    el.innerHTML = html;
    el.className = 'bug-report-status';
    if (type) el.classList.add(`bug-report-status-${type}`);
  }
}
