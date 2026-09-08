// Local test server. Run this on your own laptop to test the REAL AI
// parsing (not the fallback) before handing anything to a client.
//
// Setup:
//   1. npm install
//   2. Copy .env.example to .env and paste in your own Anthropic API key
//      (get one at console.anthropic.com -> API Keys)
//   3. npm start
//   4. Open http://localhost:3000 on THIS computer to test the full flow.
//
// Testing on your phone: a phone on the same wifi CAN reach this
// (http://<your-laptop's-LAN-IP>:3000), and dictation/parsing/PDF will all
// work over that connection. The one thing that won't work over plain LAN
// http is the offline/installable piece -- browsers only allow service
// workers on https or on "localhost" itself. So: use your phone over LAN
// to sanity-check the dictation -> parsing -> PDF quality today, then do
// a real deploy (Vercel/Netlify, ~10 min, free) when you want to test the
// offline/install behavior on the phone for real.

require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =================================================================
   TRADE GLOSSARY -- swap this list per client/trade, same idea as
   REPORT_FIELDS in index.html. These are real terms this trade uses
   that phone dictation commonly mangles. Not exhaustive by design --
   it's a nudge for the AI, not a hard dictionary lookup.
   ================================================================= */
const TRADE_GLOSSARY = [
  "romex", "conduit", "EMT", "rigid conduit", "breaker", "breaker panel",
  "subpanel", "service panel", "load center", "meter base", "service entrance",
  "weatherhead", "whip", "pigtail", "wire nut", "junction box", "pull box",
  "mud ring", "knockout", "fish tape", "GFCI", "AFCI", "THHN", "THWN",
  "gauge (as in 12-gauge, 10-gauge wire)", "neutral", "ground", "hot wire",
  "three-way switch", "four-way switch", "single pole", "double pole",
  "torque", "megger", "continuity", "short circuit", "ground fault",
  "rough-in", "trim-out", "recessed can", "disconnect", "transfer switch",
  "generator interlock", "bus bar", "ground rod", "bonding", "arc flash",
  "panel schedule", "amperage", "voltage drop",
];

app.use(express.json());
app.use(express.static(__dirname));

/* =================================================================
   BASIC RATE LIMIT -- a PWA can't hold a real secret, so anyone who
   discovers this URL could otherwise POST unlimited dictations, each
   spending real Anthropic API tokens on this account's key. This caps
   the damage per IP. Not a real auth system -- just a floor.
   ================================================================= */
const RATE_LIMIT_MAX = 30;           // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // per IP, per this window
const _rateLimitState = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const rec = _rateLimitState.get(ip);
  if (!rec || now > rec.resetAt) {
    _rateLimitState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > RATE_LIMIT_MAX;
}

app.post("/api/parse", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests -- try again in a minute." });
  }

  const { rawText, employee, date, fields, priorReports } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "No ANTHROPIC_API_KEY set. Copy .env.example to .env and add your key.",
    });
  }
  if (!rawText || !Array.isArray(fields)) {
    return res.status(400).json({ error: "Missing rawText or fields" });
  }

  const fieldList = fields.map((f) => `- ${f.key}: ${f.label}`).join("\n");
  const glossaryList = TRADE_GLOSSARY.join(", ");

  const priorReportsSection = (Array.isArray(priorReports) && priorReports.length)
    ? `

Prior reports for this same job site (most recent first) -- use these for
two things only: (1) catch contradictions with today's dictation, and (2)
recognize this site's established terminology/context so you parse today's
report more confidently:
${priorReports.map((r, i) => `[${i === 0 ? "most recent" : `${i + 1} back`}, ${r.date}]\n${
  Object.entries(r).filter(([k]) => k !== "date").map(([k, v]) => `  ${k}: ${v || "(blank)"}`).join("\n")
}`).join("\n\n")}`
    : "";

  const systemPrompt = `You convert a tradesman's spoken end-of-shift dictation into a structured daily report.
Return ONLY a JSON object, no other text, in exactly this shape:
{
  "values": { ${fields.map(f => `"${f.key}": "..."`).join(", ")} },
  "flags": ["..."],
  "date": "YYYY-MM-DD"
}

The report is currently dated ${date}. For the "date" key: just echo back
"${date}" unchanged UNLESS the dictation explicitly says this report is for
a different day than that (e.g. "this was actually yesterday," "put this
under the 5th, not today," "wrong date, should be Tuesday"). Only change it
on a clear, explicit statement -- never infer a different date from context
alone. If you do change it, resolve it to an actual YYYY-MM-DD date relative
to ${date}.

"values" rules:
- Use the worker's own words where possible, just organized under the right field.
- If something wasn't mentioned, use an empty string for that field -- never invent details.
- "delaysIssues" and "safetyNotes" should be empty strings if nothing relevant was said.
- Keep the tone plain and factual, like a field report, not a summary or narrative.

Hours worked (field key "hoursWorked"):
- If a time range is mentioned (e.g. "7:30 to about 2", "6:30am to 2:00pm",
  "started at 7, wrapped up around 2:30"), KEEP the time range as the worker
  said it (cleaned up minimally for readability), and add the calculated
  total in parentheses after it. Format: "<time range> (X.X hours)" -- e.g.
  "7:30 to about 2 (6.5 hours)". Never replace the range with just the
  number -- both need to be there.
- Assume a normal trade workday: an early/morning-sounding start time is AM,
  and an early-afternoon end time (12-6) is PM, unless the dictation says
  otherwise.
- If a lunch or other break is explicitly mentioned, subtract it from the
  calculated total. If nothing suggests a break, don't assume one.
- If hours are already stated directly as a plain number with no time range
  (e.g. "put in 8 hours"), just use that number as-is -- nothing to append.
- If the dictation gives no usable time information at all, leave the field
  as an empty string rather than guessing.

Required fields -- do not guess to avoid a blank:
- It is far better to leave a required field empty than to invent a plausible
  answer. Any field left blank triggers a follow-up question back to the
  worker, so there is no downside to leaving something out that genuinely
  wasn't said -- fabricating content to "fill the gap" is worse than an
  empty field, always.

Job site / address (field key "jobsite"):
- Tradesmen usually refer to a job by a client's name or a nickname, not a
  formal street address -- "the Peterson job," "Johnson residence," "the
  strip mall on Academy." Any of these count as a valid, complete answer
  for this field. Do not withhold it or treat it as incomplete just because
  it isn't a full postal address -- a real street address is a bonus, not
  a requirement.

Follow-ups and corrections -- this dictation may contain one of two special
labeled sections appended after the original text:
- A section starting "Follow-up:" is the worker answering a specific
  question about something that was missing. Use it to fill in whatever
  was blank -- it's additional information, not a contradiction of anything.
- A section starting "Correction from the worker after reviewing the
  report:" means something in the ORIGINAL dictation was wrong or
  misheard, and this new text overrides it. Apply the correction to
  whichever specific field(s) it's clearly about, and leave everything
  else from the original dictation untouched. E.g. if the correction says
  "it's rough-in, not Ruffin," only "Ruffin" changes to "rough-in" --
  nothing else in the report should be rewritten or re-interpreted because
  of it. This includes the "date" key above -- a correction can fix the
  date too (e.g. "this report should be dated yesterday, not today").

Speech-to-text cleanup:
- This text came from a phone's voice dictation, so it will contain phonetic
  mis-hears of trade terminology. Here's a reference glossary of real terms
  this trade uses -- check dictation against these first: ${glossaryList}
- Also silently correct other obvious trade-term mis-hears not on that list
  when you're confident, based on context (skilled trades: electrical,
  plumbing, construction). Do not leave the garbled version in the output.
- Only correct clear phonetic mistranscriptions of terms. Do not "correct"
  genuinely ambiguous wording, and never change a number, measurement, name,
  or address -- if those are unclear, keep them exactly as dictated rather
  than guessing.

"flags" -- a short list of plain-English strings, empty array if none:
- Only include something here if today's dictation appears to contradict,
  or meaningfully depart from, what a prior report for this same job site
  said (e.g. a problem marked resolved before is described as ongoing again,
  a measurement or count doesn't match, work already reported as done is
  described as being redone unexpectedly).
- Each flag should read like a helpful heads-up to the person reviewing
  this later, not an accusation -- state what was said before, what's being
  said now, and let them judge it. e.g. "The Sept 4 report said the panel
  schedule issue was resolved -- today's dictation describes the same issue
  again."
- Do NOT flag routine, expected day-to-day differences (different tasks,
  different hours, normal progress). Only flag genuine contradictions or
  things worth double-checking.
- If there are no prior reports for this job site provided below, or
  nothing contradicts, return an empty array -- do not invent a flag just
  to have something to say.${priorReportsSection}`;

  const userPrompt = `Employee: ${employee}\nDate: ${date}\n\nDictation:\n"""\n${rawText}\n"""`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(502).json({ error: data.error?.message || "Anthropic API error" });
    }

    const text = (data.content || []).map((b) => b.text || "").join("");
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({
      values: parsed.values || {},
      flags: parsed.flags || [],
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : date,
    });
  } catch (err) {
    console.error("Parse error:", err);
    return res.status(500).json({ error: "Failed to parse dictation" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nDaily Log test server running:`);
  console.log(`  On this computer:  http://localhost:${PORT}`);
  console.log(`  On your phone (same wifi): http://<this-computer's-LAN-IP>:${PORT}`);
  console.log(`\nFind your LAN IP with "ipconfig getifaddr en0" (Mac) or "ipconfig" (Windows).\n`);
});
