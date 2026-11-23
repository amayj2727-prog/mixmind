# MIXMIND Production Publishing & Deployment Guide

This guide details the steps to publish and deploy **MIXMIND** to production with high availability, global low-latency audio delivery, and mobile PWA installation.

---

## 1. Instant 1-Click Cloud Deployment

### Option A: Vercel (Recommended)
MIXMIND includes [`vercel.json`](file:///Users/amayjain27/Desktop/MIXMIND/frontend/vercel.json) pre-configured with SPA route rewriting (`/app/party`, `/app/studio`) and secure HTTP headers.

1. Install the Vercel CLI or link via GitHub:
   ```bash
   cd frontend
   npx vercel
   ```
2. Build Settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Click **Deploy**. Your app will be live on a global CDN in under 60 seconds.

---

### Option B: Netlify / Cloudflare Pages
MIXMIND includes [`public/_redirects`](file:///Users/amayjain27/Desktop/MIXMIND/frontend/public/_redirects) for automatic 200 rewrites on single-page application routes.

1. Connect your repository to Netlify / Cloudflare Pages.
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy!

---

## 2. Progressive Web App (PWA) Mobile Installation

MIXMIND is configured with a high-resolution SVG favicon and a web application manifest [`public/manifest.json`](file:///Users/amayjain27/Desktop/MIXMIND/frontend/public/manifest.json).

- **iOS (Safari)**: Tap the **Share** button → Tap **"Add to Home Screen"**. The app runs full-screen without Safari browser chrome, perfect for house-party hosts operating the DJ deck from an iPhone or iPad.
- **Android (Chrome)**: Tap the three-dot menu → Tap **"Install App"**.

---

## 3. High-Performance Audio Asset Strategy

- **Browser Audio Formats**: Use `.mp3` (192-320kbps) or `.m4a` / `.aac` for high-efficiency Web Audio decoding and fast pre-buffering.
- **Local User Tracks**: Users can drag & drop any MP3, WAV, AAC, or FLAC files straight into the crate without server upload—audio decodes client-side in browser memory via Web Audio DSP.
- **Hosted Cloud Sets**: For pre-made sets in production, host audio files on a high-speed CDN (such as **Cloudflare R2**, **AWS S3 with CloudFront**, or **Supabase Storage**) with `Access-Control-Allow-Origin: *` headers.

---

## 4. Pro DJ Hardware Keyboard Shortcuts

| Shortcut | Function | View |
| :--- | :--- | :--- |
| <kbd>Space</kbd> | Play / Pause active master deck | Party & Studio |
| <kbd>M</kbd> | Instant AI Beat-Matched Transition | Party & Studio |
| <kbd>1</kbd> | Instant Club FX: Air Horn | All |
| <kbd>2</kbd> | Instant Club FX: 808 Sub Drop | All |
| <kbd>3</kbd> | Instant Club FX: Spinback | All |
| <kbd>4</kbd> | Instant Club FX: Echo Freeze | All |
| <kbd>Tab</kbd> | Instant Mode Switch (Party Mode ↔ Pro Studio) | All |

---

## 5. Security & Domain Configuration

1. **Custom Domain**: Connect your domain (e.g. `mixmind.app` or `dj.yourdomain.com`) in your Vercel or Cloudflare dashboard.
2. **HTTPS / SSL**: Web Audio API and media element streaming require a secure HTTPS context. Vercel and Netlify issue free automatic Let's Encrypt certificates.
3. **HTTP Security Headers**: Pre-configured in `vercel.json` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`).
