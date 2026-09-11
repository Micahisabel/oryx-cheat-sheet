# Make.com automation — AI Learning ranking, reminders & monthly report

**Owner:** Business Support · **Status:** design ready, not yet built in Make
**Replaces:** the "scheduled Apps Script job" referenced in code comments — that
script was never actually built. This document is the real spec, targeting
Make.com instead.

## Why this exists

The admin Settings panel (`js/learning-admin.js`) already lets an admin set:
- Monthly report recipient + day of month
- Inactivity threshold (days)
- Reminder cooldown (days)
- Ranking on/off, public leaderboard on/off

Today those settings are saved to Firestore (`adminState/learningReportSettings`)
but **nothing reads them** — no job exists yet. The app's own field comments in
`js/learning.js` (`defaultProgress()`) already reserve the exact fields a
scheduled job is expected to fill in per employee doc (`learningProgress/{uid}`):

| Field | Written by |
|---|---|
| `rankingScore` (0–100) | this job, nightly |
| `rank`, `rankTotal` | this job, nightly |
| `currentAchievements` (array of IDs) | this job, nightly |
| `lastReminderSentAt` (ISO date) | this job, when a reminder is sent |

Nothing else in the app writes these — they're safe for Make to own exclusively.

## One scenario, runs every night

Rather than a fixed monthly schedule (which would need editing inside Make
every time an admin changes "day of month" in the app), the scenario runs
**once every night** and checks the settings doc each time. That's what makes
"changes here take effect on the next scheduled run without redeploying
anything" (the note already shown in the Settings UI) actually true.

```
[Schedule: every day, e.g. 02:00 Asia/Dubai]
        │
        ▼
[Firestore: Get Document] adminState/learningReportSettings
        │
        ▼
[Firestore: List Documents] learningProgress  (all employees)
        │
        ▼
[Iterator] — one pass per employee doc
        │
        ├─▶ [Router branch A] Compute & write rankingScore/rank/achievements
        │
        └─▶ [Router branch B] Inactivity check → send reminder if due
        │
        ▼ (after the iterator finishes — aggregate step)
[Filter] today's day-of-month = settings.reportDay?
        │  yes
        ▼
[Build + send monthly report email] → settings.reportEmail
```

### Connecting Make to Firestore

Make has a native **Google Cloud Firestore** app (Get/List/Create/Update/Delete
Document, Run a Query). It authenticates with a **Google Cloud service account**
key (JSON), not your personal Google login:

1. In Google Cloud Console, open the `oryx-cheat-sheet` Firebase project.
2. IAM & Admin → Service Accounts → Create service account (e.g.
   `make-automation@oryx-cheat-sheet.iam.gserviceaccount.com`).
3. Grant it the **Cloud Datastore User** role (read/write Firestore only —
   nothing else on the project).
4. Create a JSON key for it, download once.
5. In Make, add a Google Cloud Firestore connection using that JSON key.

This key bypasses Firestore security rules (server-side, like the Firebase
Admin SDK does) — that's expected and required for a background job, and is
why it must be scoped to a dedicated service account rather than reusing the
app's public web API key.

### Branch A — ranking score (per employee doc)

Only runs when `settings.rankingEnabled` is true.

Compute from the fields already on each doc — no new employee-facing changes
needed:

- **Progress (30%)** — average % complete across the 5 levels
  (`completedLessons` vs each level's lesson count in `LEARNING_PATHS`).
- **Lesson volume (20%)** — `completedLessons.length` / total lessons (20).
- **Assessment score (20%)** — `assessmentResult.score`.
- **Streak (5%)** — `streak`, capped at 30 days.
- **Consistency (15%, proposed)** — active days in the last 30 vs 30, from
  `activityDates`.
- **Level improvement (10%, proposed)** — levels gained since
  `assessmentHistory[0].level`, from `assessmentHistory`.

> The 15/10 split for the last two factors is **proposed, not confirmed** — the
> code comment only says "25% of the real formula" without a stated split.
> Confirm this weighting before go-live; it's a one-line change in the
> Make formula either way.

After scoring every doc in this run: sort descending, write back per doc:
`rankingScore` (rounded), `rank` (1-based position), `rankTotal` (doc count).

**Achievements** (`currentAchievements`, proposed criteria — confirm before
go-live):
- `champion` — rank 1
- `most_improved` — largest `rankingScore` increase vs the value stored on the
  doc before this run (read old value first, compare, then overwrite)
- `consistency_award` — highest consistency factor this run
- `rising_star` — most level improvement this run

### Branch B — inactivity reminder (per employee doc)

Only runs when `settings.rankingEnabled` doesn't gate this — reminders are
independent of ranking.

1. `daysSinceActive = today − lastActiveDate`
2. Skip if `daysSinceActive < settings.inactivityThresholdDays`
3. Skip if `lastReminderSentAt` is set and
   `today − lastReminderSentAt < settings.reminderFrequencyDays` (the cooldown)
4. Otherwise: send a plain, friendly reminder email to `userEmail` (mirrored
   on the doc already), then write `lastReminderSentAt = today` on that doc.

Reminder email — short, no guilt-tripping, one clear next step:

> Subject: Pick up where you left off in AI Learning
>
> Hi [userName or first part of email],
>
> You've got AI Learning lessons waiting in the Knowledge Hub. It only takes a
> few minutes to continue.
>
> [Link to the Hub]
>
> Kind regards,
> Oryx Business Support

### Aggregate step — monthly report

Runs once per scenario execution (not per employee), gated on
`today.getDate() === settings.reportDay`.

Build a table (Make's "Create an array" + a Gmail/Outlook HTML email, or a
Google Sheets row-per-employee export attached as a link) with, per employee:
`userName`/`userEmail`, `currentLevel`, `rankingScore`, `rank`, streak, days
since active, badge count. Email it to `settings.reportEmail`
(`lharyl@oryxdoors.com` today).

## Public leaderboard write step (front-end already built)

The employee-facing "Leaderboard" tab (in `js/learning.js`) is already built
and reads `adminState/publicLeaderboard`. It shows nothing until this
scenario writes that document, so add this as a step right after Branch A
(ranking) finishes for every employee, once per run:

1. Sort all employees by the `rankingScore` just computed, descending.
2. Take the top 10.
3. Write to `adminState/publicLeaderboard`:
   ```json
   {
     "visible": <settings.leaderboardVisible>,
     "updatedAt": "<today, ISO>",
     "entries": [
       { "uid": "<doc id>", "name": "<userName or displayNameFromEmail(userEmail)>", "score": <rankingScore> }
     ]
   }
   ```
4. If `settings.leaderboardVisible` is false, still write the document but
   with `"visible": false` (and entries can be left as-is or emptied) — the
   app tab hides itself whenever `visible` is false, so this one flag is the
   entire on/off switch for staff. No redeploy needed when an admin toggles it.

Only `uid`, `name`, and `score` for the top 10 go in this document — never
the full `learningProgress` collection. That's what keeps this safe to open
up to every signed-in employee (see the Firestore rule below), instead of
loosening access to everyone's full learning record.

### New Firestore rule (add in the Firebase console — not this repo)

Add alongside the existing `learningProgress`/`adminState` rules:

```
match /adminState/publicLeaderboard {
  allow read: if request.auth != null;
  allow write: if false; // only the Make service account (via the Admin SDK) writes this, which bypasses rules entirely
}
```

This does **not** loosen access to the rest of `adminState` (settings, other
admin-only docs stay admin-only) — it's scoped to this one document.

## What this build does **not** cover (already tracked separately)

- **Firestore rule tightening** (task #47) — restricting who can write
  `rankingScore`/`rank`/`currentAchievements`/`lastReminderSentAt` so only the
  service account (which bypasses rules entirely) can set them, and the
  Firebase web SDK client can never overwrite its own ranking.

## Rollout checklist

1. Create the Google Cloud service account (above) — **you'll need to do this
   step yourself**, since it means creating credentials in your Google Cloud
   account.
2. Build the scenario in Make using this doc as the spec.
3. Point it at Firestore project `oryx-cheat-sheet`, collections
   `adminState` and `learningProgress`.
4. Run it once manually against production data, then check in the admin
   dashboard that a couple of employee rows show a real (non-estimated)
   score, rank, and reminder timestamp.
5. Turn on the nightly schedule.
6. Confirm the monthly report lands in `lharyl@oryxdoors.com`'s inbox on the
   configured day.
