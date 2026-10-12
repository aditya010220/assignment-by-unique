# Meta Lead Ads → Real-Time Stream

A real-time integration system where leads submitted via Meta (Facebook / Instagram) Lead Ads are validated, fetched via Graph API, persisted idempotently, and surfaced live to connected mobile and web clients without manual refresh.

---

## Architecture Overview

```
[Meta Lead Ads Webhook]
           │  POST /webhook (HMAC-SHA256 signature, leadgen_id)
           ▼
[Express Server + Raw Body Parser] ── (Verify x-hub-signature-256)
           │
           ├──▶ 200 OK (Immediate Ack-then-Process)
           │
   (Async Background)
           │
           ├──▶ [LeadStore] (Idempotency check: Map keyed by leadgen_id)
           │
           ├──▶ [Graph API Service] (GET /v19.0/{leadgen_id} with retry & backoff)
           │
           ├──▶ [LeadStore.save(lead)]
           │
           └──▶ [Socket.IO Layer] (emit "new-lead")
                                    │
                                    ▼
                     [React Native Expo App & Web Dashboard]
                     - Launch: GET /leads (REST Hydrate)
                     - Live updates: Socket.IO listener (Streaming Deltas)
                     - Reconnect: GET /leads?since=lastSeenTimestamp
```

### Key Architectural Decisions
- **Ack-then-Process:** Webhook POST returns `200 OK` immediately after signature verification to prevent Meta retry storms. Graph API fetching and socket distribution run asynchronously.
- **Raw Body HMAC Verification:** Captures the raw byte buffer before JSON parsing to guarantee valid `x-hub-signature-256` HMAC-SHA256 validation.
- **Idempotency Key:** Uses `leadgen_id` as the primary key. Duplicate webhook deliveries are dropped as silent no-ops.
- **Hydrate-then-Stream:** Clients call `GET /leads` on startup, then subscribe to Socket.IO events, avoiding missed or duplicated leads.

---

## Project Structure

```
assignment-by-unique/
├── server/
│   ├── config/env.js              # Environment variable validation
│   ├── middleware/rawBody.js      # Raw buffer capture for HMAC
│   ├── services/signature.js      # HMAC-SHA256 signature validation
│   ├── services/leadStore.js      # Lead repository (in-memory)
│   ├── services/graphApi.js       # Meta Graph API v19.0 client with backoff
│   ├── realtime/io.js             # Socket.IO instance & helpers
│   ├── routes/webhook.js          # GET /webhook (handshake) & POST /webhook
│   ├── routes/leads.js            # GET /leads (REST endpoint with ?since=)
│   ├── public/index.html          # Built-in live browser dashboard
│   ├── server.js                  # Express bootstrap & /health endpoint
│   └── __tests__/                 # Server unit & integration tests (20 tests)
│
├── app/
│   ├── src/
│   │   ├── types/lead.ts          # TypeScript Lead & Connection contracts
│   │   ├── services/api.ts        # REST API fetch wrapper
│   │   ├── hooks/useLeadsQuery.ts # REST hydrate & delta merge hook
│   │   ├── hooks/useLeadSocket.ts # Socket.IO lifecycle & reconnect hook
│   │   └── screens/LeadsScreen.tsx# Monochrome Lead Stream screen
│   ├── App.tsx                    # Root Expo component
│   └── __tests__/                 # App unit tests (11 tests)
│
├── md/
│   └── meta-lead-ads-system-design.md # Full system design document
├── .env.example                   # Example environment configuration
├── AGENTS.md                      # Engineering rules & boundaries
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### 1. Environment Configuration
Create a `.env` file in the root directory (or use `.env.example` as a template):
```env
PORT=3000
VERIFY_TOKEN=your_verify_token_here
APP_SECRET=your_meta_app_secret_here
PAGE_ACCESS_TOKEN=your_page_access_token_here
```

---

### 2. Run Backend Server
```bash
cd server
npm install
node server.js
```
The server will start on `http://localhost:3000`:
- **Web Dashboard:** `http://localhost:3000/`
- **Health check:** `http://localhost:3000/health`
- **Webhook endpoint:** `http://localhost:3000/webhook`
- **REST Leads:** `http://localhost:3000/leads`

---

### 3. Expose Server to Meta (via ngrok)
In a new terminal:
```bash
npx ngrok http 3000
```
Copy the generated HTTPS URL (e.g., `https://xxxx.ngrok-free.app`).

**In Meta Developer Dashboard (Webhooks → Page):**
- **Callback URL:** `https://xxxx.ngrok-free.app/webhook`
- **Verify Token:** matching `VERIFY_TOKEN` in your `.env`

---

### 4. Run the Mobile App (Expo)
In another terminal:
```bash
cd app
npm install
npx expo start
```
- Press **`w`** to preview in your web browser.
- Or scan the QR code using **Expo Go** on iOS or Android.

---

## Testing

### Automated Test Suites
Both suites run independently with 100% pass rate:

```bash
# Server tests (20 tests across 4 suites)
cd server
npm test

# App tests (11 tests across 3 suites)
cd app
npm test
```

### Manual Testing

1. **Meta Lead Ads Testing Tool:**
   - Go to [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing).
   - Select your Page and Form.
   - Click **Create Lead** / **Preview Form** and submit.
   - The lead appears live in the UI within seconds.

2. **In-Browser Simulator:**
   - Open `http://localhost:3000/` in your browser.
   - Click the **+ Simulate Meta Lead** button to push a sample lead through the real-time Socket.IO stream.

---
