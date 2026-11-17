# ANJANA AI V9.0.1 — GitHub Upload Guide (Sinhala)

## ZIP එකේ ඇතුළත් වෙනස් කළ යුතු ගොනු

- `package.json` → Repository root
- `src/app.js` → `src` folder
- `public/index.html` → `public` folder
- `public/app.js` → `public` folder
- `public/sw.js` → `public` folder

## GitHub වෙත upload කරන ස්ථානය

Repository: `anjanasads1997-pixel/ANJANA-AI-V9`
Branch: `main`

පැරණි ගොනු මකා නොදමන්න. ඉහත සඳහන් exact paths වල ගොනු පමණක් Replace කරන්න.

## Render Build / Start

Build Command: `yarn install`
Start Command: `yarn start`
Node: 20+

`yarn install` අවසානයේ `postinstall` script එක `public/app.bundle.js` bundle එක සාදයි. Render Build Command වෙනස් කිරීමට අවශ්‍ය නැත.

## Render Environment Variables

පවතින සියලු API keys මකා නොදමන්න. Values කිසිවක් ZIP එකට ඇතුළත් කර නැත.

අවශ්‍ය / භාවිත කරන variables:
- `LIVEAVATAR_API_KEY` — LiveAvatar platform API key
- `LIVEAVATAR_AVATAR_ID` — LiveAvatar dashboard එකේ Avatar ID (නොමැති නම් code එකේ කලින් භාවිත කළ ID fallback වේ)
- `OPENAI_API_KEY` — AI chat සහ TTS
- `OPENAI_MODEL` — optional; default `gpt-4o-mini`
- `OPENAI_TTS_MODEL` — optional; default `gpt-4o-mini-tts`
- `OPENAI_TTS_VOICE` — optional; default `coral`
- `AI_PROVIDER` — `hybrid`, `openai`, හෝ `ollama`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` — local/self-hosted Ollama fallback සඳහා

වැදගත්: `OPENAI_API_KEY` සහ `LIVEAVATAR_API_KEY` යන variable names Render Environment තුළ තිබේද පරීක්ෂා කරන්න. API key values browser, GitHub, ZIP හෝ screenshots වෙත නොදමන්න.

## Commit Message

Add integrated LiveAvatar interface and hybrid AI voice pipeline

## Commit Description

- Add responsive ANJANA AI SUPER interface
- Integrate authenticated LiveAvatar Lite session creation
- Bundle official LiveAvatar Web SDK during install
- Add LiveAvatar video stream and session lifecycle controls
- Add AI chat with OpenAI and Ollama hybrid fallback
- Add PCM 24 kHz text-to-speech for avatar lip sync
- Add Sinhala and English speech input controls
- Update PWA service worker cache

## After upload

1. GitHub `main` branch එකට commit කරන්න.
2. Render > ANJANA-AI > Deploys වෙත යන්න.
3. නව deployment එක `Live` වනතුරු රැඳී සිටින්න.
4. Browser එකේ hard refresh කරන්න; Android Chrome නම් site data/cache update නොවුණොත් page reload කර බලන්න.
5. Login වන්න.
6. `Start Live Avatar` ඔබා Camera/Media අවසර අවශ්‍ය නම් ලබාදෙන්න.
7. Video stream සම්බන්ධ වූ පසු පණිවිඩයක් යවන්න. AI පිළිතුර ලැබුණු පසු TTS PCM audio LiveAvatar වෙත යවා lip-sync කෙරේ.
8. අවසන් වූ විට `Stop Session` ඔබන්න.

## Limitations and validation

- LiveAvatar API account එකට Lite sessions/credits සහ නිවැරදි avatar ID අවශ්‍යයි.
- Avatar streaming සඳහා LiveAvatar credits වැය විය හැක; අවශ්‍ය විට පමණක් Start කර අවසන් වූ විට Stop කරන්න.
- TTS requires working OpenAI API access for the selected TTS model.
- Browser speech recognition availability and Sinhala recognition vary by browser/device; text input remains available.
- This package does not create a cloned voice. It uses the configured OpenAI TTS voice. Voice cloning requires a separate, authorized voice provider and consent.
- No ZIP can guarantee a live third-party stream without testing the account credentials, avatar permission, network, and available credits.
