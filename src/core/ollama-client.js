
'use strict';

class OllamaClient {
  constructor(options = {}) {
    this.baseUrl = (
      options.baseUrl ||
      'http://127.0.0.1:11434'
    ).replace(/\/+$/, '');

    this.model = options.model || 'qwen2.5:3b';
    this.timeoutMs = options.timeoutMs || 120000;
  }

  async status() {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/tags`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!response.ok) {
        throw new Error('Ollama unavailable');
      }

      const data = await response.json();

      return {
        online: true,
        model: this.model,
        installedModels: (data.models || []).map(
          item => item.name
        )
      };
    } catch {
      return {
        online: false,
        model: this.model
      };
    }
  }

  async chat(message, context = []) {
    if (typeof message !== 'string' || !message.trim()) {
      throw new Error('A message is required');
    }

    const response = await fetch(
      `${this.baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...context.slice(-12).filter(item => ['user', 'assistant'].includes(item.role)).map(item => ({
              role: item.role,
              content: String(item.content).slice(0, 8000)
            })),
            { role: 'user', content: message.trim() }
          ],
          stream: false
        })
      }
    );

    if (!response.ok) {
      throw new Error('Ollama request failed');
    }

    const data = await response.json();

    return {
      reply: data.message?.content || '',
      model: this.model
    };
  }
}

module.exports = OllamaClient;
