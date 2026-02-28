// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Define the build-time global before importing the module
vi.stubGlobal('__GIT_COMMIT__', 'abc1234');

// Mock the CSS import
vi.mock('../../client/src/build-status/build-status.css', () => ({}));

describe('BuildStatusIndicator', () => {
  let BuildStatusIndicator, STATE;

  beforeEach(async () => {
    const mod = await import('../../client/src/build-status/BuildStatusIndicator.js');
    BuildStatusIndicator = mod.BuildStatusIndicator;
    STATE = mod.STATE;
  });

  afterEach(() => {
    // Clean up DOM
    const el = document.querySelector('.build-status-indicator');
    if (el) el.remove();
    vi.restoreAllMocks();
  });

  it('starts in UNKNOWN state', () => {
    const indicator = new BuildStatusIndicator();
    expect(indicator.state).toBe(STATE.UNKNOWN);
    indicator.destroy();
  });

  it('creates DOM element on mount with overlay', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    const el = document.querySelector('.build-status-indicator');
    expect(el).not.toBeNull();
    expect(el.querySelector('.build-status-dot')).not.toBeNull();
    expect(el.querySelector('.build-status-tooltip')).not.toBeNull();
    expect(el.querySelector('.build-status-overlay')).not.toBeNull();
    expect(el.querySelector('.build-status-overlay-legend')).not.toBeNull();

    indicator.destroy();
  });

  it('toggles overlay on dot click and closes on document click', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    const dot = document.querySelector('.build-status-dot');
    const overlay = document.querySelector('.build-status-overlay');

    // Initially hidden
    expect(overlay.classList.contains('visible')).toBe(false);

    // Click dot opens overlay
    dot.click();
    expect(overlay.classList.contains('visible')).toBe(true);

    // Click document closes overlay
    document.dispatchEvent(new Event('click'));
    expect(overlay.classList.contains('visible')).toBe(false);

    indicator.destroy();
  });

  it('shows CURRENT (green) when version matches and no deploy in progress', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.startsWith('/version.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ commit: 'abc1234', version: '0.2.0' }),
        });
      }
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    }));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    // Wait for async polls to complete
    await vi.waitFor(() => expect(indicator.state).toBe(STATE.CURRENT));

    indicator.destroy();
  });

  it('shows STALE (yellow) when version differs', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.startsWith('/version.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ commit: 'def5678', version: '0.3.0' }),
        });
      }
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workflow_runs: [{ status: 'completed', conclusion: 'success' }],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    }));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    await vi.waitFor(() => expect(indicator.state).toBe(STATE.STALE));

    indicator.destroy();
  });

  it('shows BUILDING (flashing yellow) when deploy in progress', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.startsWith('/version.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ commit: 'abc1234', version: '0.2.0' }),
        });
      }
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workflow_runs: [{ status: 'in_progress', conclusion: null }],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    }));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    await vi.waitFor(() => expect(indicator.state).toBe(STATE.BUILDING));

    // Should have flashing class
    const dot = document.querySelector('.build-status-dot');
    expect(dot.classList.contains('flashing')).toBe(true);

    indicator.destroy();
  });

  it('shows FAILED (red) when latest build failed', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.startsWith('/version.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ commit: 'abc1234', version: '0.2.0' }),
        });
      }
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workflow_runs: [{ status: 'completed', conclusion: 'failure' }],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    }));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    await vi.waitFor(() => expect(indicator.state).toBe(STATE.FAILED));

    indicator.destroy();
  });

  it('BUILDING takes priority over STALE', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.startsWith('/version.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ commit: 'def5678', version: '0.3.0' }),
        });
      }
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            workflow_runs: [{ status: 'queued', conclusion: null }],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    }));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    await vi.waitFor(() => expect(indicator.state).toBe(STATE.BUILDING));

    indicator.destroy();
  });

  it('degrades gracefully when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

    const indicator = new BuildStatusIndicator();
    indicator.mount();

    // Should stay UNKNOWN, not throw
    await new Promise((r) => setTimeout(r, 50));
    expect(indicator.state).toBe(STATE.UNKNOWN);

    indicator.destroy();
  });

  it('removes DOM on destroy', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));

    const indicator = new BuildStatusIndicator();
    indicator.mount();
    expect(document.querySelector('.build-status-indicator')).not.toBeNull();

    indicator.destroy();
    expect(document.querySelector('.build-status-indicator')).toBeNull();
  });
});
