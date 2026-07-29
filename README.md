# AI Knowledge Hub

Oryx Doors & Windows internal knowledge base — Skills, Commands, AI Agents, MCPs, Plugins,
Discoveries, Other AI Tools, and Claude/ChatGPT Shortcuts. Static HTML/CSS/JS app backed by
Firebase Firestore, no build step required.

See [ARCHITECTURE.md](ARCHITECTURE.md) for roles, the Firestore/rules coupling, and how
deploys work — read it before planning a change to auth, data, or the sign-up flow.

## Running locally

Any static file server works, since this is plain HTML/CSS/JS with no bundler:

```
npx http-server . -p 3000
```

Then open `http://localhost:3000`.

## Project structure

```
AI-Knowledge-Hub/
├── index.html          Page structure only — no inline CSS or JS
├── css/
│   ├── style.css        Root variables, reset, body, header/brand basics
│   ├── layout.css       Page-level layout (hub-body, hub-main, .view)
│   ├── sidebar.css      Left platform rail + submenus + category tab bar
│   ├── dashboard.css    Search/filter toolbar, count row
│   ├── cards.css        Entry grid, cards, pagination, thumbnails
│   ├── modal.css        Skill detail page, side panels, detail blocks
│   ├── forms.css        Inputs, buttons, AI-fill helper, admin/suggestion widgets
│   └── responsive.css   Small-screen breakpoint
├── js/
│   ├── firebase.js       Firebase config/init, Firestore collections, app-wide keys
│   ├── utils.js          Small formatting/markdown helpers (escapeHtml, platformMeta, ...)
│   ├── constants.js      Category labels/icons, rich vs. simple vs. shortcut category logic
│   ├── state.js          Shared mutable state + cached DOM element references
│   ├── sidebar.js        Platform rail, submenus, category tab clicks, shortcuts mode toggle
│   ├── entries.js        Firestore entries listener, search, and the main grid renderer
│   ├── skill-detail.js   Full-page entry detail view + markdown export
│   ├── add-entry.js      Admin "Add Entry" panel, AI-fill helper, save logic
│   ├── shortcuts-form.js Admin "+ Create" panel for Claude/ChatGPT shortcuts
│   ├── admin.js          Admin passcode gate
│   ├── suggest.js        "Suggest a Resource" panel (Discovery vs. Request)
│   ├── review.js         Admin review queue for pending suggestions
│   └── app.js            Bootstraps admin UI + starts the two Firestore listeners
└── assets/
    └── logos/
        ├── favicon.png           Browser-tab icon (Oryx mark on navy)
        └── oryx-logo-white.png   Header logo (white mark, transparent background)
```

## Load order

`index.html` loads the files in `js/` in the order listed above via plain `<script src>`
tags (no ES modules, no bundler). Each file shares the same global scope, exactly like the
single inline `<script>` block this project used to have — so `firebase.js`'s
`entriesCollection`, `constants.js`'s `CATEGORY_LABELS`, etc. are all just as available to
later files as they were before the split. Keep new files appended in dependency order:
anything a file's *top-level* code touches immediately (not inside a function or event
handler) must already be defined by an earlier `<script>` tag.

## Firebase

Project: `oryx-cheat-sheet`. Collections: `entries` and `suggestions`. Config lives in
`js/firebase.js` — the API key there is the public Firebase Web SDK key, safe to expose
client-side (access is controlled by Firestore security rules, not by hiding this key).
