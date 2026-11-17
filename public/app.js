
/* ANJANA AI V9.0.1
   Public Frontend Controller
   API secrets remain on the server.
*/
(() => {
"use strict";

const $ = id => document.getElementById(id);

const state = {
 token: sessionStorage.getItem("anjana_token") || "",
 user: sessionStorage.getItem("anjana_user") || "",
 room: null,
 sessionToken: null,
 recognition: null,
 voiceEnabled: true,
 busy: false
};

const setText = (id,value) => {
 const el = $(id);
 if(el) el.textContent = value;
};

const show = (el,yes) => {
 if(el) el.classList.toggle("hidden",!yes);
};

const authHeaders = () =>
 state.token ? {Authorization:`Bearer ${state.token}`} : {};

async function request(path,options={}) {
 const headers = {
  ...(options.body ? {"Content-Type":"application/json"} : {}),
  ...authHeaders(),
  ...(options.headers || {})
 };

 const response = await fetch(path,{...options,headers});
 const data = await response.json().catch(()=>({}));

 if(!response.ok)
  throw new Error(data.message || data.error || `Request failed (${response.status})`);

 return data;
}

function notice(id,message,error=false) {
 const el=$(id);
 if(!el) return;
 el.textContent=message;
 el.style.color=error ? "#ff8294" : "#9fe9ff";
}

function setAuthenticated(yes) {
 show($("authScreen"),!yes);
 show($("appScreen"),yes);

 setText(
  "authState",
  yes ? `Signed in${state.user ? " · "+state.user : ""}` : "Signed out"
 );

 setText("userLabel",state.user || "Signed in");
}

async function healthCheck() {
 try {
  const h=await request("/api/health");

  setText(
   "providerState",
   h.provider || h.ai_provider ||
   (h.ai_ready ? "Configured" : "Backend online")
  );

  setText(
   "liveState",
   h.liveavatar_configured ?
   "Configured" :
   "Backend configuration required"
  );

  setText("ttsState","Browser voice available");
  setText("aiStatus","Backend Connected");

  if($("aiDot")) $("aiDot").classList.add("online");

 } catch {
  setText("providerState","Not connected");
  setText("liveState","Check backend configuration");
  setText("ttsState","Browser voice available");
  setText("aiStatus","Backend unavailable");
 }
}

async function authenticate(kind) {

 const username=$("username")?.value.trim();
 const password=$("password")?.value || "";

 if(!username || !password) {
  return notice(
   "authNotice",
   "Username සහ password ඇතුළත් කරන්න.",
   true
  );
 }

 const btn=$(kind==="login" ? "loginBtn":"registerBtn");

 if(btn) btn.disabled=true;

 notice("authNotice","කරුණාකර රැඳී සිටින්න…");

 try {
  const data=await request(`/api/auth/${kind}`,{
   method:"POST",
   body:JSON.stringify({username,password})
  });

  const token=
   data.token ||
   data.access_token ||
   data.session?.token;

  if(!token)
   throw new Error("Login token එක ලැබී නැත.");

  state.token=token;
  state.user=data.user?.username ||
             data.user?.name ||
             username;

  sessionStorage.setItem("anjana_token",token);
  sessionStorage.setItem("anjana_user",state.user);

  setAuthenticated(true);
  notice("authNotice","");

  await healthCheck();

 } catch(e) {
  notice("authNotice",e.message,true);
 } finally {
  if(btn) btn.disabled=false;
 }
}

async function logout() {

 await stopAvatar(false);

 state.token="";
 state.user="";

 sessionStorage.removeItem("anjana_token");
 sessionStorage.removeItem("anjana_user");

 setAuthenticated(false);
}

function appendMessage(role,text) {

 const log=$("chatLog");
 if(!log) return;

 const item=document.createElement("div");

 item.className=`bubble ${role==="user" ? "user":"ai"}`;

 item.textContent=text;

 log.appendChild(item);
 log.scrollTop=log.scrollHeight;
}

function speak(text) {

 if(!state.voiceEnabled) return;
 if(!("speechSynthesis" in window)) return;

 speechSynthesis.cancel();

 const u=new SpeechSynthesisUtterance(
  String(text).slice(0,4000)
 );

 u.lang=/[\u0D80-\u0DFF]/.test(text) ?
  "si-LK":"en-US";

 const voices=speechSynthesis.getVoices();

 const match=voices.find(v =>
  v.lang.toLowerCase().startsWith(u.lang.slice(0,2))
 );

 if(match) u.voice=match;

 speechSynthesis.speak(u);
}

async function sendMessage() {

 const input=$("messageInput");
 const text=input?.value.trim();

 if(!text || state.busy) return;

 if(!state.token)
  return notice("chatNotice","පළමුව Login වන්න.",true);

 state.busy=true;

 if($("sendBtn")) $("sendBtn").disabled=true;

 appendMessage("user",text);

 input.value="";

 notice("chatNotice","ANJANA AI පිළිතුර සකස් කරමින්…");

 try {

  const data=await request("/api/chat",{
   method:"POST",
   body:JSON.stringify({
    message:text,
    language:$("languageSelect")?.value || "si",
    voice:$("voiceSelect")?.value || "coral"
   })
  });

  const answer=
   data.reply ||
   data.response ||
   data.message ||
   data.answer ||
   "පිළිතුරක් ලැබුණේ නැත.";

  appendMessage("assistant",answer);

  notice("chatNotice","");

  speak(answer);

 } catch(e) {

  notice("chatNotice",`දෝෂය: ${e.message}`,true);

  appendMessage(
   "assistant",
   `සම්බන්ධතා දෝෂයක්: ${e.message}`
  );

 } finally {

  state.busy=false;

  if($("sendBtn")) $("sendBtn").disabled=false;

  input?.focus();
 }
}

function loadLiveKit() {

 if(window.LivekitClient)
  return Promise.resolve(window.LivekitClient);

 if(window.__anjanaLiveKitPromise)
  return window.__anjanaLiveKitPromise;

 window.__anjanaLiveKitPromise=new Promise((resolve,reject)=>{

  const s=document.createElement("script");

  s.src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js";

  s.onload=()=>{
   if(window.LivekitClient)
    resolve(window.LivekitClient);
   else
    reject(new Error("LiveKit SDK unavailable"));
  };

  s.onerror=()=>{
   reject(new Error("LiveKit SDK download failed"));
  };

  document.head.appendChild(s);
 });

 return window.__anjanaLiveKitPromise;
}

function avatarStatus(message,online=false) {

 setText("avatarMessage",message);
 setText("avatarStatus",online ? "Live":"Offline");

 setText(
  "qualityLabel",
  online ? "Connected":"Waiting for connection"
 );

 const dot=$("avatarDot");

 if(dot) dot.classList.toggle("online",online);
}

async function startAvatar() {

 const start=$("startAvatarBtn");
 const stop=$("stopAvatarBtn");

 if(!state.token)
  return avatarStatus("Login කර Live Avatar ආරම්භ කරන්න.");

 if(start) start.disabled=true;

 avatarStatus("LiveAvatar session එක සම්බන්ධ කරමින්…");

 try {

  const data=await request(
   "/api/liveavatar/session/start",
   {
    method:"POST",
    body:JSON.stringify({})
   }
  );

  state.sessionToken=
   data.session_token ||
   data.sessionToken;

  const livekitUrl=
   data.livekit_url ||
   data.livekitUrl;

  const clientToken=
   data.livekit_client_token ||
   data.livekit_token ||
   data.token;

  if(!state.sessionToken || !livekitUrl || !clientToken)
   throw new Error("LiveKit session තොරතුරු සම්පූර්ණ නැත.");

  const LK=await loadLiveKit();

  const room=new LK.Room({
   adaptiveStream:true,
   dynacast:true
  });

  state.room=room;

  room.on(
   LK.RoomEvent.TrackSubscribed,
   track=>{

    const element=track.attach();

    if(track.kind===LK.Track.Kind.Video || track.kind==="video") {

     element.autoplay=true;
     element.playsInline=true;

     const video=$("avatarVideo");

     if(video) {

      video.srcObject=element.srcObject;
      video.classList.remove("hidden");

      $("avatarPlaceholder")?.classList.add("hidden");

      video.play().catch(()=>{});
     }

    } else {

     element.autoplay=true;

     document.body.appendChild(element);

     element.play?.().catch(()=>{});
    }
   }
  );

  room.on(
   LK.RoomEvent.Disconnected,
   ()=>{
    if(state.room===room) {

     state.room=null;

     if(start) start.disabled=false;
     if(stop) stop.disabled=true;

     avatarStatus("LiveAvatar connection විසන්ධි විය.");
    }
   }
  );

  await room.connect(livekitUrl,clientToken);

  // Microphone starts only after the user's Start click.
  await room.localParticipant.setMicrophoneEnabled(true);

  if(stop) stop.disabled=false;

  avatarStatus(
   "සජීවී Avatar සම්බන්ධයි. කතා කිරීම ආරම්භ කරන්න.",
   true
  );

 } catch(e) {

  try {
   await state.room?.disconnect();
  } catch {}

  state.room=null;

  if(state.sessionToken) {
   try {
    await request("/api/liveavatar/session/stop",{
     method:"POST",
     body:JSON.stringify({
      session_token:state.sessionToken
     })
    });
   } catch {}
  }

  state.sessionToken=null;

  if(start) start.disabled=false;
  if(stop) stop.disabled=true;

  avatarStatus(`LiveAvatar ආරම්භ කළ නොහැක: ${e.message}`);
 }
}

async function stopAvatar(sendRemote=true) {

 const start=$("startAvatarBtn");
 const stop=$("stopAvatarBtn");

 try {

  if(state.room) {

   try {
    await state.room.localParticipant.setMicrophoneEnabled(false);
   } catch {}

   await state.room.disconnect();
  }

 } catch {}

 state.room=null;

 if(sendRemote && state.sessionToken) {

  try {

   await request("/api/liveavatar/session/stop",{
    method:"POST",
    body:JSON.stringify({
     session_token:state.sessionToken
    })
   });

  } catch {
   avatarStatus("Local stream නවතා ඇත. Remote stop තහවුරු කළ නොහැකි විය.");
  }
 }

 state.sessionToken=null;

 const video=$("avatarVideo");

 if(video) {
  video.pause();
  video.srcObject=null;
  video.classList.add("hidden");
 }

 $("avatarPlaceholder")?.classList.remove("hidden");

 if(start) start.disabled=false;
 if(stop) stop.disabled=true;

 avatarStatus("LiveAvatar session නවතා ඇත.");
}

function startMic() {

 const SR=
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

 if(!SR)
  return avatarStatus("මෙම browser එකේ Speech Recognition සහාය නොමැත.");

 if(state.recognition) {
  try { state.recognition.stop(); } catch {}
 }

 const rec=new SR();

 state.recognition=rec;

 rec.lang=$("languageSelect")?.value==="en" ?
  "en-US":"si-LK";

 rec.continuous=false;
 rec.interimResults=false;

 rec.onresult=event=>{

  $("messageInput").value=
   event.results[0][0].transcript;

  sendMessage();
 };

 rec.onerror=()=>{
  notice("chatNotice","Microphone input භාවිත කළ නොහැක.",true);
 };

 rec.onend=()=>{
  state.recognition=null;
 };

 try {

  rec.start();

  notice("chatNotice","කතා කරන්න…");

 } catch(e) {

  notice("chatNotice",e.message,true);
 }
}

document.addEventListener("DOMContentLoaded",()=>{

 $("loginBtn")?.addEventListener(
  "click",
  ()=>authenticate("login")
 );

 $("registerBtn")?.addEventListener(
  "click",
  ()=>authenticate("register")
 );

 $("logoutBtn")?.addEventListener("click",logout);

 $("sendBtn")?.addEventListener("click",sendMessage);

 $("messageInput")?.addEventListener("keydown",e=>{

  if(e.key==="Enter" && !e.shiftKey) {
   e.preventDefault();
   sendMessage();
  }
 });

 $("startAvatarBtn")?.addEventListener("click",startAvatar);

 $("stopAvatarBtn")?.addEventListener(
  "click",
  ()=>stopAvatar(true)
 );

 $("micBtn")?.addEventListener("click",startMic);

 setAuthenticated(Boolean(state.token));

 if(state.token) {

  request("/api/auth/me")
   .then(data=>{

    state.user=
     data.user?.username ||
     data.username ||
     state.user;

    setAuthenticated(true);
    healthCheck();

   })
   .catch(()=>logout());

 } else {

  healthCheck();
 }
});

window.addEventListener("pagehide",()=>{

 try { state.room?.disconnect(); } catch {}

 try { state.recognition?.stop(); } catch {}
});

})();
