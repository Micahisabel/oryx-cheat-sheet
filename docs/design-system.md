# Oryx AI Knowledge Hub — Design System

Extracted from the live CSS in `css/`. Use this as the reference when reusing the Oryx visual identity in another project.

Source files: `css/style.css` (tokens), `css/layout.css`, `css/sidebar.css`, `css/cards.css`, `css/forms.css`, `css/modal.css`, `css/dashboard.css`.

---

## 1. Fonts

Loaded from Google Fonts in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

| Role | Family | Weights loaded | Used for |
|---|---|---|---|
| **Display** | `Archivo`, sans-serif | 500, 600, 700 | Headings, buttons, labels, nav, pills, uppercase eyebrows |
| **Body** | `Inter`, sans-serif | 400, 500, 600 | Paragraphs, inputs, descriptions, list text |
| **Mono** | `'Courier New', monospace` | — | Keyboard shortcut keys, code snippets |

The body element sets `-webkit-font-smoothing: antialiased`.

**Rule of thumb:** Archivo for anything structural or clickable, Inter for anything you read in sentences.

---

## 2. Colour tokens (as currently defined)

From `css/style.css`:

```css
:root{
  --oryx-blue:#022A3A;             /* primary — header, buttons, headings */
  --oryx-blue-tint:#0C4A63;        /* hover state for primary */
  --white:#FFFFFF;
  --silver:#A9A9A9;                /* muted text on dark backgrounds */
  --black:#000000;                 /* body text */
  --panel:#F6F8F9;                 /* card / ghost-button background */
  --line:rgba(2,42,58,0.14);       /* borders */
  --line-soft:rgba(2,42,58,0.08);  /* subtle dividers, hover fills */
  --font-display:'Archivo',sans-serif;
  --font-body:'Inter',sans-serif;
}
```

### Colours used but NOT tokenised

These are hardcoded across multiple CSS files. They are part of the palette in practice, but have no variable. **Tokenise them in any new project.**

| Hex | Meaning | Where used |
|---|---|---|
| `#F5C451` | **Gold accent** — AI features, badges, KPI highlight | `.btn-ai-fill`, notification badge, sparkle icon, analytics KPI border |
| `#e9b53c` | Gold hover | `.btn-ai-fill:hover` |
| `#8a2b2b` | Danger text | Field errors, delete button, sign-out |
| `#fbeceb` | Danger background | `.card-del` |
| `#f5d9d7` | Danger background hover | `.card-del:hover` |
| `#c15656` | Error / alert dot | Sync status error, analytics KPI accent |
| `#5b6b72` | Muted body text on light ground | Auth subtext, edit button, notes |
| `#8a97a0` | Muted label | Analytics KPI labels |
| `#e9eef0` | Neutral hover fill | `.btn-ai:hover` |
| `#8a5a34` | Bronze — "new" ribbon | Dashboard card tag |

---

## 3. Recommended token set for reuse

Copy this block into a new project instead of the raw hexes above. Same palette, properly named.

```css
:root{
  /* Brand */
  --brand:#022A3A;
  --brand-hover:#0C4A63;

  /* Neutrals */
  --white:#FFFFFF;
  --black:#000000;
  --panel:#F6F8F9;
  --text-muted:#5b6b72;
  --text-muted-light:#8a97a0;
  --silver:#A9A9A9;              /* muted text on dark backgrounds only */

  /* Lines — brand blue at low alpha, never neutral grey */
  --line:rgba(2,42,58,0.14);
  --line-soft:rgba(2,42,58,0.08);

  /* Accent (AI / highlight) */
  --accent:#F5C451;
  --accent-hover:#e9b53c;
  --accent-deep:#8a5a34;

  /* Semantic */
  --danger:#8a2b2b;
  --danger-bg:#fbeceb;
  --danger-bg-hover:#f5d9d7;
  --alert:#c15656;
  --neutral-hover:#e9eef0;

  /* Type */
  --font-display:'Archivo',sans-serif;
  --font-body:'Inter',sans-serif;

  /* Radii */
  --r-pill:999px;
  --r-lg:14px;
  --r-md:12px;
  --r-sm:10px;
  --r-xs:8px;

  /* Shadows */
  --sh-subtle:0 1px 4px rgba(2,42,58,0.06);
  --sh-card:0 2px 10px rgba(2,42,58,0.08);
  --sh-raised:0 8px 24px rgba(2,42,58,0.18);
  --sh-hover:0 8px 20px rgba(2,42,58,0.25);
  --sh-modal:0 40px 90px -30px rgba(2,42,58,0.55), 0 0 0 1px rgba(255,255,255,0.06);
  --sh-focus:0 0 0 3px rgba(2,42,58,0.08);
}
```

---

## 4. Type scale

| Element | Family | Size | Weight | Letter-spacing | Transform |
|---|---|---|---|---|---|
| H1 (brand) | Display | 20px | 700 | 0.01em | — |
| Section heading | Display | 22px | 600 | — | — |
| Card title | Display | 14px | 600 | — | — |
| Body text | Body | 14px | 400 | — | — |
| Body small | Body | 12.5–13.5px | 400–500 | — | — |
| Button | Display | 12–13.5px | 600–700 | 0.01–0.08em | — |
| Field label | Display | 11px | 600 | 0.06em | uppercase |
| Eyebrow / tagline | Display | 11px | 500 | 0.08–0.12em | uppercase |
| Sidebar section header | Display | 10.5px | 600 | 0.16em | uppercase |
| Meta / caption | Display | 11–11.5px | 500–600 | 0.05em | uppercase |
| Badge | Body | 11px | 700 | — | — |
| Shortcut key | Mono | 14px | 600 | — | — |

Line-height: `1.3` on headings, `1.5–1.6` on body copy.

**Pattern:** small text gets more letter-spacing and uppercase. The smaller the label, the wider the tracking.

---

## 5. Shape and depth

### Radii (by frequency of use)

| Value | Applied to |
|---|---|
| `999px` | Badges, pills, toggles, stat chips — the most-used radius |
| `50%` | Avatars, status dots |
| `14px` | Cards, panels |
| `12px` | Rows, tiles |
| `10px` | Inputs, primary buttons |
| `9px` | Menu items |
| `8px` | Small chips |
| `6px` | Inline tags |

### Shadows

**The single most important detail in this system:** every shadow is tinted with the brand blue — `rgba(2,42,58,…)` — never plain black. That is what makes the interface feel considered rather than default.

```css
0 1px 4px  rgba(2,42,58,0.06)   /* subtle */
0 2px 10px rgba(2,42,58,0.08)   /* card */
0 4px 20px rgba(2,42,58,0.18)   /* sticky header */
0 8px 24px rgba(2,42,58,0.18)   /* raised */
0 8px 20px rgba(2,42,58,0.25)   /* button hover */
0 0 0 3px  rgba(2,42,58,0.08)   /* focus ring */
0 40px 90px -30px rgba(2,42,58,0.55), 0 0 0 1px rgba(255,255,255,0.06)  /* modal */
```

---

## 6. Motion

```css
transition: background .15s ease, box-shadow .15s ease, transform .15s ease, border-color .15s ease;
```

| Context | Duration / easing |
|---|---|
| Buttons, links, hovers (default) | `0.15s ease` |
| Cards and larger surfaces | `0.2s ease` |
| Fade / reveal | `0.35s ease` |
| Panel slide | `0.7s cubic-bezier(.77,0,.18,1)` |

Hover lift is always `transform: translateY(-1px)`. Never more.

---

## 7. Component recipes

### Primary button

```css
.btn-primary{
  font-family:var(--font-display); font-weight:600; font-size:13.5px;
  letter-spacing:0.01em;
  background:var(--brand); color:var(--white);
  border:none; border-radius:var(--r-sm);
  padding:12px 18px; cursor:pointer;
  transition:background .15s ease, box-shadow .15s ease, transform .15s ease;
}
.btn-primary:hover{
  background:var(--brand-hover);
  box-shadow:var(--sh-hover);
  transform:translateY(-1px);
}
```

### Ghost button

```css
.btn-ghost{
  font-family:var(--font-display); font-weight:600; font-size:13.5px;
  background:var(--panel); color:var(--brand);
  border:1px solid var(--line); border-radius:var(--r-sm);
  padding:12px 18px; cursor:pointer;
  transition:background .15s ease, border-color .15s ease, transform .15s ease;
}
.btn-ghost:hover{
  background:var(--line-soft);
  border-color:var(--brand);
  transform:translateY(-1px);
}
```

### Accent (AI) button

```css
.btn-accent{
  font-family:var(--font-display); font-weight:700; font-size:12px;
  letter-spacing:0.04em;
  background:var(--accent); color:var(--brand);
  border:none; border-radius:var(--r-sm);
  padding:12px 18px; cursor:pointer;
}
.btn-accent:hover{ background:var(--accent-hover); }
```

### Field label

```css
.field-label{
  display:block;
  font-family:var(--font-display); font-weight:600; font-size:11px;
  letter-spacing:0.06em; text-transform:uppercase;
  color:var(--text-muted);
}
```

### Input

```css
.field-input{
  font-family:var(--font-body); font-size:14px; color:var(--black);
  background:var(--white);
  border:1px solid var(--line); border-radius:var(--r-sm);
  padding:11px 13px; width:100%;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.field-input:focus{
  outline:none;
  border-color:var(--brand);
  box-shadow:var(--sh-focus);
}
```

### Badge / pill

```css
.badge{
  font-family:var(--font-body); font-weight:700; font-size:11px;
  background:var(--accent); color:var(--brand);
  border-radius:var(--r-pill);
  padding:2px 8px; min-width:18px; text-align:center;
}
```

---

## 8. Layout conventions

- **Header:** sticky, `background:var(--brand)`, `padding:16px 28px`, shadow `0 4px 20px rgba(2,42,58,0.18)`.
- **Main content:** `padding:24px 32px 64px`.
- **Sidebar:** dark ground; text uses `rgba(255,255,255,0.72)` for normal, `rgba(255,255,255,0.35)` for disabled, and white fills at `0.04`–`0.14` alpha for backgrounds and hovers.
- **Body ground:** white. Cards sit on white with a `--panel` or bordered treatment, not on a grey page.

---

## 9. Known limitations

**No dark mode.** The system is light-ground only. Dark surfaces (`--brand`) are used as accents — header and sidebar — not as an alternative theme. Building dark mode means designing it from scratch, not inverting these tokens.

**Hardcoded hexes.** Ten colours listed in section 2 have no variable and are spread across four CSS files. Section 3 fixes this; use that block rather than copying the raw values.

**No spacing scale.** Padding and gap values are chosen per component (`6px`, `8px`, `10px`, `12px`, `14px`, `18px`, `22px`, `28px`, `32px`). They cluster sensibly but are not formalised. A new project should define `--space-1` through `--space-8` up front.
