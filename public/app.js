/* ANJANA AI V9.0.1 — Public frontend controller
 * API secrets remain on the server. This file never asks for or stores provider keys.
 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    token: sessionStorage.getItem("anjana_token") || "",
    user: sessionStorage.getItem("anjana_user") || "",
    room: null,
    sessionToken: null,
    avatarSession: null,
    avatarSdk: null,
    avatarReady: false,
    recognition: null,
    voiceEnabled: true,
    busy: false
  };

  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const show = (el, yes) => { if (el) el.classList.toggle("hidden", !yes); };
  async function request(path, options = {}) {
    const headers = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  function notice(id, message, error = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.style.color = error ? "#ff8294" : "#9fe9ff";
  }

  function setAuthenticated(yes) {
    show($("authScreen"), !yes);
    show($("appScreen"), yes);
    setText("authState", yes ? `Signed in${state.user ? ` · ${state.user}` : ""}` : "Signed out");
  }

  async function healthCheck() {
    try {
      const h = await request("/api/health");
      let aiInfo = {};
      try { aiInfo = await request("/api/ai/status"); } catch {}
      const aiReady = Boolean(aiInfo.openaiConfigured || aiInfo.ollama?.available || aiInfo.onlineReady);
      setText("providerState", aiInfo.provider || (aiReady ? "Configured" : "Backend online; AI provider check required"));
      setText("liveState", h.features?.liveAvatar ? "Configured" : "Backend configuration required");
      setText("ttsState", ("speechSynthesis" in window) ? "Browser voice available" : "Voice unavailable");
      setText("aiStatus", aiReady ? "AI service online" : "Backend online");
      $("aiDot")?.classList.toggle("ok", aiReady);
      $("aiDot")?.classList.toggle("offline", !aiReady);
    } catch {
      setText("providerState", "Not connected");
      setText("liveState", "Check backend configuration");
      setText("ttsState", ("speechSynthesis" in window) ? "Browser voice available" : "Voice unavailable");
      setText("aiStatus", "Backend offline");
      $("aiDot")?.classList.remove("ok");
      $("aiDot")?.classList.add("offline");
    }
  }

  async function authenticate(kind) {
    const username = $("username")?.value.trim();
    const password = $("password")?.value || "";
    if (!username || !password) {
      return notice("authNotice", "Username සහ password ඇතුළත් කරන්න.", true);
    }
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      return notice("authNotice", "Username අකුරු, ඉලක්කම් හෝ underscore 3–30 අතර විය යුතුයි.", true);
    }
    if (password.length < 10 || password.length > 128) {
      return notice("authNotice", "Password අක්ෂර 10–128 අතර විය යුතුයි.", true);
    }

    const btn = $(kind === "login" ? "loginBtn" : "registerBtn");
    if (btn) btn.disabled = true;
    notice("authNotice", "කරුණාකර රැඳී සිටින්න…");

    try {
      const data = await request(`/api/auth/${kind}`, {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      if (kind === "register") {
        notice("authNotice", "ගිණුම සාර්ථකව නිර්මාණය කළා. දැන් Login වන්න.");
        $("password").value = "";
        return;
      }

      // Backend sets an HttpOnly anjana_session cookie; it intentionally returns no JWT.
      const current = await request("/api/auth/me");
      state.user = current.user?.username || data.user?.username || username;
      state.token = "cookie-session";
      setAuthenticated(true);
      notice("authNotice", "");
      await healthCheck();
    } catch (e) {
      notice("authNotice", e.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function logout() {
    try {
      await stopAvatar(false);
      await request("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Clear the local UI even if the network is temporarily unavailable.
      console.warn("Logout request could not be confirmed:", e.message);
    }
    state.token = "";
    state.user = "";
    state.sessionToken = null;
    sessionStorage.removeItem("anjana_token");
    sessionStorage.removeItem("anjana_user");
    setAuthenticated(false);
  }

  function appendMessage(role, text) {
    const log = $("chatLog");
    if (!log) return;
    const item = document.createElement("div");
    item.className = `message ${role === "assistant" ? "assistant" : "user"}`;
    item.setAttribute("role", "article");
    const label = document.createElement("strong");
    label.textContent = role === "user" ? "You" : "ANJANA AI";
    const body = document.createElement("div");
    body.textContent = text;
    item.append(label, body);
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  async function loadAvatarSdk() {
    if (state.avatarSdk) return state.avatarSdk;
    const sdk = await import("https://esm.sh/@heygen/liveavatar-web-sdk@0.0.20?bundle");
    if (!sdk.LiveAvatarSession || !sdk.SessionEvent) {
      throw new Error("LiveAvatar SDK module did not load correctly.");
    }
    state.avatarSdk = sdk;
    return sdk;
  }

  function base64ToBinaryString(base64) {
    return atob(base64);
  }

  async function speak(text) {
    if (!state.voiceEnabled) return;
    const cleanText = String(text).slice(0, 3500);

    if (state.avatarSession && state.avatarReady) {
      try {
        const audio = await request("/api/tts", {
          method: "POST",
          body: JSON.stringify({
            text: cleanText,
            voice: $("voiceSelect")?.value || "coral"
          })
        });
        if (!audio.audio || audio.sample_rate !== 24000 || audio.format !== "pcm_s16le") {
          throw new Error("TTS audio must be PCM 16-bit, 24 kHz mono for LiveAvatar.");
        }
        state.avatarSession.repeatAudio(base64ToBinaryString(audio.audio));
        avatarStatus("Avatar speaking · Real-time lip sync active", true);
        return;
      } catch (error) {
        console.warn("LiveAvatar speech path unavailable:", error);
        avatarStatus(`Lip-sync voice unavailable: ${error.message}`);
        return;
      }
    }

    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = /[\u0D80-\u0DFF]/.test(cleanText) ? "si-LK" : "en-US";
    const wanted = $("voiceSelect")?.value;
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => wanted && v.name.toLowerCase().includes(wanted)) ||
      voices.find(v => v.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2)));
    if (match) utterance.voice = match;
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage() {
    const input = $("messageInput");
    const text = input?.value.trim();
    if (!text || state.busy) return;
    if (!state.token) return notice("chatNotice", "පළමුව Login වන්න.", true);
    state.busy = true;
    if ($("sendBtn")) $("sendBtn").disabled = true;
    appendMessage("user", text);
    input.value = "";
    notice("chatNotice", "ANJANA AI පිළිතුර සකස් කරමින්…");
    try {
      const data = await request("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          language: $("languageSelect")?.value || "si",
          voice: $("voiceSelect")?.value || "coral"
        })
      });
      const answer = data.reply || data.response || data.message || data.answer || "පිළිතුරක් ලැබුණේ නැත.";
      appendMessage("assistant", answer);
      notice("chatNotice", "");
      speak(answer);
    } catch (e) {
      notice("chatNotice", `දෝෂය: ${e.message}`, true);
      appendMessage("assistant", `සම්බන්ධතා දෝෂයක්: ${e.message}`);
    } finally {
      state.busy = false;
      if ($("sendBtn")) $("sendBtn").disabled = false;
      input?.focus();
    }
  }

  function loadLiveKit() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    if (window.__anjanaLiveKitPromise) return window.__anjanaLiveKitPromise;
    window.__anjanaLiveKitPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js";
      s.onload = () => window.LivekitClient ? resolve(window.LivekitClient) : reject(new Error("LiveKit SDK unavailable"));
      s.onerror = () => reject(new Error("LiveKit SDK download failed"));
      document.head.appendChild(s);
    });
    return window.__anjanaLiveKitPromise;
  }

  function avatarStatus(message, online = false) {
    setText("avatarMessage", message);
    setText("avatarStatus", online ? "Live" : "Offline");
    setText("qualityLabel", online ? "Connected" : "Waiting for connection");
    const dot = $("avatarDot");
    if (dot) dot.classList.toggle("online", online);
  }

  async function startAvatar() {
    const start = $("startAvatarBtn"), stop = $("stopAvatarBtn");
    if (!state.token) return avatarStatus("පළමුව Login වන්න.");
    if (state.avatarSession) return avatarStatus("LiveAvatar session එක දැනටමත් ආරම්භ කර ඇත.", state.avatarReady);
    if (start) start.disabled = true;
    avatarStatus("LiveAvatar SDK සූදානම් කරමින්…");

    try {
      const [sdk, data] = await Promise.all([
        loadAvatarSdk(),
        request("/api/avatar/session", { method: "POST", body: JSON.stringify({}) })
      ]);
      if (!data.session_token) throw new Error("LiveAvatar session token එක ලැබුණේ නැත.");

      const session = new sdk.LiveAvatarSession(data.session_token, {
        autoKeepAlive: true,
        voiceChat: { defaultMuted: true }
      });
      state.avatarSession = session;
      state.sessionToken = data.session_token;
      state.avatarReady = false;

      session.on(sdk.SessionEvent.SESSION_STREAM_READY, () => {
        const video = $("avatarVideo");
        if (!video) return;
        try {
          session.attach(video);
          video.muted = false;
          video.autoplay = true;
          video.playsInline = true;
          video.classList.remove("hidden");
          show($("avatarPlaceholder"), false);
          video.play().catch(() => {
            avatarStatus("Avatar stream සූදානම්. Video එක play කිරීමට තිරය ස්පර්ශ කරන්න.", true);
          });
          state.avatarReady = true;
          setText("qualityLabel", "Live stream connected");
          avatarStatus("Live Avatar connected · Lip sync ready", true);
        } catch (error) {
          avatarStatus(`Avatar video attach දෝෂය: ${error.message}`);
        }
      });

      session.on(sdk.SessionEvent.SESSION_DISCONNECTED, () => {
        state.avatarReady = false;
        state.avatarSession = null;
        state.sessionToken = null;
        if (start) start.disabled = false;
        if (stop) stop.disabled = true;
        const video = $("avatarVideo");
        if (video) video.classList.add("hidden");
        show($("avatarPlaceholder"), true);
        avatarStatus("LiveAvatar session disconnected.");
      });

      await session.start();
      if (stop) stop.disabled = false;
      avatarStatus("LiveAvatar stream එක සම්බන්ධ වෙමින්…");
      setText("qualityLabel", "Connecting video/audio");
    } catch (e) {
      state.avatarSession = null;
      state.sessionToken = null;
      state.avatarReady = false;
      if (start) start.disabled = false;
      if (stop) stop.disabled = true;
      avatarStatus(`LiveAvatar ආරම්භ කළ නොහැක: ${e.message}`);
    }
  }

  async function stopAvatar() {
    const start = $("startAvatarBtn"), stop = $("stopAvatarBtn");
    const session = state.avatarSession;
    state.avatarSession = null;
    state.sessionToken = null;
    state.avatarReady = false;
    try {
      if (session && typeof session.stop === "function") await session.stop();
    } catch (error) {
      console.warn("LiveAvatar stop request failed:", error);
    }
    const video = $("avatarVideo");
    if (video) {
      video.pause();
      video.srcObject = null;
      video.classList.add("hidden");
    }
    show($("avatarPlaceholder"), true);
    if (start) start.disabled = false;
    if (stop) stop.disabled = true;
    avatarStatus("LiveAvatar session එක නවතා ඇත.");
  }

  function startMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return avatarStatus("මෙම browser එකේ Speech Recognition සහාය නොමැත.");
    if (state.recognition) { try { state.recognition.stop(); } catch {} }
    const rec = new SR();
    state.recognition = rec;
    rec.lang = $("languageSelect")?.value === "en" ? "en-US" : "si-LK";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      $("messageInput").value = event.results[0][0].transcript;
      sendMessage();
    };
    rec.onerror = () => notice("chatNotice", "Microphone input භාවිත කළ නොහැක.", true);
    rec.onend = () => { state.recognition = null; };
    try { rec.start(); notice("chatNotice", "කතා කරන්න…"); }
    catch (e) { notice("chatNotice", e.message, true); }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("loginBtn")?.addEventListener("click", () => authenticate("login"));
    $("registerBtn")?.addEventListener("click", () => authenticate("register"));
    $("logoutBtn")?.addEventListener("click", logout);
    $("sendBtn")?.addEventListener("click", sendMessage);
    $("messageInput")?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    $("startAvatarBtn")?.addEventListener("click", startAvatar);
    $("stopAvatarBtn")?.addEventListener("click", () => stopAvatar(true));
    $("micBtn")?.addEventListener("click", startMic);
    $("voiceToggle")?.addEventListener("click", () => {
      state.voiceEnabled = !state.voiceEnabled;
      setText("voiceToggle", state.voiceEnabled ? "🔊 Voice: On" : "🔇 Voice: Off");
      if (!state.voiceEnabled && "speechSynthesis" in window) speechSynthesis.cancel();
      if (!state.voiceEnabled && state.avatarSession && state.avatarReady) {
        try { state.avatarSession.interrupt(); } catch (error) { console.warn("Avatar interrupt failed:", error); }
      }
    });
    setAuthenticated(false);
    healthCheck();
    request("/api/auth/me").then(data => {
      state.user = data.user?.username || data.username || "";
      state.token = "cookie-session";
      setAuthenticated(true);
    }).catch(() => {
      state.token = "";
      state.user = "";
      setAuthenticated(false);
    });
  });

  window.addEventListener("pagehide", () => {
    try { state.recognition?.stop(); } catch {}
    try { state.room?.disconnect(); } catch {}
    try { state.avatarSession?.stop(); } catch {}
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
})();