
'use strict';

const language = document.getElementById('language');
const form = document.getElementById('chatForm');
const promptInput = document.getElementById('prompt');
const messages = document.getElementById('messages');
const status = document.getElementById('status');

const translations = {
  si: {
    welcome: 'ආයුබෝවන්! ANJANA AI වෙත සාදරයෙන් පිළිගනිමු.',
    placeholder: 'ඔබගේ ප්‍රශ්නය ලියන්න...',
    waiting: 'පිළිතුර සකස් කරමින්...',
    error: 'ප්‍රතිචාරය ලබාගැනීමට නොහැකි විය.'
  },
  en: {
    welcome: 'Welcome to ANJANA AI!',
    placeholder: 'Type your question...',
    waiting: 'Thinking...',
    error: 'Unable to get a response.'
  }
};

function addMessage(role, text) {
  const item = document.createElement('p');
  item.textContent = text;
  item.dataset.role = role;
  messages.appendChild(item);
}

language.addEventListener('change', () => {
  const selected = translations[language.value];
  promptInput.placeholder = selected.placeholder;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = promptInput.value.trim();
  if (!message) return;

  addMessage('user', message);
  promptInput.value = '';

  const waiting = document.createElement('p');
  waiting.textContent = translations[language.value].waiting;
  messages.appendChild(waiting);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'AI service unavailable');
    }

    waiting.textContent = data.reply;
  } catch (error) {
    waiting.textContent =
      translations[language.value].error + ' ' + error.message;
  }
});

async function checkStatus() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error();

    status.textContent =
      language.value === 'si'
        ? 'ANJANA AI සේවාදායකය ක්‍රියාත්මකයි.'
        : 'ANJANA AI server is running.';
  } catch {
    status.textContent =
      language.value === 'si'
        ? 'සේවාදායකය සමඟ සම්බන්ධ විය නොහැක.'
        : 'Cannot connect to the server.';
  }
}

checkStatus();
