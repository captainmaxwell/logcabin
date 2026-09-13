# Jenny & Max — May 1, 2027

Wedding website for Jenny & Max. San Francisco, at The Log Cabin in the Presidio.

**Live site:** https://captainmaxwell.github.io/logcabin/

## How it fits together

| | |
|---|---|
| `index.html` | The entire site — HTML, CSS and JS in one file. No build step, no framework. |
| `apps-script/Code.gs` | The backend. A Google Apps Script Web App, bound to a Google Sheet that holds the guest list and RSVPs. |
| `photos/` | Images the live site loads. |
| `originals/` | Raw uploads the images in `photos/` were cropped from. Not loaded by the site. |
| `CLAUDE.md` | The full project brief — design decisions, data model, and the traps worth knowing before changing anything. |

Pushing to `main` deploys the site via GitHub Pages. **Editing `apps-script/Code.gs`
here does not deploy it** — the live copy lives in the Sheet's own script editor
and has to be pasted in and redeployed by hand.

The site is currently in save-the-date mode, which hides the RSVP flow behind a
single flag. Nothing is deleted; flipping `SAVE_THE_DATE_MODE` to `false` in
`index.html` brings the whole thing back.

## Before you change anything

Read [`CLAUDE.md`](CLAUDE.md). It records decisions that look arbitrary but
aren't — the two-colour palette, the heading/body font split, why the sheet is
read by column position, and why the admin passcode check has to stay
server-side. It also lists a security item that needs fixing before the RSVP
flow goes live.
