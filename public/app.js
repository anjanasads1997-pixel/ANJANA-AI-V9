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
    recognition: null,
    voiceEnabled: true,
    busy: false
  };

  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const show = (el, yes) => { if (el) el.classList.toggle("hidden", !yes); };
  const authHeaders = () => state.token ? { Authorization: `Bearer ${state.token}` } : {};

  async function request(path, options = {}) {
    const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...authHeaders(), ...(options.headers || {}) };
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
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
      const aiReady = Boolean(h.ai_ready ?? h.ready ?? h.provider ?? h.ai_provider);
      setText("providerState", h.provider || h.ai_provider || (aiReady ? "Configured" : "Backend online"));
      setText("liveState", h.liveavatar_configured ? "Configured" : "Backend configuration required");
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
    if (!username || !password) return notice("authNotice", "Username සහ password ඇතුළත් කරන්න.", true);
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
      const token = data.token || data.access_token || data.session?.token;
      if (!token) throw new Error("Backend response එකේ login token එක නොමැත.");
      state.token = token;
      state.user = data.user?.username || data.user?.name || username;
      sessionStorage.setItem("anjana_token", token);
      sessionStorage.setItem("anjana_user", state.user);
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
    // Attempt to close the remote LiveAvatar session before clearing the auth token.
    await stopAvatar(true);
    state.token = "";
    state.user = "";
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

  function speak(text) {
    if (!state.voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 4000));
    u.lang = /[\u0D80-\u0DFF]/.test(text) ? "si-LK" : "en-US";
    const wanted = $("voiceSelect")?.value;
    const voices = speechSynthesis.getVoices();
    const match = voices.find(v => wanted && v.name.toLowerCase().includes(wanted)) ||
      voices.find(v => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
    if (match) u.voice = match;
    speechSynthesis.speak(u);
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
    if (!state.token) return avatarStatus("Login කර Live Avatar ආරම්භ කරන්න.");
    if (state.room || state.sessionToken) return avatarStatus("LiveAvatar session එක දැනටමත් ක්‍රියාත්මකයි.");
    if (start) start.disabled = true;
    avatarStatus("LiveAvatar session එක සම්බන්ධ කරමින්…");
    try {
      const data = await request("/api/liveavatar/session/start", {
        method: "POST",
        body: JSON.stringify({})
      });
      state.sessionToken = data.session_token || data.sessionToken;
      const livekitUrl = data.livekit_url || data.livekitUrl;
      const clientToken = data.livekit_client_token || data.livekit_token || data.token;
      if (!state.sessionToken || !livekitUrl || !clientToken) {
        throw new Error("Backend response එකේ LiveKit session තොරතුරු සම්පූර්ණ නැත.");
      }
      const LK = await loadLiveKit();
      const room = new LK.Room({ adaptiveStream: true, dynacast: true });
      state.room = room;
      room.on(LK.RoomEvent.TrackSubscribed, (track) => {
        const element = track.attach();
        if (track.kind === LK.Track.Kind.Video || track.kind === "video") {
          element.autoplay = true; element.playsInline = true;
          element.style.cssText = "width:100%;height:100%;object-fit:cover";
          const placeholder = $("avatarPlaceholder");
          const video = $("avatarVideo");
          if (video) {
            video.srcObject = element.srcObject;
            video.classList.remove("hidden");
            video.play().catch(() => {});
          } else if (placeholder) {
            placeholder.replaceChildren(element);
          }
        } else {
          element.autoplay = true;
          document.body.appendChild(element);
          element.play?.().catch(() => {});
        }
      });
      room.on(LK.RoomEvent.Disconnected, () => {
        if (state.room === room) {
          state.room = null;
          if (start) start.disabled = false;
          if (stop) stop.disabled = true;
          avatarStatus("LiveAvatar connection විසන්ධි විය.");
        }
      });
      await room.connect(livekitUrl, clientToken);
      // Microphone is activated only after the user explicitly presses Start.
      await room.localParticipant.setMicrophoneEnabled(true);
      if (stop) stop.disabled = false;
      avatarStatus("සජීවී Avatar සම්බන්ධයි. කතා කිරීම ආරම්භ කරන්න.", true);
    } catch (e) {
      try { await state.room?.disconnect(); } catch {}
      state.room = null;
      if (state.sessionToken) {
        try {
          await request("/api/liveavatar/session/stop", {
            method: "POST",
            body: JSON.stringify({ session_token: state.sessionToken })
          });
        } catch {}
      }
      state.sessionToken = null;
      if (start) start.disabled = false;
      if (stop) stop.disabled = true;
      avatarStatus(`LiveAvatar ආරම්භ කළ නොහැක: ${e.message}`);
    }
  }

  async function stopAvatar(sendRemote = true) {
    const start = $("startAvatarBtn"), stop = $("stopAvatarBtn");
    try {
      if (state.room) {
        try { await state.room.localParticipant.setMicrophoneEnabled(false); } catch {}
        await state.room.disconnect();
      }
    } catch {}
    state.room = null;
    if (sendRemote && state.sessionToken) {
      try {
        await request("/api/liveavatar/session/stop", {
          method: "POST",
          body: JSON.stringify({ session_token: state.sessionToken })
        });
      } catch (e) {
        avatarStatus("Local stream නවතා ඇත. Remote session stop තහවුරු කළ නොහැකි විය.");
      }
    }
    state.sessionToken = null;
    const video = $("avatarVideo");
    if (video) { video.pause(); video.srcObject = null; video.classList.add("hidden"); }
    if (start) start.disabled = false;
    if (stop) stop.disabled = true;
    avatarStatus("LiveAvatar session නවතා ඇත.");
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
    });
    setAuthenticated(Boolean(state.token));
    healthCheck();
    if (state.token) {
      request("/api/auth/me").then(data => {
        state.user = data.user?.username || data.username || state.user;
        setAuthenticated(true);
      }).catch(() => logout());
    }
  });

  window.addEventListener("pagehide", () => {
    try { state.recognition?.stop(); } catch {}
    try {
      if (state.room) {
        state.room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        state.room.disconnect();
      }
    } catch {}
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  });
})();