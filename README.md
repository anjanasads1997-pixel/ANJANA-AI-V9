# ANJANA AI V10.2.3 — OpenAI Primary Hybrid + LiveAvatar LITE

Sinhala + English PWA interface, authenticated Express backend, OpenAI-first hybrid routing, Gemini secondary fallback, local Ollama fallback, and LiveAvatar LITE streaming.

## V10.2.3 AI provider order

Default `AI_PROVIDER=hybrid` order:

1. **OpenAI** — primary paid cloud engine (`OPENAI_API_KEY`, default endpoint `https://api.openai.com/v1`, default model `gpt-4.1-mini`).
2. **Google Gemini** — secondary cloud engine (`GEMINI_API_KEY`, default model `gemini-2.5-flash`).
3. **Ollama** — local/offline fallback (`OLLAMA_BASE_URL`, default model `qwen2.5:1.5b-instruct`).

Optional forced modes: `AI_PROVIDER=openai`, `gemini`, or `ollama`. Provider credentials are read only by the server and are never sent to the browser.

### Important Render migration

The supplied V10.2.1 package used `OPENAI_API_KEY` + a Google OpenAI-compatible `OPENAI_BASE_URL` as its Gemini primary configuration. V10.2.3 changes the meaning of `OPENAI_API_KEY` to the actual OpenAI account key and uses `GEMINI_API_KEY` separately for Gemini.

In Render Environment:
- Set `OPENAI_API_KEY` to the paid OpenAI API key.
- Set `OPENAI_BASE_URL` to `https://api.openai.com/v1` (or remove it to use this default).
- Set `OPENAI_MODEL` to a model enabled for the account, default `gpt-4.1-mini`.
- Set `GEMINI_API_KEY` to the separate Google AI Studio key and `GEMINI_MODEL` to `gemini-2.5-flash`.
- Do not leave a Gemini key in `OPENAI_API_KEY`.
- Do not put any real key in this ZIP, GitHub, screenshots, or chat.
- `BACKUP_OPENAI_*` is retained as a compatibility alias for older deployments; new deployments should use `OPENAI_*`.

## LiveAvatar LITE setup

The backend uses `LIVEAVATAR_API_KEY` and `LIVEAVATAR_AVATAR_ID`. Keep `LIVEAVATAR_MODE=LITE`. For production/live avatars set `LIVEAVATAR_SANDBOX=false` only when the account and avatar are enabled for Live mode; use `true` only for an avatar that explicitly supports sandbox mode. The browser requests a short-lived session token from the authenticated backend; the LiveAvatar API key is never sent to the browser. The official `@heygen/liveavatar-web-sdk` starts/stops the session and attaches the LiveKit video stream.

For avatar speech, `/api/tts` uses `OPENAI_TTS_API_KEY`, or `BACKUP_OPENAI_API_KEY`, or the primary `OPENAI_API_KEY` only when the base URL is the official OpenAI API. A Gemini key is never used as an OpenAI speech credential. Browser speech fallback remains available.

## Local setup

1. Install Node.js 20 or newer.
2. Extract this folder and run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add the OpenAI key and, optionally, the separate Gemini key.
5. Install Ollama and pull the model named in `OLLAMA_MODEL` for local fallback.
6. Run `npm start` and open `http://localhost:3000`.
7. Register a username and password (10–128 characters), then log in.

## Deployment

Deploy the complete folder as a Node web service (not a static-only GitHub Pages site), configure a persistent disk for `DATA_DIR`, set `NODE_ENV=production`, and add provider credentials as Render environment variables. HTTPS is required for secure session cookies and browser microphone/camera APIs.

Keep the existing service; do not create a second Render service. Check `/api/health` after deployment. Health confirms the backend is running, not that paid provider credentials have completed a real chat request.

## Verification

Run:

```bash
npm install
npm test
npm start
```

Tests cover frontend/backend endpoint alignment, session-auth UI wiring, provider routing configuration, health version, and environment separation. Real OpenAI/Gemini credentials, Render deployment, Android hardware, browser WebGPU, camera vision, and LiveAvatar audio/lip-sync still require separate end-to-end tests.

## Known incomplete features retained from V10.2.1

- The Research/Learning panel needs a dedicated research service endpoint; it is not implemented by `/api/chat`.
- Camera capture currently previews locally; it does not send images to a vision model.
- Android APK packaging and full real-device validation remain separate tasks.

## V10.2.4 — Fixes for Render and mobile browsers

- OpenAI remains the primary cloud provider; Gemini is secondary and Ollama is the local fallback.
- The server now permits WebAssembly compilation required by the Transformers.js CPU/WASM offline engine (`wasm-unsafe-eval`).
- Offline ONNX runtime assets use an explicit CDN path.
- Mobile layout prevents horizontal overflow and the frontend/service-worker cache versions are refreshed.
- AI backend errors include a short redacted diagnostic to help identify invalid API keys, model access, quota, or provider failures.
- LiveAvatar defaults to non-sandbox mode. Set `LIVEAVATAR_SANDBOX=false` in Render only when the LiveAvatar account/avatar is enabled for Live mode.

For Render, verify `OPENAI_API_KEY` contains the actual OpenAI API key, `OPENAI_BASE_URL=https://api.openai.com/v1`, `OPENAI_MODEL=gpt-4.1-mini`, and `AI_PROVIDER=hybrid`. Do not commit API keys. A code deployment cannot activate API billing, grant model access, or grant LiveAvatar account permissions.


## V10.2.5 diagnostics

- Adds an authenticated direct OpenAI connectivity test at `/api/ai/test`; it reports provider/model and bounded diagnostics without exposing API keys.
- Adds a visible `/api/ai/status` summary in the UI. Configured-key status does not prove key validity; use Test OpenAI Connection.
- Hybrid mode no longer silently presents a canned local reply when the backend is down and no local model is loaded. It shows the actual backend error in chat.
- LiveAvatar now requires an explicit account-owned `LIVEAVATAR_AVATAR_ID`; no sample/default avatar ID is silently substituted. Set `LIVEAVATAR_SANDBOX=false` in Render for a permitted live account.
- LiveAvatar provider account permissions and avatar eligibility must be verified in the LiveAvatar account; code cannot grant them.


## V10.2.8 reliability and diagnostics

- OpenAI requests retry once for transient HTTP 408/429/500/502/503/504 responses.
- Provider errors include a bounded, redacted HTTP status, provider code/message and request ID where supplied.
- The official OpenAI base URL is normalized to `/v1` when the host is `api.openai.com` and no path is supplied.
- Hybrid failures now report the OpenAI, Gemini and Ollama failure reasons instead of returning a generic local fallback message.
- The UI distinguishes “API key configured” from a verified OpenAI connection. Use **Test OpenAI Connection** to verify the API request.
- A persistent HTTP 503 cannot be repaired by application code alone; verify the OpenAI API key, model access, billing/quota, Render environment values and OpenAI service availability. Never put provider keys in GitHub or browser fields.

Recommended Render variables:
- `AI_PROVIDER=hybrid`
- `OPENAI_BASE_URL=https://api.openai.com/v1`
- `OPENAI_MODEL=gpt-4.1-mini`
- `OPENAI_API_KEY` = your own valid OpenAI API key
- Optional secondary provider: `GEMINI_API_KEY`
- `LIVEAVATAR_SANDBOX=false` only when the account and selected avatar are eligible for live mode.


## V10.2.8 — Render legacy environment compatibility

The supplied Render screenshots showed the older environment layout still in use: `OPENAI_BASE_URL` points to Google's `generativelanguage.googleapis.com`, `OPENAI_API_KEY` contains the Gemini key, while the paid OpenAI key/model are stored under `BACKUP_OPENAI_*`. Earlier V10.2.6 code incorrectly preferred `OPENAI_API_KEY` for OpenAI and therefore sent the Gemini credential/model to the wrong provider.

V10.2.8 detects that exact legacy Google endpoint. In legacy mode it uses `BACKUP_OPENAI_API_KEY`, `BACKUP_OPENAI_BASE_URL`, and `BACKUP_OPENAI_MODEL` for OpenAI, and uses `OPENAI_API_KEY` plus `OPENAI_MODEL` for Gemini. If `GEMINI_API_KEY` is set, it takes priority for Gemini. `AI_PROVIDER=cloud` continues to behave as hybrid routing (OpenAI → Gemini → Ollama).

Recommended long-term cleanup (optional after V10.2.8 is deployed): set `OPENAI_API_KEY` to the actual OpenAI key, `OPENAI_BASE_URL=https://api.openai.com/v1`, `OPENAI_MODEL=gpt-5.4-mini`; move the Google key to `GEMINI_API_KEY`, set `GEMINI_MODEL=gemini-3.8-flash`, and remove the old Gemini values from `OPENAI_*`. Never paste keys into chat, screenshots, or GitHub.


## V10.3.0 — Live Avatar Workspace
- Reworked the main interface into a responsive avatar-and-chat workspace inspired by the supplied reference.
- The existing portrait remains the safe fallback until a real LiveAvatar stream is connected.
- The LiveAvatar video is displayed in the main avatar stage after session start; existing start/stop controls and API routes are preserved.
- Chat, quick prompts, and message composer are grouped beside the avatar on desktop and stacked on mobile.
- Real streamed avatar output still requires valid server-side `LIVEAVATAR_API_KEY` and an account-owned `LIVEAVATAR_AVATAR_ID` (or `ANJANA_LIVEAVATAR_ID`). TTS requires the configured server-side TTS key.
\n\n## V10.4.0 — Full-Screen Live Avatar\nThe main screen now follows the supplied reference: a large avatar/live-video panel beside a full-height chat panel on desktop, and a stacked portrait/chat layout on mobile. Account, offline engine, diagnostics and tools remain available in the collapsible settings section.\n