// --- Behavior Engine REST Client ---
// Thin wrapper over the Artificial Agency API. Handles auth headers,
// base URL, and API versioning. All methods return parsed JSON responses.

const BASE_URL = 'https://api.artificial.agency';
const API_VERSION = '2025-05-15';

export class BehaviorEngineClient {
  constructor(apiKey, projectId, baseUrl = BASE_URL) {
    this._apiKey = apiKey;
    this._projectId = projectId;
    this._baseUrl = baseUrl;
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
    const res = await fetch(`${this._baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this._apiKey}`,
        'AA-API-Version': API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.detail || data.message || JSON.stringify(data);
      throw new Error(`BE API ${res.status}: ${msg}`);
    }

    return data;
  }
}
