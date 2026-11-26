# GemDeck — Mobile AI Gem & Data Workspace (React + Capacitor)

A local-first mobile application built with **React, Vite, TypeScript, Tailwind CSS, and Capacitor** featuring:
- **Custom Gems**: Configurable system prompts, per-Gem AI provider/model selection, default output formats, and persistent reference files.
- **Multi-Provider BYOK**: Google Gemini, OpenAI, Anthropic, and NVIDIA NIM (`integrate.api.nvidia.com/v1`), plus built-in Demo Mode.
- **Full Media Support**: PDF (`pdfjs-dist`), Excel (`.xlsx`), Word (`.docx`), CSV/JSON/Markdown/TXT, Images, and Audio.
- **Mobile Data Workspace**: Sortable columns, search/filter bar, column visibility toggles, row detail bottom sheet with inline editing, and `.csv` / `.xlsx` / `.md` export (native Android/iOS Share sheet via Capacitor).
- **Local-Only Storage**: IndexedDB (`idb`) + Capacitor `Preferences` + JSON backup/restore.
- **Automated Android APK Builds**: GitHub Actions workflow in `.github/workflows/build-android-apk.yml`.

## Local Development

```bash
npm install
npm run dev
```

## Build Android APK Locally

```bash
npm run build
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## GitHub Actions APK Build (`.github/workflows/build-android-apk.yml`)

Push this repository to GitHub and open the **Actions** tab:
1. Every push to `main` automatically builds a **Debug APK** and uploads it as a downloadable artifact (`gemdeck-android-apk-<run_number>`).
2. You can also trigger **Build Android APK** manually via **Run workflow** and choose `debug` or `release`.
3. For signed **Release APKs**, add these Repository Secrets in GitHub (**Settings → Secrets and variables → Actions**):
   - `ANDROID_KEYSTORE_BASE64` (base64-encoded `.jks` or `.keystore` file)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
