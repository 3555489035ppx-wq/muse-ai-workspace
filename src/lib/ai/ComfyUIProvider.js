const stripTrailingSlash = (value) => value.replace(/\/$/, '');

export class ComfyUIError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ComfyUIError';
    this.details = details;
  }
}

/**
 * Clean Muse implementation of ComfyUI's public HTTP/WebSocket protocol.
 * ComfyUI itself remains a separate GPL-3.0 service.
 */
export class ComfyUIProvider {
  constructor({ baseUrl = 'http://127.0.0.1:8188', fetchImpl = fetch, WebSocketImpl = WebSocket } = {}) {
    this.baseUrl = stripTrailingSlash(baseUrl);
    this.fetch = fetchImpl;
    this.WebSocket = WebSocketImpl;
  }

  async request(path, options = {}) {
    const response = await this.fetch(`${this.baseUrl}${path}`, options);
    // Keep the production path on raw text so malformed upstream payloads are
    // handled explicitly. The json fallback supports lightweight fetch
    // doubles used by integrations that only implement Response.json().
    const raw = typeof response.text === 'function'
      ? await response.text()
      : typeof response.json === 'function'
        ? JSON.stringify(await response.json())
        : '';
    if (!response.ok) throw new ComfyUIError(`本地图像服务请求失败：${response.status}`, raw.slice(0, 500));
    if (!raw.trim()) throw new ComfyUIError('本地图像服务未返回内容');
    try {
      return JSON.parse(raw);
    } catch {
      throw new ComfyUIError('本地图像服务返回格式无法识别');
    }
  }

  queuePrompt(workflow, { clientId = crypto.randomUUID(), extraData } = {}) {
    return this.request('/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId, extra_data: extraData }),
    }).then((result) => ({ ...result, clientId }));
  }

  getHistory(promptId) {
    return this.request(`/history/${encodeURIComponent(promptId)}`);
  }

  getImageUrl({ filename, subfolder = '', type = 'output' }) {
    const query = new URLSearchParams({ filename, subfolder, type });
    return `${this.baseUrl}/view?${query}`;
  }

  async execute(workflow, { signal, onEvent, clientId = crypto.randomUUID() } = {}) {
    const socketUrl = new URL(this.baseUrl);
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    socketUrl.pathname = '/ws';
    socketUrl.search = new URLSearchParams({ clientId }).toString();
    const socket = new this.WebSocket(socketUrl);
    const queued = await this.queuePrompt(workflow, { clientId });

    return new Promise((resolve, reject) => {
      const close = () => { if (socket.readyState < 2) socket.close(); };
      const abort = () => { close(); reject(new DOMException('AI 生成已取消', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once: true });
      socket.onerror = () => { close(); reject(new ComfyUIError('无法连接本地图像服务')); };
      socket.onmessage = async (event) => {
        if (typeof event.data !== 'string') return;
        const message = JSON.parse(event.data);
        onEvent?.(message);
        const data = message.data ?? {};
        if (message.type === 'execution_error' && data.prompt_id === queued.prompt_id) {
          close(); reject(new ComfyUIError('本地图像工作流执行失败', data));
        }
        if (message.type === 'executing' && data.prompt_id === queued.prompt_id && data.node == null) {
          const history = await this.getHistory(queued.prompt_id);
          close(); resolve({ promptId: queued.prompt_id, clientId, history: history[queued.prompt_id] ?? history });
        }
      };
    });
  }
}

export function createComfyUIProviderFromEnv() {
  const baseUrl = import.meta.env.VITE_COMFYUI_URL;
  return baseUrl ? new ComfyUIProvider({ baseUrl }) : null;
}
