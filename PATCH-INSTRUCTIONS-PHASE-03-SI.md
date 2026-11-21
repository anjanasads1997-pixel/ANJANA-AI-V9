# V11.0 Phase 03 — ස්ථාපන උපදෙස්

1. V10.4.0 project එකට Phase 01, Phase 02 සහ Phase 03 patch ගොනු අනුපිළිවෙළින් යොදන්න. නැතහොත් මෙම සම්පූර්ණ source ZIP එක භාවිත කරන්න.
2. `npm install` ධාවනය කරන්න.
3. `.env` තුළ දැනට ඇති API keys වෙනස් නොකර `BRAIN_ENCRYPTION_KEY` සඳහා ශක්තිමත් random secret එකක් Render Environment තුළ සකසන්න. Render භාවිතයේදී `DATA_DIR` සඳහා persistent disk path එකක්ද සකසන්න.
4. `npm test` ධාවනය කරන්න.
5. Login වී නව Chat එකක් ආරම්භ කර, එකම සංවාදයේ පසු විමසුමක් යවා context continuity පරීක්ෂා කරන්න.
6. `/api/brain/status` සහ login අවශ්‍ය `/api/brain/tools` පරීක්ෂා කරන්න.

**ආරක්ෂාව:** `.env` හෝ API keys ZIP/GitHub වෙත upload නොකරන්න. මෙම Phase 03 තුළ tools read-only පමණි; physical device, security, file-write, account-change සහ deletion actions ක්‍රියාත්මක නොවේ.
