import './behavior-engine.css';
import { acquireInputFocus, releaseInputFocus } from '../core/InputContext.js';
import { BehaviorEngineClient } from './BehaviorEngineClient.js';

// --- Behavior Engine Test Panel ---
// Prototype panel for testing Artificial Agency platform integration.
// Creates a session + agent, sends messages, displays function call responses.
// Accessed via cog menu. All API calls go direct from browser (no proxy).

const STORAGE_KEY = 'behaviorEngine.config';

const DEFAULT_AGENT_CONFIG = {
  role_config: {
    core: 'You are a tavern NPC in a tile-based RPG. When a player speaks to you, respond by choosing the send_response function with a short, in-character reply.',
    characterization: 'You are Greta, a warm and witty tavern keeper who loves hearing tales from adventurers. You speak casually and occasionally crack jokes.',
  },
  component_configs: [
    { id: 'history', type: 'limited_list', max_entries: 20 },
    { id: 'facts', type: 'kv_store', delimiter: ':' },
  ],
  presentation_config: {
    presentation_order: [
      ['history', 'items'],
      ['facts', 'data'],
    ],
  },
  service_configs: [
    { id: 'default_llm', service_name: 'openai/gpt_4o_mini', temperature: 0.8 },
  ],
  agent_llm: 'default_llm',
};

const AGENT_FUNCTIONS = [
  {
    name: 'send_response',
    docs: 'Respond to the player with a short message. Keep it in character and under 50 words.',
    parameters: {
      text: { value_type: 'string', docs: 'What to say to the player.' },
    },
    required: ['text'],
  },
];

export class BehaviorEnginePanel {
  constructor() {
    this._backdrop = null;
    this._dialog = null;
    this._client = null;
    this._sessionId = null;
    this._agentId = null;
  }

  open() {
    if (this._backdrop) return;
    this._createDialog();
    acquireInputFocus();
  }

  close() {
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
      this._dialog = null;
      releaseInputFocus();
    }
  }

  // --- Dialog ---

  _createDialog() {
    const saved = this._loadConfig();

    this._backdrop = document.createElement('div');
    this._backdrop.className = 'be-backdrop';
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.close();
    });

    this._dialog = document.createElement('div');
    this._dialog.className = 'be-dialog';

    // --- Title ---
    const title = document.createElement('h2');
    title.className = 'be-title';
    title.innerHTML = 'Behavior Engine Test <button class="be-close">&times;</button>';
    title.querySelector('.be-close').addEventListener('click', () => this.close());

    // --- Connection section ---
    const connSection = this._makeSection('Connection');

    const proxyRow = this._makeRow('WS Server (proxy)');
    this._proxyInput = this._makeInput('text', saved.proxyUrl, 'https://ws.discorddungeons.com');
    proxyRow.appendChild(this._proxyInput);

    const projectRow = this._makeRow('Project ID');
    this._projectInput = this._makeInput('text', saved.projectId, 'proj_...');
    projectRow.appendChild(this._projectInput);

    // --- Session ---
    const sessionSection = this._makeSection('Session');

    this._sessionBtn = this._makeBtn('Create Session');
    this._sessionStatus = this._makeStatus();
    this._sessionBtn.addEventListener('click', () => this._createSession());

    // --- Agent ---
    const agentSection = this._makeSection('Agent');

    this._agentBtn = this._makeBtn('Create Agent');
    this._agentBtn.disabled = true;
    this._agentStatus = this._makeStatus();
    this._agentBtn.addEventListener('click', () => this._createAgent());

    // --- Message ---
    const msgSection = this._makeSection('Message');

    const msgRow = document.createElement('div');
    msgRow.className = 'be-message-row';
    this._msgInput = this._makeInput('text', '', 'Say something to the agent...');
    this._msgInput.disabled = true;
    this._sendBtn = this._makeBtn('Send');
    this._sendBtn.disabled = true;
    this._sendBtn.style.width = 'auto';
    msgRow.appendChild(this._msgInput);
    msgRow.appendChild(this._sendBtn);

    this._sendBtn.addEventListener('click', () => this._sendMessage());
    this._msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this._sendBtn.disabled) this._sendMessage();
    });

    // --- Response log ---
    const logSection = this._makeSection('Response Log');

    this._log = document.createElement('div');
    this._log.className = 'be-log';
    this._log.innerHTML = '<div class="be-log-empty">No responses yet</div>';

    // --- Assemble ---
    this._dialog.append(
      title,
      connSection, proxyRow, projectRow,
      sessionSection, this._sessionBtn, this._sessionStatus,
      agentSection, this._agentBtn, this._agentStatus,
      msgSection, msgRow,
      logSection, this._log,
    );

    this._backdrop.appendChild(this._dialog);
    document.body.appendChild(this._backdrop);
  }

  // --- Actions ---

  async _createSession() {
    this._saveConfig();
    this._sessionBtn.disabled = true;
    this._setStatus(this._sessionStatus, 'Creating session...', '');

    try {
      this._client = new BehaviorEngineClient({
        projectId: this._projectInput.value.trim(),
        proxyUrl: this._proxyInput.value.trim() || undefined,
      });

      const session = await this._client.createSession();
      this._sessionId = session.id;
      this._setStatus(this._sessionStatus, `Session: ${session.id}`, 'success');
      this._agentBtn.disabled = false;
    } catch (err) {
      this._setStatus(this._sessionStatus, err.message, 'error');
    }

    this._sessionBtn.disabled = false;
  }

  async _createAgent() {
    this._agentBtn.disabled = true;
    this._setStatus(this._agentStatus, 'Creating agent...', '');

    try {
      const agent = await this._client.createAgent(this._sessionId, DEFAULT_AGENT_CONFIG);
      this._agentId = agent.id;
      this._setStatus(this._agentStatus, `Agent: ${agent.id} (Greta)`, 'success');
      this._msgInput.disabled = false;
      this._sendBtn.disabled = false;
      this._msgInput.focus();
    } catch (err) {
      this._setStatus(this._agentStatus, err.message, 'error');
      this._agentBtn.disabled = false;
    }
  }

  async _sendMessage() {
    const text = this._msgInput.value.trim();
    if (!text) return;

    this._sendBtn.disabled = true;
    this._msgInput.value = '';
    const start = performance.now();

    try {
      const messages = [
        { message_type: 'ContentMessage', content: text },
      ];

      const result = await this._client.generateAction(
        this._sessionId, this._agentId, messages, AGENT_FUNCTIONS,
      );

      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      const fc = result.function_call;

      this._appendLog(
        `<span class="be-log-action">${fc.name}</span>` +
        (fc.args?.text ? `: <span class="be-log-text">"${this._escapeHtml(fc.args.text)}"</span>` : '') +
        `<br><span class="be-log-meta">moment: ${result.moment_id} | ${elapsed}s | you said: "${this._escapeHtml(text)}"</span>`,
      );
    } catch (err) {
      this._appendLog(`<span class="be-status error">${this._escapeHtml(err.message)}</span>`);
    }

    this._sendBtn.disabled = false;
    this._msgInput.focus();
  }

  // --- DOM helpers ---

  _makeSection(label) {
    const el = document.createElement('div');
    el.className = 'be-section';
    el.textContent = label;
    return el;
  }

  _makeRow(label) {
    const row = document.createElement('div');
    row.className = 'be-row';
    const lbl = document.createElement('label');
    lbl.className = 'be-label';
    lbl.textContent = label;
    row.appendChild(lbl);
    return row;
  }

  _makeInput(type, value, placeholder) {
    const input = document.createElement('input');
    input.className = 'be-input';
    input.type = type;
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.autocomplete = 'off';
    return input;
  }

  _makeBtn(label) {
    const btn = document.createElement('button');
    btn.className = 'be-btn';
    btn.textContent = label;
    return btn;
  }

  _makeStatus() {
    const el = document.createElement('div');
    el.className = 'be-status';
    return el;
  }

  _setStatus(el, text, cls) {
    el.textContent = text;
    el.className = 'be-status' + (cls ? ` ${cls}` : '');
  }

  _appendLog(html) {
    // Clear the "no responses yet" placeholder
    const empty = this._log.querySelector('.be-log-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'be-log-entry';
    entry.innerHTML = html;
    this._log.appendChild(entry);
    this._log.scrollTop = this._log.scrollHeight;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Config persistence ---

  _loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        proxyUrl: saved.proxyUrl || 'https://ws.discorddungeons.com',
        projectId: saved.projectId || (typeof __BE_PROJECT_ID__ !== 'undefined' ? __BE_PROJECT_ID__ : ''),
      };
    } catch {
      return { proxyUrl: 'https://ws.discorddungeons.com', projectId: '' };
    }
  }

  _saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        proxyUrl: this._proxyInput.value.trim(),
        projectId: this._projectInput.value.trim(),
      }));
    } catch { /* localStorage may be unavailable */ }
  }
}
