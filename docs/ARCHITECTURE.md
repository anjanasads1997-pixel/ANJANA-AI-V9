
# ANJANA AI V9.0 Architecture

## System Overview

ANJANA AI is a bilingual Sinhala and English local-first AI assistant.

## Main Components

1. Web Interface - public/
2. Backend API - src/
3. Authentication - src/auth/
4. AI Engine - src/core/
5. Local Data Storage - src/storage/
6. Android Configuration - android/
7. Model Installation - scripts/

## AI Processing

Browser Interface
       |
       v
Express API Server
       |
       v
Ollama Local AI
       |
       v
Qwen 2.5 Model

## Security

- Password hashing using scrypt.
- Secure session tokens.
- HttpOnly session cookies.
- Environment variables for configuration.
- Local data storage.

## Supported Languages

- Sinhala
- English

## Operating Modes

- Offline local AI through Ollama.
- Hybrid operation planned for future development.


## LiveAvatar LITE (V10.2)
- The browser asks the authenticated ANJANA backend for a short-lived LiveAvatar session token.
- The backend alone stores `LIVEAVATAR_API_KEY`; the browser never receives the provider API key.
- `@heygen/liveavatar-web-sdk` starts the LITE session, manages LiveKit/WebSocket connections, and attaches the remote video stream.
- ANJANA's existing AI response engine remains the LLM. Server TTS returns mono PCM at 24 kHz; the browser forwards the decoded PCM to the LiveAvatar LITE session.
- `LIVEAVATAR_AVATAR_ID` from Render overrides the previously selected avatar ID fallback.
- `LIVEAVATAR_SANDBOX=true` follows the Render configuration supplied by the user.


## V11.0 Unified Brain (Phase 03)

Authenticated chat requests enter `src/core/brain/unified-brain.js`. The brain loads bounded per-user conversation context, calls the Gemini/OpenAI/Ollama provider router, and persists the exchange through `context-store.js`. `tool-registry.js` currently exposes read-only module and runtime-status tools only. `permission-manager.js` denies unknown actions and requires explicit confirmation for sensitive action categories. See `V11.0.0-PHASE-03-SI.md` for implementation boundaries.
