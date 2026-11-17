# ANJANA AI V10.2 — LiveAvatar Integrated Release

Sinhala + English PWA interface, authenticated Express backend, hybrid AI routing, and LiveAvatar LITE session streaming.

## LiveAvatar LITE setup
The Render service uses the existing `LIVEAVATAR_API_KEY` and `LIVEAVATAR_AVATAR_ID` variables. The remembered avatar ID `245c5ef6-fea0-4095-9894-79ff8f3947be` is only a fallback if no ID is configured. Keep `LIVEAVATAR_MODE=LITE` and `LIVEAVATAR_SANDBOX=true` for the sandbox configuration shown in the supplied Render screenshot. The browser requests a short-lived session token from the authenticated backend; the API key is never sent to the browser. The official LiveAvatar Web SDK starts/stops the session and attaches the LiveKit video stream.

For avatar speech, `/api/tts` uses `OPENAI_TTS_API_KEY`, or `BACKUP_OPENAI_API_KEY`, before `OPENAI_API_KEY`. This matters when `OPENAI_API_KEY` is configured as a Gemini-compatible key/base URL: that Gemini key is not an OpenAI speech key. Add a separate TTS key only if you want server-generated PCM speech; otherwise the browser speech fallback remains available.

The LITE session uses ANJANA AI's own response engine and a 24 kHz mono PCM TTS output. The Render sandbox setting is controlled by `LIVEAVATAR_SANDBOX`; change it to `false` only when the account/avatar is ready for a non-sandbox session.

## Local setup
1. Install Node.js 20 or newer.
2. Extract this folder and run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `GEMINI_API_KEY` for the primary online model. Optionally set `OPENAI_API_KEY` for backup.
5. Install Ollama and pull the model named in `OLLAMA_MODEL` for the local fallback.
6. Run `npm start` and open `http://localhost:3000`.
7. Register a username and password (10–128 characters), then log in.

## Hybrid order
Default `AI_PROVIDER=hybrid`: Gemini → OpenAI → Ollama. Set `AI_PROVIDER=gemini`, `openai`, or `ollama` to force one provider. Provider keys belong only in the server environment, never in the browser.

## Deployment
Deploy the complete folder as a Node web service (not a static-only GitHub Pages site), configure a persistent disk for `DATA_DIR`, set `NODE_ENV=production`, and add provider credentials as host environment variables. HTTPS is required for secure session cookies and browser microphone/camera APIs.

## Verification
Run `npm test`. The included tests cover module loading, frontend/backend endpoint alignment, session-auth UI wiring, and hybrid-provider routing. Live provider credentials, Render deployment, Android hardware, browser WebGPU, camera vision, and LiveAvatar audio/lip-sync still require separate end-to-end tests.

## Known incomplete features
- The Research/Learning panel needs a dedicated research service endpoint; it is not implemented by `/api/chat`.
- Camera capture currently previews locally; it does not send images to a vision model.
- Azure Speech browser-key entry is retained from the supplied UI and should be replaced with a server-issued short-lived token before public production use.
- Android APK packaging, camera vision, and full real-device validation remain separate tasks.
