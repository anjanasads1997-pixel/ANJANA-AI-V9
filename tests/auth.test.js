
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AuthManager = require('../src/auth/auth-manager');
const SessionManager = require('../src/auth/session-manager');
const UserStore = require('../src/auth/store');

test('Authentication Manager should load', () => {
  assert.equal(typeof AuthManager, 'function');
});

test('Session Manager should load', () => {
  assert.equal(typeof SessionManager, 'function');
});

test('User Store should load', () => {
  assert.equal(typeof UserStore, 'function');
});
