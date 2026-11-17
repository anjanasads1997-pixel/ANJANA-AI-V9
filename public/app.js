import { LiveAvatarSession, SessionEvent } from "@heygen/liveavatar-web-sdk";

const $ = (id) => document.getElementById(id);
const authScreen = $('authScreen');
const appScreen = $('appScreen');
const authNotice = $('authNotice');
const avatarVideo = $('avatarVideo');
const avatarPlaceholder = $('avatarPlaceholder');
const avatarMessage = $('avatarMessage');
const chatNotice = $('chatNotice');
const chatLog = $('chatLog');

let authMode = 'login';
let avatarSession = null;
let avatarReady = false;
let speechRecognition = null;
let speechActive = false;

function showNotice(element, message) {
  element.textContent = message || '';
}
function addBubble(kind, text) {
  const node = document.createElement('div');
  node.className = `bubble ${kind}`;
  node.textContent = text;
  chatLog.appendChild(node);
  chatLog.scrollTop = chatLog.scrollHeight;
  return node;
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function checkSession() {
  try {
    const data = await api('/api/auth/me');
    if (data.authenticated && data.user) showApp(data.user);
    else showAuth();
  } catch {
    showAuth();
  }
}
function showAuth() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}
function showApp(user) {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  $('userLabel').textContent = user?.username || 'Signed in';
  $('authState').textContent = `Signed in as ${user?.username || 'user'}`;
  checkSystem();
}
async function checkSystem() {
  try {
    const [health, ai, avatar] = await Promise.all([
      api('/api/health'),
      api('/api/ai/status'),
      api('/api/avatar/status')
    ]);
    $('aiDot').classList.toggle('ok', Boolean(ai.onlineReady || ai.ollama?.online));
    $('aiStatus').textContent = ai.onlineReady ? 'Online AI ready' : (ai.ollama?.online ? 'Local AI ready' : 'AI needs setup');
    $('providerState').textContent = `${ai.provider} · OpenAI ${ai.openaiConfigured ? 'ready' : 'not configured'} · Ollama ${ai.ollama?.online ? 'online' : 'offline'}`;
    $('liveState').textContent = avatar.configured ? 'LiveAvatar API key detected' : 'LiveAvatar API key missing';
    $('ttsState').textContent = avatar.ttsConfigured ? 'OpenAI TTS configured' : 'OpenAI TTS key missing';
    $('avatarDot').classList.toggle('ok', avatar.configured);
    $('avatarStatus').textContent = avatar.configured ? 'Ready to start' : 'Not configured';
  } catch (error) {
    $('aiStatus').textContent = 'Status unavailable';
    $('providerState').textContent = error.message;
  }
}

async function authenticate(mode) {
  const username = $('username').value.trim();
  const password = $('password').value;
  if (!username || !password) {
    showNotice(authNotice, 'Username සහ Password ඇතුළත් කරන්න.');
    return;
  }
  $('loginBtn').disabled = true;
  $('registerBtn').disabled = true;
  try {
    const data = await api(`/api/auth/${mode}`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (mode === 'register') {
      showNotice(authNotice, 'ගිණුම සාර්ථකව සෑදුවා. දැන් Login වන්න.');
      $('password').value = '';
      authMode = 'login';
    } else {
      $('password').value = '';
      showApp(data.user);
    }
  } catch (error) {
    showNotice(authNotice, error.message);
  } finally {
    $('loginBtn').disabled = false;
    $('registerBtn').disabled = false;
  }
}
$('loginBtn').addEventListener('click', () => authenticate('login'));
$('registerBtn').addEventListener('click', () => authenticate('register'));

async function startAvatar() {
  if (avatarSession) return;
  $('startAvatarBtn').disabled = true;
  showNotice(avatarMessage, 'Creating a secure LiveAvatar session…');
  try {
    const data = await api('/api/avatar/session', { method: 'POST', body: JSON.stringify({}) });
    const session = new LiveAvatarSession(data.session_token, {
      autoKeepAlive: true,
      voiceChat: { defaultMuted: true }
    });
    avatarSession = session;
    avatarReady = false;
    session.on(SessionEvent.SESSION_STREAM_READY, () => {
      if (avatarSession !== session) return;
      session.attach(avatarVideo);
      avatarVideo.classList.remove('hidden');
      avatarPlaceholder.classList.add('hidden');
      avatarVideo.play().catch(() => {
        showNotice(avatarMessage, 'Avatar stream connected. Tap the video to allow playback.');
      });
      avatarReady = true;
      $('avatarDot').classList.add('ok');
      $('avatarStatus').textContent = 'Live';
      $('qualityLabel').textContent = 'Video stream ready';
      showNotice(avatarMessage, 'LiveAvatar සජීවීව සම්බන්ධ වී ඇත. දැන් පණිවිඩයක් යවන්න.');
    });
    session.on(SessionEvent.SESSION_DISCONNECTED, () => {
      if (avatarSession === session) resetAvatarUi('Avatar session disconnected.');
    });
    await session.start();
    $('stopAvatarBtn').disabled = false;
    $('avatarStatus').textContent = 'Connecting…';
    $('qualityLabel').textContent = 'Connecting video';
    showNotice(avatarMessage, 'Session started. Waiting for the avatar video stream…');
  } catch (error) {
    avatarSession = null;
    avatarReady = false;
    $('startAvatarBtn').disabled = false;
    $('avatarStatus').textContent = 'Connection failed';
    showNotice(avatarMessage, error.message);
  }
}
function resetAvatarUi(message) {
  avatarSession = null;
  avatarReady = false;
  $('startAvatarBtn').disabled = false;
  $('stopAvatarBtn').disabled = true;
  $('avatarDot').classList.remove('ok');
  $('avatarStatus').textContent = 'Offline';
  $('qualityLabel').textContent = 'Waiting for connection';
  avatarVideo.classList.add('hidden');
  avatarPlaceholder.classList.remove('hidden');
  avatarVideo.srcObject = null;
  showNotice(avatarMessage, message || 'Avatar session stopped.');
}
async function stopAvatar() {
  const session = avatarSession;
  if (!session) return;
  $('stopAvatarBtn').disabled = true;
  showNotice(avatarMessage, 'Stopping LiveAvatar session…');
  try {
    await session.stop();
  } catch (error) {
    console.warn('Avatar stop warning:', error);
  } finally {
    resetAvatarUi('LiveAvatar session stopped.');
  }
}
$('startAvatarBtn').addEventListener('click', startAvatar);
$('stopAvatarBtn').addEventListener('click', stopAvatar);

async function sendMessage() {
  const message = $('messageInput').value.trim();
  if (!message) return;
  $('sendBtn').disabled = true;
  $('messageInput').value = '';
  addBubble('user', message);
  const pending = addBubble('ai', 'ANJANA AI පිළිතුර සකස් කරමින්…');
  showNotice(chatNotice, '');
  try {
    const result = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    pending.textContent = result.reply;
    if (avatarSession && avatarReady) {
      showNotice(chatNotice, 'Avatar හඬ සකස් කරමින්…');
      const voice = $('voiceSelect').value;
      const audioData = await api('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text: result.reply, voice })
      });
      avatarSession.repeatAudio(audioData.audio);
      showNotice(chatNotice, 'ANJANA Avatar පිළිතුර හඬින් ලබාදෙමින් සිටී.');
    } else {
      showNotice(chatNotice, 'පිළිතුර ලැබුණා. Avatar එකෙන් හඬින් පිළිතුරු ලබාගැනීමට Live Avatar ආරම්භ කරන්න.');
    }
  } catch (error) {
    pending.textContent = `දෝෂය: ${error.message}`;
    showNotice(chatNotice, error.message);
  } finally {
    $('sendBtn').disabled = false;
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}
$('sendBtn').addEventListener('click', sendMessage);
$('messageInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $('micBtn').disabled = true;
    $('micBtn').title = 'Speech recognition is not supported by this browser. Type your message instead.';
    return;
  }
  speechRecognition = new Recognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.lang = $('languageSelect').value === 'si' ? 'si-LK' : 'en-US';
  speechRecognition.onstart = () => {
    speechActive = true;
    $('micBtn').textContent = '■ Stop listening';
    showNotice(chatNotice, 'ඔබගේ කථාව අසමින් සිටී…');
  };
  speechRecognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    $('messageInput').value = transcript;
  };
  speechRecognition.onerror = (event) => showNotice(chatNotice, `Voice input: ${event.error}`);
  speechRecognition.onend = () => {
    speechActive = false;
    $('micBtn').textContent = '🎙 Voice Input';
  };
}
$('languageSelect').addEventListener('change', () => {
  if (speechRecognition) speechRecognition.lang = $('languageSelect').value === 'si' ? 'si-LK' : 'en-US';
  $('messageInput').placeholder = $('languageSelect').value === 'si' ? 'ඔබගේ පණිවිඩය ලියන්න...' : 'Type your message…';
});
$('micBtn').addEventListener('click', () => {
  if (!speechRecognition) setupSpeechRecognition();
  if (!speechRecognition) return;
  try {
    if (speechActive) speechRecognition.stop();
    else speechRecognition.start();
  } catch (error) {
    showNotice(chatNotice, error.message);
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await stopAvatar();
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.warn('Logout:', error.message);
  }
  showAuth();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
setupSpeechRecognition();
checkSession();
