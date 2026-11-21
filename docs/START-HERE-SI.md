# ANJANA AI V11.0.3 — ආරම්භක මාර්ගෝපදේශය

මෙම අනුවාදය V11.0.0 Unified Brain Source එක පදනම් කරගෙන, V10.3/V10.4 LiveAvatar interface සහ OpenAI diagnostics සම්බන්ධතා ආරක්ෂා කර වැඩිදියුණු කර ඇත.

## 1. අවශ්‍ය දේ

- Node.js 20 හෝ ඉහළ අනුවාදයක්
- npm
- Render වැනි Node.js web-service hosting එකක් (Online භාවිතයට)
- OpenAI API key (OpenAI engine සඳහා)
- Gemini API key (Hybrid mode හි ප්‍රධාන engine සඳහා, විකල්ප)
- Ollama සහ `qwen2.5:3b` model එක (Local/Offline භාවිතයට)
- LiveAvatar API key සහ ඔබේ ගිණුමට අයත් Avatar ID (සජීවී avatar සඳහා)

## 2. Local පරිගණකයේ ආරම්භ කිරීම

1. ZIP ගොනුව Extract කරන්න.
2. එම project folder එකේ Terminal / PowerShell විවෘත කරන්න.
3. `npm install` ක්‍රියාත්මක කරන්න.
4. `.env.example` ගොනුව `.env` ලෙස පිටපත් කරන්න.
5. `.env` තුළ ඔබේ API keys සහ model settings සකසන්න.
6. `npm test` ක්‍රියාත්මක කර tests සමත් බව බලන්න.
7. `npm start` ක්‍රියාත්මක කරන්න.
8. Browser එකෙන් `http://localhost:3000` විවෘත කර Register / Login කරන්න.

## 3. AI Provider තේරීම

Hybrid mode (නිර්දේශිත):

```env
AI_PROVIDER=hybrid
GEMINI_API_KEY=ඔබගේ_GEMINI_KEY
OPENAI_API_KEY=ඔබගේ_OPENAI_KEY
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=ඔබගේ_OpenAI_ගිණුමට_අවසර_ඇති_model_නම
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

Hybrid අනුපිළිවෙළ: Gemini → OpenAI → Ollama.

OpenAI පමණක් භාවිත කිරීමට `AI_PROVIDER=openai` යොදන්න. එවිට `OPENAI_API_KEY`, `OPENAI_BASE_URL` සහ ඔබේ account එකට අවසර ඇති `OPENAI_MODEL` අගයන් අවශ්‍ය වේ.

## 4. LiveAvatar සහ Voice

Server environment variables ලෙස සකසන්න:

```env
LIVEAVATAR_API_KEY=ඔබගේ_LIVEAVATAR_KEY
LIVEAVATAR_AVATAR_ID=ඔබගේ_ගිණුමේ_AVATAR_ID
LIVEAVATAR_MODE=LITE
LIVEAVATAR_SANDBOX=false
OPENAI_TTS_API_KEY=ඔබගේ_TTS_KEY
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral
```

`LIVEAVATAR_SANDBOX=false` භාවිත කළ යුත්තේ ඔබේ LiveAvatar ගිණුම සහ Avatar එක Live mode සඳහා අවසර ලබා ඇති විට පමණි. API key එක Browser code, GitHub repository හෝ screenshot තුළ ඇතුළත් නොකරන්න.

## 5. Render Deploy කිරීම

- දැනට ඇති ANJANA AI Render service එකම භාවිත කරන්න; අලුත් service එකක් අනවශ්‍ය ලෙස සාදන්න එපා.
- ZIP එකේ සම්පූර්ණ source එක GitHub repository එකට upload කර deploy කරන්න.
- Build command: `npm install`
- Start command: `npm start`
- Render Environment තුළ `.env.example` හි අවශ්‍ය variables සකසන්න.
- `DATA_DIR` සඳහා persistent disk එකක් සම්බන්ධ කරන්න.
- `BRAIN_ENCRYPTION_KEY` සඳහා දිගු, අහඹු secret එකක් සකසන්න. එය නැතිනම් Brain context එක server process memory තුළ පමණක් පවතින අතර disk එකට plaintext ලෙස ලියන්නේ නැත.
- Deploy වූ පසු `/api/health` පරීක්ෂා කරන්න.
- Login වී Settings/Diagnostics හි **Test OpenAI Connection** භාවිත කර සැබෑ OpenAI request එක පරීක්ෂා කරන්න.
- LiveAvatar Start බොත්තම භාවිත කර සජීවී stream එක පරීක්ෂා කරන්න.

## 6. වැදගත් තහවුරු කිරීම්

- `/api/health` හෝ AI status එකේ API key configured ලෙස පෙන්වීම පමණක් සාර්ථක API සම්බන්ධතාවක් තහවුරු නොකරයි.
- OpenAI සම්බන්ධතාව සඳහා සැබෑ key, billing/quota සහ model access අවශ්‍යයි.
- LiveAvatar සඳහා account permissions, Avatar ID සහ Live mode eligibility අවශ්‍යයි.
- Tavily Research API සඳහා `TAVILY_API_KEY` අවශ්‍යයි. Login වූ පසු `/api/research/search` වෙත `{ "query": "ඔබගේ සෙවුම" }` JSON එක POST කළ හැක. මෙම endpoint එක තිබුණත් Research UI panel එක තවම chat interface එකට සම්බන්ධ කර නැත.
- `HEYGEN_API_KEY` යනු `LIVEAVATAR_API_KEY` එකට සමාන නොවේ. මෙම අනුවාදයේ සජීවී avatar stream එක LiveAvatar LITE API/SDK හරහා ක්‍රියා කරයි.
- Local Ollama model එක host කරන පරිගණකයේ ක්‍රියා කරයි. Render server එකේ `127.0.0.1` යනු Render container එකමයි; ඔබේ නිවසේ පරිගණකය නොවේ.
- Android PWA භාවිතයට HTTPS URL එකක් browser එකෙන් විවෘත කර Add to Home Screen තෝරාගත හැක. මෙම ZIP එකේ Android Capacitor configuration ඇත; සම්පූර්ණ native APK build එකක් මෙහිදී නිපදවා නැත.
- Camera vision, generative image/video/audio, semantic long-term memory සහ robot control වැනි roadmap Modules සියල්ල මෙම අනුවාදයේ සම්පූර්ණ ක්‍රියාත්මක බව නොසලකන්න.

## 7. V11.0.3 වෙනස්කම්

- `.env.example` හි වැරදි line-break සකස් කිරීම.
- Ollama timeout එක 45 seconds ලෙස ගැළපීම.
- ඇතැම් OpenAI reasoning models සමඟ නොගැළපිය හැකි custom temperature parameter ඉවත් කිරීම.
- LiveAvatar session start/attach අසාර්ථක වුවහොත් session cleanup කිරීම.
- Page එක වසා දැමීමේදී LiveAvatar session එක නවතා දැමීම.
- Encryption key නොමැති විට Brain status එකේ encryption disabled බව නිවැරදිව පෙන්වීම.
- Service worker cache version යාවත්කාලීන කිරීම.


## 8. V11.0.3 Render compatibility

- පැරණි Render mapping එකේ `OPENAI_BASE_URL` Google `googleapis.com` endpoint එකක් නම් `OPENAI_API_KEY` / `OPENAI_MODEL` Gemini legacy config ලෙස හඳුනාගනී.
- OpenAI backup සඳහා `BACKUP_OPENAI_API_KEY`, `BACKUP_OPENAI_BASE_URL`, `BACKUP_OPENAI_MODEL` භාවිත කරයි.
- `GEMINI_API_KEY` / `GEMINI_MODEL` තිබේ නම් ඒවා Gemini සඳහා ප්‍රමුඛ වේ.
- Tavily සඳහා authenticated server endpoint එකක් එකතු කර ඇත.
- HeyGen සහ LiveAvatar credentials වැරදි ලෙස එකිනෙකට මාරු නොකරයි.
- Render තුළ දැනට තිබෙන Environment Variables මකා දැමීම හෝ screenshot එකේ රහස් අගයන් source code එකට පිටපත් කිරීම අවශ්‍ය නොවේ.
