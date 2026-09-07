# LiveLogger Lite v2.0

A voice-to-report daily log app for tradesmen: dictate your day, AI turns it into a structured report, download a PDF. Built as the Footing Lite variant of LiveLogger -- no GC to satisfy, so there's no schema guard and no notice-clock intercept, just the core loop: talk, get a clean report.

Client zero: a sole-proprietor electrician, tested first on the developer's own active job before handoff.

## What it actually does right now
- **Dictation via your phone's own keyboard mic** (not a custom recording feature) -- works identically on iPhone and Android, and inside an installed PWA on iOS, where the browser's own Web Speech API doesn't work.
- **AI parsing** into structured fields (job site, hours, work performed, materials, delays, safety notes -- configurable, see below), with a per-trade glossary so phone-dictation mishears of trade terms ("Ruffin" -> "rough-in") get silently corrected. Numbers, names, and addresses are never guessed at.
- **Needs a Couple Details** -- if a required field comes back blank, the app asks a plain follow-up question and lets you answer in the same big dictation box. No small form fields.
- **Contradiction flagging** -- pulls up to 5 prior reports for the same job site and flags it if today's dictation seems to contradict one (a problem marked resolved before, showing up again).
- **Fix Something** -- every completed report has a correction flow for catching a mis-hear or a mistake after the fact, before or after the PDF's been downloaded. Corrects just the field in question, doesn't touch the rest.
- **Offline queue** -- installable PWA (Add to Home Screen), works with zero signal. Entries sit in Pending Sync and parse automatically the moment the phone reconnects.
- **14-day retention** on completed reports, auto-pruned. Nothing pending or waiting on you is ever silently dropped.
- **Delete** anywhere, always tap-to-confirm -- no native browser popups.

## Run it locally
1. `npm install`
2. Copy `.env.example` to `.env`, paste in a real key from console.anthropic.com -> API Keys
3. `npm start`
4. Open **http://localhost:3000** on this computer -- that's the real AI parsing, not a placeholder.
5. To test on your phone over wifi: same network, then `http://<this-computer's-LAN-IP>:3000` (the server prints this on startup). Dictation, parsing, and PDF all work this way.

**One real limitation:** the offline queue and "Add to Home Screen" install only work over `https://` or on `localhost` itself -- a browser security rule, not a bug here. LAN testing on your phone proves the AI quality and PDF output, but not the offline behavior. For that, deploy for real (below).

## Going from local test to a real deploy
Two options, same underlying logic, kept in lockstep:
- **`server.js`** (what you just ran) -- deploys as-is to Railway, Render, or Fly.io. Push to a GitHub repo, connect it, add `ANTHROPIC_API_KEY` as an environment variable in their dashboard, done.
- **`api/parse-example.js`** -- same logic, written as a Vercel/Netlify serverless function instead. Same `TRADE_GLOSSARY`, same system prompt, same `{values, flags, date}` response shape as `server.js`. If you change one, change both, or you'll end up with the local test behaving differently than what's actually deployed.

Either way the front end doesn't change -- it just calls `/api/parse`.

## The one file you'll edit per client
Everything about the report -- what fields exist, what's required, what shows on the PDF, what the AI is asked to extract -- comes from one array near the top of `index.html`:

```js
const REPORT_FIELDS = [
  { key: "jobsite", label: "Job Site / Address", hint: "...", required: true },
  ...
];
```

Add, remove, rename, reorder, or flip `required` here. The PDF layout and the parsing prompt both regenerate from this list automatically. Swap `TRADE_GLOSSARY` in `server.js` (and `api/parse-example.js`, same list) for a different trade's terminology.

`COMPANY_NAME` (in `index.html`) is the business name that appears on the generated PDF. `PRODUCT_NAME` is what appears on-screen ("LiveLogger Lite v2.0") -- the client sees his own business name on his paperwork, not this product's internal name.

## Still open
- **Report destination** -- right now "Download PDF" saves to the phone. Emailing it automatically or landing it in a shared Google Sheet is a small addition to the serverless function, not a rebuild.
- **Employee list** -- currently free-text name entry. A fixed dropdown of an actual crew is a two-line change.
- **Hosting** -- needs a real deploy (Vercel/Netlify/Railway, free tier is plenty at this scale) so employees get a real link instead of a file.
- **manifest.json icons** -- still the original placeholder icons; not yet redrawn to match the black/red visual redesign.
