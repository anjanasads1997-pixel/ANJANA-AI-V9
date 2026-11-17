
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

class SessionManager {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 1800000;
    this.filePath = path.resolve(
      options.filePath || './data/sessions.json'
    );

    fs.mkdirSync(path.dirname(this.filePath), {
      recursive: true
    });

    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '[]', {
        encoding: 'utf8',
        mode: 0o600
      });
    }
  }

  readAll() {
    const data = fs.readFileSync(this.filePath, 'utf8');
    const sessions = JSON.parse(data);

    if (!Array.isArray(sessions)) {
      throw new Error('Invalid session database');
    }

    return sessions;
  }

  writeAll(sessions) {
    const temp = `${this.filePath}.tmp`;

    fs.writeFileSync(temp, JSON.stringify(sessions, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });

    fs.renameSync(temp, this.filePath);
  }

  hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  create(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();

    const sessions = this.readAll();

    sessions.push({
      tokenHash: this.hashToken(token),
      userId,
      createdAt: now,
      expiresAt: now + this.ttlMs
    });

    this.writeAll(sessions);

    return {
      token,
      expiresAt: now + this.ttlMs
    };
  }

  get(token) {
    if (typeof token !== 'string' || !token) {
      return null;
    }

    const hash = this.hashToken(token);
    const sessions = this.readAll();
    const now = Date.now();

    const session = sessions.find(
      item => item.tokenHash === hash &&
        item.expiresAt > now
    );

    return session
      ? { userId: session.userId, expiresAt: session.expiresAt }
      : null;
  }

  revoke(token) {
    if (typeof token !== 'string' || !token) {
      return false;
    }

    const hash = this.hashToken(token);
    const sessions = this.readAll();
    const filtered = sessions.filter(
      item => item.tokenHash !== hash
    );

    this.writeAll(filtered);
    return filtered.length !== sessions.length;
  }

  cleanup() {
    const now = Date.now();
    const sessions = this.readAll();
    const active = sessions.filter(
      item => item.expiresAt > now
    );

    this.writeAll(active);
    return sessions.length - active.length;
  }
}

module.exports = SessionManager;
