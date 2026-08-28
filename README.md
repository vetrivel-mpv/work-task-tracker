# Northstar Delivery

A local, offline operations board for **client delivery and the team that
runs it**. Daily work, standup, Azure DevOps sync, release testing, and
one-click status emails. No build tools, no dependencies, no account, no
cloud — everything is saved in this browser's `localStorage` on this
machine only.

The UI is a restrained product surface: deep teal accent, quiet elevation, a
full-width section nav, and floating modals/popovers for New Task, Reports,
roster editing, priority, and assignee search — usable with a small team
or a large one (100+ people).

## Project structure

```
work-task-tracker/
├── index.html       # page structure
├── css/
│   └── styles.css   # all styling
├── js/
│   ├── app.js        # entry point — owns state, wires DOM events to actions
│   ├── state.js       # constants, date helpers, initial state shape
│   ├── storage.js      # localStorage persistence (tasks + settings + team)
│   ├── tasks.js         # task list mutations (add/status/move/blueprint/carry-forward/assign)
│   ├── team.js           # team roster management (add/remove teammates)
│   ├── groups.js          # group management (bundle teammates, assign as a unit)
│   ├── standup.js          # per-day standup notes (blockers/questions per person)
│   ├── email.js              # "Daily Update" email draft + validation
│   ├── standupEmail.js        # "Daily Standup" email draft, addressed to the team
│   ├── backup.js                # export/import a JSON snapshot of all local data
│   └── render.js                 # DOM rendering
├── start.bat         # Windows: double-click to run (no installs needed)
├── start.ps1         # the actual server start.bat runs, in case you want to read/edit it
├── dev-server.py     # Mac/Linux: python3 dev-server.py — same as http.server, but caching-disabled
├── LICENSE
└── README.md
```

`js/app.js` is loaded as an ES module (`<script type="module">`), so the
other files under `js/` use native `import`/`export` — no bundler needed.

## Running it locally

This needs *some* local web server — double-clicking `index.html` directly
doesn't work in most browsers, because it uses ES modules
(`<script type="module">`), which Chrome and others refuse to load over the
`file://` protocol (you'll see a CORS error in the console and a blank
page). Pick whichever of these is easiest; all of them serve the app
identically.

**Windows, no installs — double-click `start.bat`**
Included in this folder. It runs a tiny static file server written in
PowerShell (already built into Windows — nothing to download, so it works
even behind a proxy that blocks `npm`/`pip`). Opens the app in your default
browser automatically at `http://localhost:8000`. Leave the console window
open while you use the app; close it (or Ctrl+C) when you're done.

**VS Code Live Server** (if you have VS Code)
1. Open this folder in VS Code (`File → Open Folder…`).
2. Install the **Live Server** extension (by Ritwick Dey) if you don't have it.
3. Right-click `index.html` → **Open with Live Server**.
4. It opens at `http://127.0.0.1:5500` and auto-reloads when you edit files.

**Python** (Mac/Linux ship with Python; Windows usually needs a one-time install)
```bash
cd work-task-tracker
python3 dev-server.py 8000
```
Then open `http://localhost:8000` in your browser. (Windows: `python` instead of `python3` if `python3` isn't found.) This is the same as plain `python3 -m http.server 8000`, except it also disables browser caching — plain `http.server` sends no cache headers at all, so a browser you've pointed at this app before can keep silently serving an old cached `.js`/`.css` file after you edit it, which looks exactly like your change "didn't take." If you'd rather use the one-liner directly, that works too — just do a hard refresh (Ctrl/Cmd+Shift+R) after every code change to be safe.

**Node, if you have it**
```bash
cd work-task-tracker
npx serve
```
Needs npm to reach the registry the first time, so this won't work behind a
proxy that blocks it — use the Windows launcher or Python instead in that case.

## Data & privacy

All tasks, settings, and your manager's email address are stored in your
browser's `localStorage`, scoped to whatever address you open the app at
(e.g. `http://127.0.0.1:5500` or `http://localhost:8000`). Nothing is sent
anywhere except when you explicitly click **Send Email Update** (opens a
pre-filled draft in your default mail app for you to review and send
yourself) or **Export backup** (downloads a JSON file to your own machine).
Neither ever transmits data to a server — there isn't one.

**One thing to keep in mind:** because storage is scoped to the URL, if you
switch between Live Server and Python's server (different ports) or between
different machines, you won't see the same saved data. Pick one method and
stick with it for continuity.

## Features

- **New Task floating modal** — click **+ New Task** in the header to open
  a floating panel: title, time, a priority dropdown, notes, a searchable
  assignee/group picker, and a Today/Tomorrow target — all in one place,
  instead of a permanently-open inline form.
- **Priority dropdown** — High / Medium / Low shown as full words in a
  small dropdown (colored dot + label), on every task card and in the New
  Task modal — not single-letter chips.
- **Searchable assignee/group picker** — click a task's **+ Assign**
  control to open a floating popover with a search box and a scrollable
  list of teammates and groups. Built to stay usable whether your roster
  has 5 people or 500 — nothing renders as a giant wall of pills.
- **3-state status tracking** — click a task's status circle to cycle
  Not started → Partially complete → Complete, so partial progress doesn't
  get flattened into a binary done/not-done.
- **Per-task notes** — add an optional comment to any task (e.g. "blocked on
  vendor approval") for context that shows up in the Daily Update email.
- **Executive summary bar** — a weighted completion ring (partial credit
  counts as half) plus complete/partial/pending/total counts at a glance.
- **Priority lanes as an accordion** — click a lane (High/Medium/Low) to
  expand it; expanding one collapses the others, so the board stays short
  no matter how many tasks are logged. Each header shows an at-a-glance
  breakdown — open / in progress / closed counts — even while collapsed.
- **People, click to open** — the sidebar shows a compact tile (avatar
  preview + count); click it to open the full roster in a floating modal
  with search, alignment bars, and edit (pencil icon)/remove per person.
  Renamed from "Team" — built this way specifically so a 100+ person
  roster doesn't stretch the sidebar into a giant scroll.
- **Groups, same pattern** — a compact tile that opens a modal for
  creating a group (e.g. "QA Team"), toggling membership, and seeing each
  group's own alignment stats. Assign a task to the whole group in one
  click, for recurring shared work like regression testing.
- **Daily Standup card, one person at a time** — a searchable person
  selector (with ‹ › to step through the roster) shows one teammate's
  update at a time instead of a long flat list. "Yesterday achieved" and
  "Today's tasks" are pulled automatically from the board; you add
  Blockers and Questions, and can **link the note to a specific task** so
  it's clear what a blocker is actually about.
- **Editable tasks** — click the pencil icon on any task to fix a typo or
  adjust its time without losing its comment/assignees/status history.
- **Delete confirmation** — deleting a task is a two-click "arm, then
  confirm" action (matches Clear Day), so a stray click can't silently
  destroy a task.
- **Log a task straight onto tomorrow's board** — the New Task modal has a
  Today/Tomorrow target. Built for capturing what comes out of an
  end-of-day call (e.g. a recurring 9 PM client call): type the
  defect/task, add the note, assign an owner, pick "Tomorrow", and it's
  queued on tomorrow's board without leaving today's view.
- **Date navigation** — step to any prior day, or forward to Tomorrow
  (quick pill) to review what's already queued there.
- **Quick-load blueprint** — one button at the bottom of the board adds a
  combined set of 13 recurring items: the work schedule (team check-in,
  deep work, client call, etc.) and the QA/release-cycle set (QA/Staging/
  Prod Sanity, OPS Ticket, Regression Testing, User Story Testing, Defect
  Validations, Documentation) in one click. Dedupes by title against
  what's already on the board.
- **Reports panel** — a header button opens a floating panel with both
  the **Daily Update Email** (status report to your manager) and the
  **Daily Standup Email** (yesterday/today/blockers/questions to the
  team) in one reachable place, instead of being buried in the page.
- **Export / Import backup** — download a JSON snapshot of everything
  (settings, team, groups, and every day's tasks) from the footer, and
  restore it later or on another machine — your only recovery path, since
  all data otherwise lives only in this browser's `localStorage`.
- **Export / Import CSV** — a lighter, Excel/Sheets-friendly export of just
  the tasks (Date, Time, Title, Priority, Status, Assignees, Groups, Note),
  for reviewing or bulk-editing outside the app. Importing a CSV only adds
  tasks (deduped by same-day title, like the blueprint loader) — it never
  deletes or overwrites, and never touches settings/team/groups. Assignees
  and groups are matched to your roster by name (semicolon-separated for
  more than one), so this is a good way to bulk-add — not the exact
  byte-for-byte restore the JSON backup gives you.

## Customizing

- Edit the `BLUEPRINT_SCHEDULE` / `QA_BLUEPRINT_SCHEDULE` arrays near the
  top of `js/state.js` to match your actual recurring schedule.
- Colors and fonts are CSS custom properties at the top of `css/styles.css`
  (the `:root` block) — change those to re-theme the whole app.
