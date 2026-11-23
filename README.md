# 🎧 MIXMIND — Autonomous AI DJ & Web Audio Mixing Studio

**MIXMIND** is an autonomous and copilot AI DJ web application. It combines real-time Web Audio API signal processing, harmonic mixing (Camelot Wheel), dynamic beatmatching, stem separation, party DJ sound effects, and YouTube playlist mixing into an interactive browser experience.

---

## ✨ Features

- **🎛️ Dual DJ Decks**: Independent Deck A & Deck B with live vinyl scratch wheels, BPM pitch sliders, 3-band parametric EQ, and high-pass / low-pass resonant filters.
- **🤖 Autonomous AI DJ**: Auto-pilot mode analyzes song energy, detects transition cues, and executes harmonic beatmatched crossfades automatically.
- **✨ Party DJ Mode**: Simplified, party-friendly UI with single-click auto-mix, crowd noise, airhorns, and interactive party FX.
- **🎵 YouTube DJ Mode**: Mix any YouTube track or public playlist directly in the browser with live metadata parsing.
- **🧠 Harmonic Intelligence**: Camelot wheel key matching and energy-level trajectory planning.
- **📱 PWA Ready**: Installable Progressive Web App with offline audio support and responsive desktop/mobile UI.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ and npm

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/<your-username>/mixmind.git
cd mixmind/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 📦 Production Build

```bash
cd frontend
npm run build
```

The production assets will be output to `frontend/dist/`. You can preview the production build locally:

```bash
npm run preview
```

---

## 🌐 Deploying to the Web

### Deploy on Vercel (Recommended — Free & Instant)
1. Push this repository to your GitHub account.
2. Go to [Vercel](https://vercel.com/new) and import your `mixmind` repository.
3. Configure the project:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**. Vercel will automatically build the site and deploy the serverless YouTube proxy (`api/youtube-playlist.js`).

### Deploy on Netlify
1. Connect your repository on [Netlify](https://app.netlify.com/start).
2. Set **Base directory** to `frontend`, **Build command** to `npm run build`, and **Publish directory** to `dist`.
3. SPA routing is automatically handled via `frontend/public/_redirects`.

---

## 🔒 Environment Variables

No secret API keys or credentials are required! All audio DSP runs locally in the browser via the Web Audio API.

---

## 📄 License
MIT
