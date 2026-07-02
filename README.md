# 🔨 Forge — a Replit-style app builder (web + iOS)

Forge builds **live web apps from natural-language prompts**, in the spirit of the Replit mobile app: describe what you want, watch Claude write the code, and use the running app right away — with chat-driven iteration, a code browser, and a live preview. Two clients share one backend: a React web app you can host on Vercel or Netlify, and a SwiftUI iPhone app.

```
┌────────────────────┐     HTTPS (JSON)      ┌─────────────────────────┐
│  Forge clients     │ ───────────────────▶  │  Convex backend          │
│  • Web (React on   │  ◀─────────────────── │  (DB + HTTP API +        │
│    Vercel/Netlify) │    polling            │   background actions)    │
│  • iOS (SwiftUI)   │                       │      │            │      │
│                    │                       │      ▼            ▼      │
│  Chat│Preview│Code │                       │  Claude API    Daytona    │
└────────────────────┘                       │  (codegen)     (sandbox) │
        │                                    └─────────────────────────┘
        │            live preview URL (https://3000-<sandbox>.proxy.daytona.work)
        └───────────────────────────▶  iframe (web) / WKWebView (iOS)
```

**Stack**

| Piece | Tech |
|---|---|
| Web app | Vite + React + TypeScript SPA (`web/`), deployable to Vercel/Netlify straight from GitHub |
| iOS app | SwiftUI (iOS 17+), WKWebView preview, dark Replit-style UI |
| Database + API | [Convex](https://convex.dev) — tables for projects/messages/files, HTTP actions as the client API (CORS-enabled), scheduler for background builds |
| Code generation | Claude (`claude-opus-4-8`) via `@anthropic-ai/sdk`, structured JSON output (multi-file static web apps) |
| App hosting | [Daytona](https://daytona.io) sandboxes — each project gets an isolated cloud sandbox serving the generated app on a public preview URL |

**How a build works**

1. You tap **Enter App** (single local user — no auth) and describe an app.
2. `POST /api/projects` inserts the project and schedules `builder.build` via the Convex scheduler.
3. The build action asks Claude for a complete multi-file static web app (structured output, streaming).
4. Files are saved to Convex, then uploaded into a Daytona sandbox (`public: true`), served by `python3 -m http.server 3000`.
5. The sandbox's public preview URL is stored on the project; the app polls, flips to **Live**, and renders it in the Preview tab.
6. Every follow-up chat message re-generates the complete file set and hot-swaps the sandbox contents.

Sandboxes auto-stop after 30 minutes of inactivity (to save quota); the app's **Wake Sandbox** button restarts them via `POST /api/projects/:id/wake`.

---

## 1. Deploy the backend (5 minutes)

Requirements: Node 18+, a free [Convex](https://dashboard.convex.dev) account, an [Anthropic API key](https://console.anthropic.com), and a [Daytona API key](https://app.daytona.io) (free tier includes $200 credits).

```bash
cd backend
npm install

# Create/attach a Convex dev deployment (opens browser on first run)
npx convex dev --once

# Set the API keys on the deployment
npx convex env set ANTHROPIC_API_KEY 'sk-ant-...'
npx convex env set DAYTONA_API_KEY 'dtn_...'

# Keep functions synced while developing (or `npx convex deploy` for prod)
npx convex dev
```

Your mobile API base URL is the deployment's **HTTP Actions URL** — it ends in **`.convex.site`** (not `.convex.cloud`). Find it in the Convex dashboard under *Settings → URL & Deploy Key*, e.g. `https://happy-animal-123.convex.site`.

Sanity check:

```bash
curl https://<your-deployment>.convex.site/api/health
# → {"ok":true}
```

## 2. Deploy the web app from GitHub (Vercel or Netlify)

The web client is a static SPA in `web/` — it talks directly to your Convex deployment, so there is no server of its own.

**Vercel**

1. [vercel.com/new](https://vercel.com/new) → Import your GitHub repo.
2. Set **Root Directory** to `web` (framework auto-detects as Vite).
3. *(Optional)* Add env var `VITE_CONVEX_SITE_URL=https://your-deployment.convex.site` to pre-configure the backend URL for every visitor.
4. Deploy. Every push to the connected branch redeploys automatically.

**Netlify**

1. [app.netlify.com/start](https://app.netlify.com/start) → Import your GitHub repo.
2. Build settings are read from the repo-root `netlify.toml` (base `web`, publish `dist`) — no manual config needed.
3. *(Optional)* Add the same `VITE_CONVEX_SITE_URL` env var.
4. Deploy. Every push redeploys automatically.

If you skip the env var, the app shows a **Connect your backend** screen — paste your `.convex.site` URL into Settings (stored in the browser's localStorage, along with the optional API secret).

**Local development**

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

> The backend's HTTP routes answer CORS preflights (`OPTIONS`, plus the `x-forge-secret` header allowance), so any web origin can talk to it. Set `FORGE_API_SECRET` if you want to lock that down.

## 3. Run the iOS app in the Simulator

Requirements: macOS with **Xcode 16+** (the project uses the Xcode 16 folder-synchronized project format).

**Xcode UI:** open `ios/Forge.xcodeproj`, pick an iPhone simulator, hit **Run** (⌘R). No signing setup needed for the simulator.

**Command line:**

```bash
cd ios
xcodebuild -project Forge.xcodeproj -scheme Forge \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
  -derivedDataPath build build

open -a Simulator
xcrun simctl boot 'iPhone 16' 2>/dev/null || true
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/Forge.app
xcrun simctl launch booted dev.forge.app
```

First launch: tap **Enter App** → the gear icon (Settings) → paste your `https://….convex.site` URL → **Save & Test** → create your first app.

*(Prefer XcodeGen? `ios/project.yml` is included — `brew install xcodegen && cd ios && xcodegen generate`.)*

## 4. HTTP API (what the clients talk to)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | `{name?, prompt}` → creates project, schedules build, returns `{projectId}` |
| `GET` | `/api/projects/:id` | Project + chat messages |
| `GET` | `/api/projects/:id/files` | Generated source files |
| `POST` | `/api/projects/:id/messages` | `{prompt}` → iterate on the app (409 while a build is running) |
| `POST` | `/api/projects/:id/wake` | Restart a slept sandbox |
| `DELETE` | `/api/projects/:id` | Delete project + its sandbox |

> ⚠️ Like the "one user, no auth" brief, these endpoints are open by default. To lock them down, set a shared secret on the deployment — `npx convex env set FORGE_API_SECRET 'some-long-random-string'` — and paste the same value into the app's Settings screen (it's sent as an `x-forge-secret` header on every request).

## Repo layout

```
backend/               Convex backend
  convex/schema.ts       projects / messages / files tables
  convex/http.ts         HTTP API for both clients (CORS-enabled)
  convex/builder.ts      "use node" action: Claude codegen + Daytona deploy
  convex/projects|messages|files.ts   internal queries/mutations
web/                   Web client (Vite + React + TS)
  src/pages/             HomePage (project list), BuilderPage (chat/preview/code)
  src/components/        chat, preview iframe, code viewer, modals
  src/api.ts             HTTP client (backend URL + secret in localStorage)
  vercel.json            SPA rewrites for Vercel
  netlify.toml           build config when the site's base dir is web/
netlify.toml           repo-root Netlify config (base = web)
ios/
  Forge.xcodeproj/       Xcode 16 project (hand-authored, synchronized folder)
  Forge/                 SwiftUI sources
  Config/Info.plist      ATS exceptions for the WebView
  project.yml            optional XcodeGen spec
```

## Troubleshooting

- **"Backend not configured" / red banner** — Settings → paste the `.convex.site` URL (not `.convex.cloud`), Save & Test.
- **Build fails with "ANTHROPIC_API_KEY is not set"** — run the `npx convex env set …` commands against the same deployment the app points at (add `--prod` if you deployed with `npx convex deploy`).
- **Preview never loads** — the sandbox may have auto-stopped; open the Preview tab and tap **Wake Sandbox**. Check the Daytona dashboard for quota (free tier: 10 vCPU running at once).
- **Xcode says "future project format"** — you're on Xcode 15 or older; upgrade to Xcode 16+, or regenerate the project with XcodeGen (`ios/project.yml`).
