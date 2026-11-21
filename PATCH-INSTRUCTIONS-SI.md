# ANJANA AI V11.0.0 Phase 01 – Patch Instructions (Sinhala)

මෙය GitHub `main` branch එකට ස්වයංක්‍රීයව upload කර නැත. GitHub write API එකෙන් 403 අවහිරතාවක් ලැබුණු නිසා, පහත ගොනු පමණක් ඔබගේ repository එකේ අදාළ path වලට upload/replace කරන්න.

Repository: `anjanasads1997-pixel/ANJANA-AI-V9`
Branch: `main`

## Replace these files
- `README.md`
- `.env.example`
- `package.json`
- `public/app-v10.js`
- `public/index.html`
- `public/sw.js`
- `tests/v10-integration.test.js`
- `tests/v103-interface.test.js`
- `src/app.js`
- `src/server.js`
- `docs/V11.0.0-PHASE-01.md`
- `src/core/engine.js`
- `src/core/ollama-client.js`

## Safety notes
- `.env.example` හි කිසිදු සැබෑ API key එකක් නැත.
- Render Environment values ස්වයංක්‍රීයව වෙනස් කරන්නේ නැත. ඔබගේ පවතින credentials මකා නොදමන්න.
- `OLLAMA_MODEL=qwen2.5:3b` භාවිත කිරීමට එම model එක ඔබගේ local Ollama තුළ ස්ථාපනය කළ යුතුය.
- V10 පැරණි chat history browser storage තුළ තබා ඇත; V11 key එකෙන් එය නැවත load නොකරයි. මකාදැමීමක් සිදු කර නැත.
- මෙය Phase 01 පමණි. Avatar + Chat-only UI සහ Unified Tool Router තවම සම්පූර්ණ කර නැත.

## Test result
`node --test`: 26 passed, 0 failed.
JavaScript syntax checks: passed for the checked source, frontend and test files.
