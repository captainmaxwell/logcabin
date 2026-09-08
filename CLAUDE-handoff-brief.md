# Jenny & Max Wedding Website — Project Brief

This file is written so a Claude Code session (or any new contributor) has
full context without re-deriving decisions that have already been made.
Suggestion: rename this to `CLAUDE.md` in the repo root — Claude Code reads
that file automatically at the start of every session.

## What this is

A wedding website for Jenny & Max's wedding — October 3, 2026, San Francisco.
Guests log in by typing their name (matched against a guest list, not a real
auth system), see event details, and RSVP. Wedding-party members additionally
see rehearsal dinner details, but only after they RSVP "yes."

## Current status

Working prototype, single self-contained HTML file (`jenny-max-wedding-v2.html`),
no build step. It currently has:
- Guest login (name lookup)
- Tabs: Our Story, Events, RSVP, Travel, Registry, FAQ
- RSVP form with a real backend (see below) — submits, then shows a
  confirmation view instead of leaving the form visible, with a
  "Change my RSVP" button to re-open it for edits
- Admin dashboard (passcode-gated) showing all RSVP responses + CSV export
- A companion Apps Script (`AppsScript-Code.gs`) that is the actual backend

**This has not yet been moved into a real repo, git history, or hosting.**
That's the next step this brief is meant to support.

## Design system (already decided — don't relitigate without asking)

The visual direction is based on Minted's "Party On!" wedding website design
(product code MIN-2TD-DWW, by artist Zove Ahhh) — hand-drawn, playful,
colorful, NOT the quiet-elegant-editorial-serif look we originally started
with and then abandoned.

- **Palette — exactly two colors, no more:**
  - Cream background: `#FBF3E7`
  - Sangria red (the only accent color): `#B5324A`
  - Plum/near-black for text: `#3D2621`
  - Orange and yellow were explicitly tried and explicitly rejected — do not
    reintroduce them.
- **Type — one font family everywhere:** Kalam (Google Font), used at
  different weights (300/400/700) for hierarchy, not paired with a second
  family. This was a deliberate simplification after an earlier draft mixed
  several font stacks and it looked inconsistent.
- **Motifs:** hand-drawn squiggle lines (SVG) as top/bottom borders instead
  of straight hairlines; a small hand-drawn Golden Gate Bridge illustration
  (SVG, sangria-colored line art) as a nod to the SF setting.
- **Explicitly rejected along the way:** a colored/highlighted ampersand in
  "Jenny & Max" (called out as looking like "AI slop"), emoji in the hero
  badge, random scattered dot/star doodles, a teal/rust/cream editorial
  palette from an earlier design pass.
- **Tone of copy:** casual and warm ("Let's go →", "are tying the knot!"),
  not formal invitation language.

## Guest data model

Stored in a Google Sheet, two tabs. **Columns are read by position, not by
header text** — row 1 can contain any labels or be blank; only column order
matters. This was a deliberate choice to reduce fragile typing requirements.

**Guests tab** — columns A–D:
`name | isWeddingParty (TRUE/FALSE) | plusOneAllowed (TRUE/FALSE) | invitedEvents (semicolon-separated, e.g. "ceremony;reception")`

**RSVPs tab** — columns A–J (script appends rows in this exact order):
`Timestamp | GuestName | IsWeddingParty | Status | MealSelf | DietarySelf | PlusOneName | MealPlusOne | SongRequest | Note`

Note: semicolons are used instead of commas inside `invitedEvents` to avoid
needing a quote-aware CSV parser client-side.

## RSVP question set (already decided)

Attending yes/no; meal choice; dietary restrictions/allergies (free text);
plus-one's name + meal (only shown if `plusOneAllowed`); song request; free
text note to the couple. This was deliberately kept to "almost always
included" + "very common" categories from typical wedding RSVP forms —
resist scope-creeping this further without a reason.

## Current backend: Google Sheets + Apps Script ("Option A")

This was a deliberate choice over standing up a real database, made because
it requires no new accounts/services and keeps everything in a tool the
couple already uses. **It is an intentional stepping stone, not the final
architecture** — see "Known limitations" below.

The Apps Script (`AppsScript-Code.gs`) is deployed as a Web App
(`Execute as: Me`, `Who has access: Anyone`) and exposes:

- `doPost(e)` — appends a new row to the RSVPs tab from JSON in the request
  body. Sent from the client as a plain-text body (not
  `application/json`) specifically to avoid a CORS preflight request, which
  Apps Script doesn't handle.
- `doGet(e)` with `?action=guests` — returns the Guests tab as JSON. This
  replaced an earlier approach of fetching a "Published to web" CSV export
  directly, which failed because Google's CSV publish endpoint doesn't set
  CORS headers and browsers block the cross-origin fetch. Route all guest
  list reads through the script, not a direct Sheets CSV link.
- `doGet(e)` with `?action=myrsvp&name=X` — returns one guest's existing
  RSVP (no passcode — same trust model as login itself, since "knowing a
  name" is already the entire access control here).
- `doGet(e)` with `?action=rsvps&passcode=X` — returns all RSVP rows, gated
  by a passcode checked **server-side inside the script**, not client-side.
  This was an explicit fix: an earlier version embedded the admin passcode
  as a plain constant in the HTML source, visible to anyone who viewed page
  source. Do not regress this back to a client-side check.

The current admin passcode is set in the Apps Script itself
(`ADMIN_PASSCODE` constant) — check that file rather than assuming a value,
since it's been changed at least once already.

## Known limitations of the current backend (why "Option B" comes later)

The couple has explicitly signed off on this being temporary. When revisiting:
- No real authentication — the admin passcode is a shared secret, and even
  the guest "login" is just a name match with no real access control.
- Apps Script has real rate limits and is not built for high concurrency.
- No environment-variable/secrets management — the passcode is a literal
  string in the script source. **If this repo becomes public on GitHub,
  do not commit real secrets in plain text** — this is a good forcing
  function to finally move the passcode (and eventually all backend logic)
  into a real hosted backend (e.g., Supabase + Vercel serverless functions)
  with proper env vars and real auth for the admin view.
- No real hosting yet — the site is a downloaded HTML file, not a public URL.

## Debugging history worth knowing about

Two real bugs already hit and fixed, worth knowing so they aren't
rediscovered from scratch:
1. Google's "Publish to web → CSV" endpoint cannot be fetched cross-origin
   from client-side JS (missing CORS headers) — this is why guest lookup
   goes through the Apps Script instead of a direct CSV link.
2. Editing Apps Script code and saving does **not** update the live `/exec`
   URL — you must explicitly redeploy via
   `Deploy → Manage deployments → pencil icon → Version: New version → Deploy`
   to push code changes live without changing the URL.
3. Google Sheets' native mobile app has no Apps Script editor and no
   "Publish to web" menu — that setup work needs a desktop browser (Chrome
   with "Desktop site" mode works if mobile-only is unavoidable).

## Immediate next steps

1. Move the HTML file and Apps Script into a proper Git repo (suggest
   `index.html` at the root, `apps-script/Code.gs` for reference/history,
   since the actual live copy of the script lives in the Google Sheet's
   script editor, not deployed from this repo).
2. Deploy `index.html` as a static site via Vercel or Netlify for a real
   public URL with real deploy logs.
3. Longer-term: migrate off Google Sheets/Apps Script to a real backend
   (Supabase + serverless functions was the leading candidate discussed) —
   keep the same data shape (guest fields, RSVP fields) so the migration is
   mostly a storage-layer swap, not a redesign.

## Things NOT to change without asking

- The two-color palette and single-font system (see Design system above)
- The RSVP question set
- The column-position-based (not header-text-based) sheet reading approach
- Keeping the admin passcode check server-side
