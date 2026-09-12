# Jenny & Max Wedding Website — Project Brief

This file is written so a Claude Code session (or any new contributor) has
full context without re-deriving decisions that have already been made.
Suggestion: rename this to `CLAUDE.md` in the repo root — Claude Code reads
that file automatically at the start of every session.

## What this is

A wedding website for Jenny & Max's wedding — May 1, 2027, San Francisco.
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
- A companion Apps Script (`apps-script/Code.gs`) that is the actual backend

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
- **Type — two faces, with a strict split:**
  - **Cedarville Cursive** for headings ONLY — "Jenny & Max", section titles,
    event names (`.display` and `.ev-title`).
  - **Playpen Sans** for everything else — body, nav, forms, dates, venues.

  The split is not cosmetic. Cedarville's capitals are script forms: its `D`
  reads as a lowercase `b` and its `L` as a flourished `ℒ`, so it is genuinely
  misreadable in all-caps and poor as body copy — "SATURDAY" renders as
  "SATUbAY". Keep it at display sizes in mixed case. It also ships a single
  weight (400), so any bold on a heading is synthesised by the browser.

  (History: a single family was the rule through Sept 2026 — Kalam, then
  Playpen Sans — until the couple asked for a script for headings. What's
  worth preserving is the discipline of a small, deliberate type system, not
  the specific count.)
- **Texture:** the cream background carries a subtle inline-SVG noise grain
  (`--grain` in `:root`), and the squiggle borders are generated from a
  *seeded* pseudo-random path so they look hand-drawn but don't twitch on
  every re-render. Don't swap either for `Math.random()`.
- **Motifs:** hand-drawn squiggle lines (SVG) as top/bottom borders instead
  of straight hairlines; a small hand-drawn Golden Gate Bridge illustration
  (SVG, sangria-colored line art) as a nod to the SF setting.
- **Explicitly rejected along the way:** a colored/highlighted ampersand in
  "Jenny & Max" (called out as looking like "AI slop"), emoji in the hero
  badge, random scattered dot/star doodles, a teal/rust/cream editorial
  palette from an earlier design pass.
- **Tone of copy:** casual and warm ("Let's go →", "are tying the knot!"),
  not formal invitation language.

## Save-the-date mode

`SAVE_THE_DATE_MODE` (a single const near the top of `index.html`) is the
switch for "we've sent save the dates but not invitations yet." While it's
`true`:

- Login is a **single shared password** (`SAVE_THE_DATE_PASSWORD`) instead of
  the per-guest name lookup. There's no guest object at all in this mode, so
  anything rendering guest-specific content has to tolerate `state.guest`
  being `null`. The guest list is never even fetched.
- The **RSVP and Registry tabs are hidden** from the nav. None of that code is
  deleted — the whole RSVP/plus-one flow and its Apps Script backend are
  untouched and come straight back when the flag flips.
- **Travel** shows a "details coming" line instead of the hotel block.
- **Events** shows only the ceremony's real details; Friday and Sunday are
  placeholder rows. The Friday row deliberately has no title, because the only
  Friday event is the wedding-party rehearsal dinner and naming it would both
  leak the venue and imply every guest is invited.

The password is in client-side source, so it's a speed bump rather than real
security — fine for a save-the-date, not for anything actually private. (The
name-based login it replaces was no stronger.)

## Guest data model

Stored in a Google Sheet, two tabs. **Columns are read by position, not by
header text** — row 1 can contain any labels or be blank; only column order
matters. This was a deliberate choice to reduce fragile typing requirements.

**Guests tab** — columns A–F:
`name | isWeddingParty (TRUE/FALSE) | plusOneAllowed (TRUE/FALSE, legacy — ignored, kept for history) | invitedEvents (semicolon-separated, e.g. "ceremony;reception") | Type ("Main" or "PlusOne") | LinkedTo (PlusOne rows only: the exact name of the Main invitee they belong to)`

Plus-ones are **known in advance, not blank-check** — the couple already
knows who's coming, so every plus-one gets their own named row in this
tab rather than a free-text field on the main invitee's row. A main
invitee can have any number of plus-ones (a whole family, not just one).
`Type`/`LinkedTo` values should come from Data Validation dropdowns in the
sheet, not free-typed, since `LinkedTo` has to match a real Main invitee's
name exactly (fuzzy on whitespace/accents/case, but not on the name
itself).

**RSVPs tab** — columns A–K, **one row per person** (a main invitee and
each of their plus-ones each get their own row, not bundled into one):
`Timestamp | Name | LinkedTo (blank for a main invitee's own row; the main invitee's name for a plus-one's row) | IsWeddingParty | Status | Meal | Dietary | SongRequest (main invitee's row only — shared per party) | Note (main invitee's row only) | LastUpdated | Modified`

Note: semicolons are used instead of commas inside `invitedEvents` to avoid
needing a quote-aware CSV parser client-side.

## RSVP question set (already decided)

Attending yes/no; meal choice; dietary restrictions/allergies (free text);
song request; free text note to the couple — all per the main invitee.
Each plus-one (if any) gets their own attending yes/no + meal + dietary
section, shown **only if the main invitee accepts** — a plus-one can't
attend without their main invitee, though the main invitee can attend
without them. This was deliberately kept to "almost always included" +
"very common" categories from typical wedding RSVP forms — resist
scope-creeping this further without a reason.

## Current backend: Google Sheets + Apps Script ("Option A")

This was a deliberate choice over standing up a real database, made because
it requires no new accounts/services and keeps everything in a tool the
couple already uses. **It is an intentional stepping stone, not the final
architecture** — see "Known limitations" below.

The Apps Script (`apps-script/Code.gs`) is deployed as a Web App
(`Execute as: Me`, `Who has access: Anyone`) and exposes:

- `doPost(e)` — writes one RSVPs row per person (the main invitee, plus one
  row per plus-one they're reporting on), updating each in place if they've
  already got a row rather than duplicating. Validates the main invitee and
  every plus-one name against the Guests tab first, rejecting anything that
  doesn't match a real invitee/linked plus-one. Sent from the client as a
  plain-text body (not `application/json`) specifically to avoid a CORS
  preflight request, which Apps Script doesn't handle.
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
4. **Replacing an image? Give it a new filename.** Overwriting a file in
   place leaves the URL byte-identical, so browsers that have already loaded
   the page keep serving the cached copy and the change looks like it never
   deployed. There's no build step here to hash filenames, so the filename is
   the only cache key — name each photo for what it shows
   (`jenny-max-bench.jpg`), not for the slot it fills
   (`jenny-max-square.jpg`), and swapping photos busts the cache for free.

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
