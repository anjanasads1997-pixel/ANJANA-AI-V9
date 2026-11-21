'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class ContextStore {
  constructor(options = {}) {
    this.filePath = options.filePath || '';
    this.encryptionKey = options.encryptionKey ? crypto.createHash('sha256').update(String(options.encryptionKey)).digest() : null;
    this.maxConversations = options.maxConversations || 40;
    this.maxMessages = options.maxMessages || 24;
    this.maxMessageChars = options.maxMessageChars || 8000;
    this.store = new Map();
    this._load();
  }

  _key(userId, conversationId) {
    const user = String(userId || '').slice(0, 128);
    const conversation = String(conversationId || '').slice(0, 128);
    if (!user || !/^[a-zA-Z0-9_-]{6,128}$/.test(conversation)) {
      throw new Error('Invalid conversation identifier');
    }
    return `${user}:${conversation}`;
  }

  _load() {
    if (!this.filePath) return;
    try {
      if (!this.encryptionKey) return; // No plaintext persistence: memory remains process-local.
      const envelope = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      if (!envelope || envelope.algorithm !== 'aes-256-gcm' || !envelope.iv || !envelope.tag || !envelope.data) {
        throw new Error('Encrypted context file has an invalid envelope');
      }
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8');
      const parsed = JSON.parse(plaintext);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed).slice(-2000)) {
          if (value && Array.isArray(value.messages)) {
            this.store.set(key, {
              updatedAt: Number(value.updatedAt) || Date.now(),
              messages: this._cleanMessages(value.messages)
            });
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Brain context load failed:', error.message);
    }
  }

  _cleanMessages(messages) {
    return messages.filter(item =>
      item && ['user', 'assistant'].includes(item.role) &&
      typeof item.content === 'string' && item.content.trim()
    ).slice(-this.maxMessages).map(item => ({
      role: item.role,
      content: item.content.slice(0, this.maxMessageChars)
    }));
  }

  _persist() {
    if (!this.filePath || !this.encryptionKey) return;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const data = Object.fromEntries(this.store);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
      const envelope = JSON.stringify({
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: encrypted.toString('base64')
      });
      const temp = `${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(temp, envelope, { mode: 0o600 });
      fs.renameSync(temp, this.filePath);
    } catch (error) {
      console.error('Brain context save failed:', error.message);
    }
  }

  get(userId, conversationId) {
    const key = this._key(userId, conversationId);
    const record = this.store.get(key);
    return record ? record.messages.map(item => ({ ...item })) : [];
  }

  append(userId, conversationId, userMessage, assistantMessage) {
    const key = this._key(userId, conversationId);
    const current = this.store.get(key) || { updatedAt: Date.now(), messages: [] };
    const messages = this._cleanMessages([
      ...current.messages,
      { role: 'user', content: String(userMessage).slice(0, this.maxMessageChars) },
      { role: 'assistant', content: String(assistantMessage).slice(0, this.maxMessageChars) }
    ]);
    this.store.delete(key);
    this.store.set(key, { updatedAt: Date.now(), messages });
    while (this.store.size > this.maxConversations) {
      this.store.delete(this.store.keys().next().value);
    }
    this._persist();
    return messages.map(item => ({ ...item }));
  }

  clear(userId, conversationId) {
    const key = this._key(userId, conversationId);
    const removed = this.store.delete(key);
    if (removed) this._persist();
    return removed;
  }

  getStatus() {
    return { activeConversations: this.store.size, maxConversations: this.maxConversations, maxMessagesPerConversation: this.maxMessages, persistence: Boolean(this.filePath && this.encryptionKey), encryption: this.encryptionKey ? 'AES-256-GCM' : 'disabled; process-memory only' };
  }
}

module.exports = ContextStore;
