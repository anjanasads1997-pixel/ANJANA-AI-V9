
'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

class AuthManager {
  async hashPassword(password) {
    if (typeof password !== 'string' || password.length < 10) {
      throw new Error('Password must contain at least 10 characters');
    }

    const salt = crypto.randomBytes(16).toString('hex');

    const derivedKey = await scrypt(
      password,
      salt,
      64
    );

    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  async verifyPassword(password, storedHash) {
    if (
      typeof password !== 'string' ||
      typeof storedHash !== 'string'
    ) {
      return false;
    }

    const parts = storedHash.split('$');

    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }

    const [, salt, expectedHex] = parts;

    if (!/^[a-f0-9]{32}$/i.test(salt)) {
      return false;
    }

    if (!/^[a-f0-9]{128}$/i.test(expectedHex)) {
      return false;
    }

    try {
      const expected = Buffer.from(expectedHex, 'hex');

      const actual = await scrypt(
        password,
        salt,
        expected.length
      );

      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  createId() {
    return crypto.randomUUID();
  }
}

module.exports = AuthManager;
