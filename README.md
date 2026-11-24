# ANJANA-AI-V9
ANJANA AI V9.0 - Advanced Hybrid Artificial Intelligence Platform | Sinhala &amp; English | Online and Offline AI


## Live Avatar lip-sync setup

The Android-friendly web interface connects the official `@heygen/liveavatar-web-sdk`
to the authenticated LiveAvatar session endpoint. When a real stream is connected, AI
responses are synthesized as PCM 16-bit, 24 kHz mono audio by `/api/tts` and sent to
LiveAvatar so its returned video stream provides synchronized mouth movement.

Set these environment variables in Render (do not commit real keys):
- `LIVEAVATAR_API_KEY` — LiveAvatar API key
- `LIVEAVATAR_AVATAR_ID` — avatar ID belonging to your LiveAvatar account
- `OPENAI_API_KEY` — used by the existing TTS endpoint
- `OPENAI_TTS_MODEL` — defaults to `gpt-4o-mini-tts`
- `OPENAI_TTS_VOICE` — defaults to `coral`

Important:
- `avatar-preview.png` is a static preview. Real lip-sync requires a real LiveAvatar
  stream and a configured avatar ID/account.
- The AI text chat still uses the configured AI provider. LiveAvatar LITE mode renders
  supplied speech audio; it does not replace the chat model.
- LiveAvatar usage may consume account credits. Stop the avatar session when finished.
- If LiveAvatar or TTS is not configured, the app falls back to browser speech synthesis;
  that fallback does not animate the static preview image.
