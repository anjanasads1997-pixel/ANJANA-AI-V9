
'use strict';

const fs = require('node:fs');
const path = require('node:path');

class UserStore {
  constructor(filePath = './data/users.json') {
    this.filePath = path.resolve(filePath);
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
    try {
      const data = fs.readFileSync(this.filePath, 'utf8');
      const users = JSON.parse(data);
      return Array.isArray(users) ? users : [];
    } catch {
      throw new Error('User database could not be read');
    }
  }

  writeAll(users) {
    const temp = `${this.filePath}.tmp`;

    fs.writeFileSync(temp, JSON.stringify(users, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });

    fs.renameSync(temp, this.filePath);
  }

  findByUsername(username) {
    const key = String(username).trim().toLowerCase();

    return this.readAll().find(
      user => user.username === key
    ) || null;
  }

  findById(id) {
    return this.readAll().find(
      user => user.id === id
    ) || null;
  }

  create(user) {
    const users = this.readAll();
    const username = String(user.username)
      .trim()
      .toLowerCase();

    if (!username || this.findByUsername(username)) {
      throw new Error('Username already exists');
    }

    const record = {
      id: user.id,
      username,
      passwordHash: user.passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(record);
    this.writeAll(users);

    return {
      id: record.id,
      username: record.username,
      createdAt: record.createdAt
    };
  }
}

module.exports = UserStore;
