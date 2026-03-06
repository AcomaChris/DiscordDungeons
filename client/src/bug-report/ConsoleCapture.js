// --- Console Capture ---
// Intercepts console.log/warn/error and buffers recent entries so they
// can be attached to bug reports. Original console methods still fire.

const MAX_ENTRIES = 200;

const _entries = [];
const _originals = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

let _installed = false;

function _formatArgs(args) {
  return args.map((a) => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

function _capture(level, args) {
  const entry = {
    t: Date.now(),
    level,
    msg: _formatArgs(Array.from(args)),
  };
  _entries.push(entry);
  if (_entries.length > MAX_ENTRIES) _entries.shift();
}

export function installConsoleCapture() {
  if (_installed) return;
  _installed = true;

  console.log = function (...args) {
    _capture('log', args);
    _originals.log.apply(console, args);
  };
  console.warn = function (...args) {
    _capture('warn', args);
    _originals.warn.apply(console, args);
  };
  console.error = function (...args) {
    _capture('error', args);
    _originals.error.apply(console, args);
  };

  // Capture uncaught errors and unhandled rejections
  window.addEventListener('error', (e) => {
    _capture('error', [`[uncaught] ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    _capture('error', [`[unhandledrejection] ${e.reason}`]);
  });
}

export function getConsoleLogs() {
  return _entries.map((e) => {
    const ts = new Date(e.t).toISOString().slice(11, 23); // HH:MM:SS.mmm
    const prefix = e.level === 'log' ? '' : `[${e.level.toUpperCase()}] `;
    return `${ts} ${prefix}${e.msg}`;
  }).join('\n');
}
