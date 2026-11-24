
'use strict';

class AnjanaCore {
  constructor() {
    this.name = 'ANJANA AI';
    this.version = '9.0.0';
    this.languages = ['si', 'en'];
    this.modes = ['offline', 'hybrid', 'online'];
    this.status = 'ready';
  }

  getStatus() {
    return {
      name: this.name,
      version: this.version,
      status: this.status,
      languages: this.languages,
      modes: this.modes
    };
  }

  validateMessage(message) {
    if (typeof message !== 'string') {
      return false;
    }

    const value = message.trim();

    return value.length > 0 && value.length <= 8000;
  }

  detectLanguage(message) {
    if (/[\u0D80-\u0DFF]/.test(message)) {
      return 'si';
    }

    return 'en';
  }

  createRequest(message) {
    if (!this.validateMessage(message)) {
      throw new Error('Invalid message');
    }

    return {
      message: message.trim(),
      language: this.detectLanguage(message),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AnjanaCore;
