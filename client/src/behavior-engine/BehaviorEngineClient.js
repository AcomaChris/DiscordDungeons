// --- Behavior Engine REST Client ---
// Two modes:
// - Proxy (default): routes through WS server at /api/be/*. Server adds
//   auth headers so the API key never leaves the server.
// - Direct: calls api.artificial.agency directly (local dev, CORS issues
//   in production). Requires API key in the client.

const API_VERSION = '2025-05-15';

export class BehaviorEngineClient {
  /**
   * @param {object} opts
   * @param {string} opts.projectId - BE project ID (always needed)
   * @param {string} [opts.proxyUrl] - WS server base URL for proxy mode
   * @param {string} [opts.apiKey] - API key for direct mode (unused in proxy mode)
   * @param {string} [opts.directUrl] - Direct API URL (default: api.artificial.agency)
   */
  constructor({ projectId, proxyUrl, apiKey, directUrl }) {
    this._projectId = projectId;
    this._proxyUrl = proxyUrl;
    this._apiKey = apiKey;
    this._directUrl = directUrl || 'https://api.artificial.agency';
    // Use proxy mode when a proxy URL is provided
    this._useProxy = !!proxyUrl;
  }

  // --- Sessions ---

  async createSession(expiresIn = 3600) {
    return this._post('/v1/sessions', {
      project_id: this._projectId,
      expires_in: expiresIn,
    });
  }

  // --- Agents ---

  async createAgent(sessionId, config) {
    return this._post(`/v1/advanced/sessions/${sessionId}/agents`, config);
  }

  // --- Actions ---

  async generateAction(sessionId, agentId, messages, functions) {
    return this._post(
      `/v1/sessions/${sessionId}/agents/${agentId}/generate_function_call`,
      { messages, functions },
    );
  }

  // --- Internal ---

  async _post(path, body) {
    let url, headers;

    if (this._useProxy) {
      // Proxy mode: /api/be/v1/sessions → WS server forwards to BE API
      url = `${this._proxyUrl}/api/be${path}`;
      headers = { 'Content-Type': 'application/json' };
    } else {
      // Direct mode: call BE API with auth headers
      url = `${this._directUrl}${path}`;
      headers = {
        'Authorization': `Bearer ${this._apiKey}`,
        'AA-API-Version': API_VERSION,
        'Content-Type': 'application/json',
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.detail || data.message || data.error || JSON.stringify(data);
      throw new Error(`BE API ${res.status}: ${msg}`);
    }

    return data;
  }
}
