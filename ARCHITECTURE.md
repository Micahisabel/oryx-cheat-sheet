# Architecture

Short reference for how the pieces fit together — read this before planning a change that
touches auth, Firestore, or deployment. For file-by-file layout, see the "Project structure"
section in [README.md](README.md).

## Shape of the app

Static HTML/CSS/JS, no build step, no server of its own. All state lives in Firebase:

- **Firestore** (`oryx-cheat-sheet` project) is the database — collections `entries` and
  `suggestions`.
- **Firebase Auth** (email/password) gates who can write what. There is no backend server;
  the client talks to Firestore directly, so **Firestore security rules are the only access
  control** — never assume a UI restriction (e.g. a hidden button) is actually enforced
  unless the matching rule enforces it too.
- **GitHub Pages** serves the static files straight from the `main` branch root of
  `Micahisabel/oryx-cheat-sheet` — pushing to `main` ships to production immediately, with
  no CI, staging, or review gate in between.

## Roles

Two tiers, both checked by email address, not a role field in the database:

- **Admin** — a single hardcoded email (`ADMIN_EMAIL` in [js/admin.js](js/admin.js)). Can
  create/edit/delete any entry, and read/manage the suggestions review queue.
- **Oryx staff** — anyone signed in with an `@oryxdoors.com` address (`STAFF_EMAIL_DOMAIN` in
  [js/suggest.js](js/suggest.js)). Can publish Discoveries directly and submit Skill/Command
  requests for admin review.
- Everyone else (unauthenticated) has read-only access.

Both tiers are re-declared independently in the Firestore rules (`isAdmin()` /
`isOryxStaff()`) — a role check added in the JS UI does nothing on its own without the
matching rule.

## Data model coupling (the sharp edge)

Firestore rules validate document shape with an allowlist, not just "is this field present."
That means **the client and the rules must agree on exact values**, not just field names —
this has broken silently before (see [8914dc7](https://github.com/Micahisabel/oryx-cheat-sheet/commit/8914dc7)):
Other AI Tools discoveries failed to publish because the rule's allowed `category` values
didn't include the new subcategories the UI had started sending.

Before adding a new option to any dropdown that gets written to Firestore (category,
platform, type, etc.), check the corresponding `isValidDiscovery` / `isValidSuggestion`
function in the Firestore rules (managed in the Firebase console, not this repo) — not just
the JS that sends it.

## Load order

No bundler, no ES modules — `index.html` loads `js/*.js` as plain `<script>` tags sharing one
global scope. Order matters: a file's top-level code (not inside a function/handler) can only
reference globals defined by an earlier `<script>` tag. See README's "Load order" section for
the current sequence.

## Deploying

Merging/pushing to `main` is the deploy. There's no separate build or staging step — verify
changes locally (or in a preview) before merging, since the next push is live.
