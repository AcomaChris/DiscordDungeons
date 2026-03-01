// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the CSS import
vi.mock('../../client/src/bug-report/bug-report.css', () => ({}));

// Mock authManager singleton with a test identity
vi.mock('../../client/src/auth/AuthManager.js', () => ({
  default: {
    identity: {
      playerName: 'TestUser',
      discordId: '123456789',
    },
  },
}));

// Mock Discord activity detection
vi.mock('../../client/src/discord/activitySdk.js', () => ({
  isDiscordActivity: false,
}));

// Stub build-time globals
vi.stubGlobal('__GIT_COMMIT__', 'abc1234');
vi.stubGlobal('__APP_VERSION__', '0.3.6');
vi.stubGlobal('__BUILD_TIME__', '2026-03-01T00:00:00.000Z');

describe('BugReporter', () => {
  let BugReporter;

  beforeEach(async () => {
    const mod = await import('../../client/src/bug-report/BugReporter.js');
    BugReporter = mod.BugReporter;
  });

  afterEach(() => {
    // Clean up all bug-report DOM
    for (const el of document.querySelectorAll('.bug-report-container, .bug-report-backdrop')) {
      el.remove();
    }
    vi.restoreAllMocks();
  });

  it('mounts cog button to DOM', () => {
    const reporter = new BugReporter();
    reporter.mount();

    const cog = document.querySelector('.bug-report-cog');
    expect(cog).not.toBeNull();
    expect(cog.textContent).toBe('\u2699');

    reporter.destroy();
  });

  it('toggles menu on cog click', () => {
    const reporter = new BugReporter();
    reporter.mount();

    const cog = document.querySelector('.bug-report-cog');
    const menu = document.querySelector('.bug-report-menu');

    expect(menu.classList.contains('visible')).toBe(false);

    cog.click();
    expect(menu.classList.contains('visible')).toBe(true);

    cog.click();
    expect(menu.classList.contains('visible')).toBe(false);

    reporter.destroy();
  });

  it('closes menu on document click', () => {
    const reporter = new BugReporter();
    reporter.mount();

    const cog = document.querySelector('.bug-report-cog');
    const menu = document.querySelector('.bug-report-menu');

    cog.click();
    expect(menu.classList.contains('visible')).toBe(true);

    document.dispatchEvent(new Event('click'));
    expect(menu.classList.contains('visible')).toBe(false);

    reporter.destroy();
  });

  it('opens dialog when "File Issue" clicked', () => {
    const reporter = new BugReporter();
    reporter.mount();

    const menuItem = document.querySelector('.bug-report-menu-item');
    menuItem.click();

    const dialog = document.querySelector('.bug-report-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[data-field="title"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="description"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="priority"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="screenshot"]')).not.toBeNull();
    expect(dialog.querySelector('.bug-report-btn-submit')).not.toBeNull();
    expect(dialog.querySelector('.bug-report-btn-cancel')).not.toBeNull();

    reporter.destroy();
  });

  it('closes dialog on cancel', () => {
    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();
    expect(document.querySelector('.bug-report-dialog')).not.toBeNull();

    document.querySelector('.bug-report-btn-cancel').click();
    expect(document.querySelector('.bug-report-dialog')).toBeNull();

    reporter.destroy();
  });

  it('closes dialog on backdrop click', () => {
    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();
    const backdrop = document.querySelector('.bug-report-backdrop');
    expect(backdrop).not.toBeNull();

    // Click backdrop itself (not dialog)
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.bug-report-dialog')).toBeNull();

    reporter.destroy();
  });

  it('captures screenshot from canvas', () => {
    // jsdom doesn't implement toDataURL — mock it
    const fakeDataUrl = 'data:image/png;base64,AAAA';
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = () => fakeDataUrl;

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();

    const preview = document.querySelector('.bug-report-preview');
    expect(preview.src).toContain('data:image/png');

    canvas.remove();
    reporter.destroy();
    HTMLCanvasElement.prototype.toDataURL = origToDataURL;
  });

  it('hides screenshot preview when checkbox unchecked', () => {
    const fakeDataUrl = 'data:image/png;base64,AAAA';
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = () => fakeDataUrl;

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();

    const checkbox = document.querySelector('[data-field="screenshot"]');
    const container = document.querySelector('.bug-report-preview-container');

    expect(container.style.display).not.toBe('none');

    // Uncheck
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(container.style.display).toBe('none');

    canvas.remove();
    reporter.destroy();
    HTMLCanvasElement.prototype.toDataURL = origToDataURL;
  });

  it('shows error when title is empty', async () => {
    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();

    // Leave title empty and click submit
    document.querySelector('.bug-report-btn-submit').click();

    const status = document.querySelector('.bug-report-status');
    expect(status.textContent).toBe('Title is required.');
    expect(status.classList.contains('bug-report-status-error')).toBe(true);

    reporter.destroy();
  });

  it('submits form data to server', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, issueUrl: 'https://github.com/test/1', issueNumber: 1 }),
    })));

    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();

    // Fill in form
    const titleInput = document.querySelector('[data-field="title"]');
    titleInput.value = 'Test bug';
    document.querySelector('[data-field="description"]').value = 'Steps to reproduce';
    // Uncheck screenshot to simplify
    const checkbox = document.querySelector('[data-field="screenshot"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    document.querySelector('.bug-report-btn-submit').click();

    // Wait for async submit
    await vi.waitFor(() => {
      const status = document.querySelector('.bug-report-status');
      expect(status.textContent).toContain('Issue filed!');
    });

    // Verify fetch was called with correct data
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/issue'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const callBody = JSON.parse(fetch.mock.calls[0][1].body);
    expect(callBody.title).toBe('Test bug');
    expect(callBody.description).toBe('Steps to reproduce');
    expect(callBody.priority).toBe('medium');
    expect(callBody.commit).toBe('abc1234');
    expect(callBody.version).toBe('0.3.6');
    expect(callBody.buildTime).toBe('2026-03-01T00:00:00.000Z');
    expect(callBody.reporter).toBe('TestUser');
    expect(callBody.discordId).toBe('123456789');
    expect(callBody.platform).toBe('web');
    expect(callBody.device).toBe(navigator.userAgent);
    expect(callBody.resolution).toBe(`${window.innerWidth}x${window.innerHeight}`);

    reporter.destroy();
  });

  it('shows error on submit failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server broke' }),
    })));

    const reporter = new BugReporter();
    reporter.mount();

    document.querySelector('.bug-report-menu-item').click();
    document.querySelector('[data-field="title"]').value = 'Test';
    const checkbox = document.querySelector('[data-field="screenshot"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    document.querySelector('.bug-report-btn-submit').click();

    await vi.waitFor(() => {
      const status = document.querySelector('.bug-report-status');
      expect(status.textContent).toBe('Server broke');
    });

    // Submit button re-enabled after error
    const submitBtn = document.querySelector('.bug-report-btn-submit');
    expect(submitBtn.disabled).toBe(false);

    reporter.destroy();
  });

  it('removes DOM on destroy', () => {
    const reporter = new BugReporter();
    reporter.mount();

    expect(document.querySelector('.bug-report-container')).not.toBeNull();

    reporter.destroy();
    expect(document.querySelector('.bug-report-container')).toBeNull();
  });

  it('acquires input focus on dialog open and releases on close', async () => {
    const { isGameInputActive, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();

    const reporter = new BugReporter();
    reporter.mount();

    expect(isGameInputActive()).toBe(true);

    document.querySelector('.bug-report-menu-item').click();
    expect(isGameInputActive()).toBe(false);

    document.querySelector('.bug-report-btn-cancel').click();
    expect(isGameInputActive()).toBe(true);

    reporter.destroy();
    _resetForTesting();
  });
});
