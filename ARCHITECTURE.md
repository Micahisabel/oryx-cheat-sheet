# Architecture

Short reference for how the pieces fit together — read this before planning a change that
touches auth, Firestore, or deployment. For file-by-file layout, see the "Project structure"
section in [README.md](README.md).

## Shape of the app

Static HTML/CSS/JS, no build step, no server of its own. State is split across two backends:

- **Firestore** (`oryx-cheat-sheet` project) is the main database — collections `entries`,
  `suggestions`, `favorites`, `notificationSubs`, and `adminState`.
- **Supabase** stores **Department Files only** — a `department_files` table plus a public
  `department-files` storage bucket. It was chosen over Firebase Storage to avoid the paid
  Blaze plan. Access is governed by Supabase row-level rules (public read, staff insert/
  delete), not the Firestore rules.
- **Firebase Auth** (email/password) gates who can write what in Firestore. There is no
  backend server; the client talks to Firestore directly, so **Firestore security rules are
  the only access control** — never assume a UI restriction (e.g. a hidden button or tab) is
  actually enforced unless the matching rule enforces it too.
- **GitHub Pages** serves the static files straight from the `main` branch root of
  `Micahisabel/oryx-cheat-sheet` — pushing to `main` ships to production immediately, with
  no CI, staging, or review gate in between.

## Roles

Two tiers, both checked by email address, not a role field in the database:

- **Admin** — a single hardcoded email (`ADMIN_EMAIL` in [js/admin.js](js/admin.js)). Can
  create/edit/delete any entry, and read/manage the suggestions review queue.
- **Oryx staff** — anyone signed in with an `@oryxdoors.com` address. Can publish Video/Other
  AI Tool discoveries **and Instructions** directly to `entries` (via the "Share a Resource"
  panel), submit suggestions for admin review, and star/subscribe. Staff cannot edit or
  delete existing entries — the intended flow for adapting an Instruction is to **download
  it** and change their own copy. **Skills** are admin-only (tab, cards, and search hidden
  from staff).
- Everyone else (unauthenticated) has read-only access.

The "Share a Resource" panel and staff-writable categories share a 1-minute submit cooldown
(`SUBMIT_COOLDOWN_MS` in [js/suggest.js](js/suggest.js)) to prevent accidental spam.

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
the JS that sends it. Example: letting staff publish **Instructions** required adding
`data.category == 'instructions'` to `isValidDiscovery` in the rules; without it, staff
writes were refused with permission-denied even though the UI allowed them.

Two more consequences of the allowlist worth knowing:

- **Admin-only shape fields go in `adminState`, not `entries`.** The used/not-used state for
  Other AI Tools cards is stored in `adminState/otherToolsUsage`, so toggling it never has to
  pass the strict `entries` shape check. `adminState` is admin read/write only.
- **Department tags reuse the existing `department` field** (a comma-separated string), rather
  than a new field, so staff writes stay within the allowed shape. Staff instruction/discovery
  writes retry without `department` if the rule refuses that extra field, so publishing never
  fails outright.

## Load order

No bundler, no ES modules — `index.html` loads `js/*.js` as plain `<script>` tags sharing one
global scope. Order matters: a file's top-level code (not inside a function/handler) can only
reference globals defined by an earlier `<script>` tag. See README's "Load order" section for
the current sequence.

## Deploying

Merging/pushing to `main` is the deploy. There's no separate build or staging step — verify
changes locally (or in a preview) before merging, since the next push is live.
