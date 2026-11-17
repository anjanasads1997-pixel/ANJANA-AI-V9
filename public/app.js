'use strict';

const authPanel = document.getElementById('authPanel');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authHelp = document.getElementById('authHelp');
const authSubmit = document.getElementById('authSubmit');
const toggleAuth = document.getElementById('toggleAuth');
const authNotice = document.getElementById('authNotice');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

const chatPanel = document.getElementById('chatPanel');
const welcomeUser = document.getElementById('welcomeUser');
const logoutButton = document.getElementById('logoutButton');
const language = document.getElementById('language');
const form = document.getElementById('chatForm');
const promptInput = document.getElementById('prompt');
const messages = document.getElementById('messages');
const status = document.getElementById('status');
const chatNotice = document.getElementById('chatNotice');
const sendButton = document.getElementById('sendButton');

let authMode = 'login';

const translations = {
  si: {
    placeholder: 'ඔබගේ ප්‍රශ්නය ලියන්න...',
    waiting: 'පිළිතුර සකස් කරමින්...',
    error: 'ප්‍රතිචාරය ලබාගැනීමට නොහැකි විය.'
  },
  en: {
    placeholder: 'Type your question...',
    waiting: 'Thinking...',
    error: 'Unable to get a response.'
  }
};

function showAuth(message = '') {
  authPanel.classList.remove('hidden');
  chatPanel.classList.add('hidden');
  authNotice.textContent = message;
}

function showChat(user) {
  authPanel.classList.add('hidden');
  chatPanel.classList.remove('hidden');
  welcomeUser.textContent = 'Logged in as ' + user.username;
  chatNotice.textContent = '';
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  authTitle.textContent = registering ? 'Create account' : 'Login';
  authHelp.textContent = registering
    ? 'Username: අකුරු, ඉලක්කම් සහ _ පමණක් (අක්ෂර 3-30). Password: අක්ෂර 10-128.'
    : 'ඔබගේ ANJANA AI ගිණුමට ඇතුළු වන්න.';
  authSubmit.textContent = registering ? 'Register' : 'Login';
  toggleAuth.textContent = registering ? 'Back to login' : 'Create account';
  passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
  passwordInput.value = '';
  authNotice.textContent = '';
}

toggleAuth.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authSubmit.disabled = true;
  authNotice.textContent = authMode === 'register'
    ? 'ගිණුම සාදමින්...'
    : 'Login වෙමින්...';

  const payload = {
    username: usernameInput.value.trim(),
    password: passwordInput.value
  };

  try {
    const response = await fetch('/api/auth/' + authMode, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    if (authMode === 'register') {
      setAuthMode('login');
      authNotice.textContent = 'ගිණුම සාර්ථකව සෑදුවා. දැන් Login වන්න.';
      return;
    }

    passwordInput.value = '';
    showChat(data.user);
    await checkStatus();
  } catch (error) {
    authNotice.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
    showAuth('ඔබ Logout වී ඇත.');
    setAuthMode('login');
  } catch {
    chatNotice.textContent = 'Logout කිරීමේදී සම්බන්ධතා දෝෂයක් ඇති විය.';
  } finally {
    logoutButton.disabled = false;
  }
});

function addMessage(role, text) {
  const item = document.createElement('p');
  item.textContent = text;
  item.dataset.role = role;
  messages.appendChild(item);
}

language.addEventListener('change', () => {
  promptInput.placeholder = translations[language.value].placeholder;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = promptInput.value.trim();
  if (!message) return;

  addMessage('user', message);
  promptInput.value = '';
  sendButton.disabled = true;
  chatNotice.textContent = '';

  const waiting = document.createElement('p');
  waiting.textContent = translations[language.value].waiting;
  messages.appendChild(waiting);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json();

    if (response.status === 401) {
      waiting.textContent = 'Please log in first';
      showAuth('Session එක අවසන් වී ඇත. නැවත Login වන්න.');
      return;
    }
    if (!response.ok) throw new Error(data.error || 'AI service unavailable');
    waiting.textContent = data.reply;
  } catch (error) {
    waiting.textContent = translations[language.value].error + ' ' + error.message;
  } finally {
    sendButton.disabled = false;
  }
});

async function checkStatus() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error();
    status.textContent = language.value === 'si'
      ? 'ANJANA AI සේවාදායකය ක්‍රියාත්මකයි.'
      : 'ANJANA AI server is running.';
  } catch {
    status.textContent = language.value === 'si'
      ? 'සේවාදායකය සමඟ සම්බන්ධ විය නොහැක.'
      : 'Cannot connect to the server.';
  }
}

async function checkSession() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'same-origin'
    });
    if (!response.ok) {
      showAuth();
      return;
    }
    const data = await response.json();
    if (data.authenticated && data.user) showChat(data.user);
    else showAuth();
  } catch {
    showAuth('සේවාදායකය සමඟ සම්බන්ධ විය නොහැක.');
  }
}

checkStatus();
checkSession();
