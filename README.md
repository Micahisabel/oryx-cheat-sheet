# AI Knowledge Hub

Oryx Doors & Windows internal knowledge base — Instructions, Skills, Commands, AI Agents,
Connections (MCP), Plugins, Video, Other AI Tools, Claude/ChatGPT Shortcuts, and a shared
Department Files library. Static HTML/CSS/JS app, no build step required. Data lives in
Firebase Firestore (the knowledge base) and Supabase (Department Files only).

See [ARCHITECTURE.md](ARCHITECTURE.md) for roles, the Firestore/rules coupling, the storage
split, and how deploys work — read it before planning a change to auth, data, or the
sign-up flow.

## Running locally

Any static file server works, since this is plain HTML/CSS/JS with no bundler:

```
npx http-server . -p 3000
```

Then open `http://localhost:3000`.

## Categories & platforms

Entries are grouped by **platform** (Claude, ChatGPT, Other AI Tools, plus All Platforms)
and by **category** (the tab bar). Staff-facing categories include **Instruction**
(step-by-step guides), **Video**, **Assistants** (AI Agents), and **Connection** (MCP).
**Skills** is admin-only — hidden from staff, who use Instruction instead. Category labels,
icons, and plain-language explainers all live in [js/constants.js](js/constants.js).

## Project structure

```
AI-Knowledge-Hub/
├── index.html          Page structure only — no inline CSS or JS (holds APP_VERSION)
├── version.json        Deployed version string; MUST match APP_VERSION in index.html
├── css/
│   ├── style.css        Root variables, reset, body, header/brand basics
│   ├── layout.css       Page-level layout (hub-body, hub-main, .view, full-view modes)
│   ├── sidebar.css      Left platform rail + submenus + category tab bar
│   ├── dashboard.css    Search/filter toolbar (incl. department filter), count row
│   ├── cards.css        Entry grid, cards, pagination, thumbnails, "not used yet" glass
│   ├── modal.css        Skill/entry detail page, side panels, detail blocks
│   ├── forms.css        Inputs, buttons, AI-fill helper, admin/share widgets, dept chips
│   ├── dept-files.css   Department Files full-view + upload progress bar
│   └── responsive.css   Small-screen breakpoint
├── js/
│   ├── firebase.js       Firebase config/init, Firestore collections, Supabase client/keys
│   ├── utils.js          Small formatting/markdown/help-text helpers (escapeHtml, favicon…)
│   ├── constants.js      Category labels/icons/explainers, rich vs. simple vs. shortcut logic
│   ├── state.js          Shared mutable state + cached DOM element references
│   ├── sidebar.js        Platform rail, submenus, category tab clicks, shortcuts mode toggle
│   ├── entries.js        Firestore entries listener, search, department filter, grid renderer
│   ├── skill-detail.js   Full-page entry detail view + markdown export
│   ├── add-entry.js      Admin "Add Entry" panel, AI-fill helper, department picker, save
│   ├── shortcuts-form.js Admin "+ Create" panel for Claude/ChatGPT shortcuts
│   ├── admin.js          Admin auto-detection by email; shows/hides admin-only UI + tabs
│   ├── suggest.js        "Share a Resource" panel (found resource vs. instruction), cooldown
│   ├── review.js         Admin review queue for pending suggestions
│   ├── favorites.js      Per-user starred entries (favorites collection)
│   ├── notifications.js  Per-user new-entry browser notifications (notificationSubs)
│   ├── activity.js       Admin activity feed folded into the Notification panel
│   ├── dept-files.js     Department Files feature (Supabase upload/list/remove)
│   ├── analytics.js      Admin analytics view
│   └── app.js            Bootstraps admin UI + starts the Firestore/Supabase listeners
└── assets/
    └── logos/
        ├── favicon.png           Browser-tab icon (Oryx mark on navy)
        └── oryx-logo-white.png   Header logo (white mark, transparent background)
```

## Load order

`index.html` loads the files in `js/` via plain `<script src>` tags (no ES modules, no
bundler). Each file shares the same global scope — so `firebase.js`'s `entriesCollection`,
`constants.js`'s `CATEGORY_LABELS`, etc. are available to all later files. Keep new files
appended in dependency order: anything a file's *top-level* code touches immediately (not
inside a function or event handler) must already be defined by an earlier `<script>` tag.

## Cache-busting & versioning

There's no bundler, so each `<script>`/`<link>` in `index.html` carries a `?v=N` query
string — **bump the file's `?v=` whenever you change it**, or browsers serve a stale copy.
Separately, `window.APP_VERSION` (inline in `index.html`) and `version.json` hold the deploy
version and **must be bumped together** on every deploy — a background check compares them
and reloads open tabs once when they differ. Current scheme: `2026-08-16.N`.

## Storage

- **Firebase Firestore** — project `oryx-cheat-sheet`. Collections: `entries`,
  `suggestions`, `favorites`, `notificationSubs`, `adminState`. Config is in
  [js/firebase.js](js/firebase.js); the Web SDK API key there is public and safe to expose
  (access is controlled by Firestore security rules, not by hiding the key).
- **Supabase** — used **only** for Department Files: a `department_files` table plus a public
  `department-files` storage bucket. URL and publishable key are in
  [js/firebase.js](js/firebase.js). Access is controlled by Supabase row-level rules.

Security rules for both live in their respective consoles, **not in this repo** — see
[ARCHITECTURE.md](ARCHITECTURE.md).
