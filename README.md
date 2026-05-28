<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>smart scan</h1>
  <p>تطبيق لمسح الفواتير، استخراج البيانات بذكاء، ومزامنتها مع Google Sheets.</p>
</div>

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill the required keys.
3. Run the app:
   `npm run dev`

## Build

- Web/server build: `npm run build`
- Android sync: `npx cap sync android`
- Android debug APK: `cd android && .\gradlew.bat assembleDebug`
