# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Confirmed product direction

- Recreate selected single-page visual option 2 from the latest ideation set.
- Use no sidebar. Keep the approved filter row and summary strip, then show a compact monthly task timeline.
- Below the timeline, use Board and Backlog tabs. The Board contains a Today Plan panel on the left and a three-column Kanban on the right.
- Use exactly three Kanban states: To Do, In Progress, and Done. Backlog is a separate table tab. Do not include an In Review state anywhere; map historical Review tasks to In Progress.
- Today Plan copies tasks from Kanban without removing the source task. The current user is selected from chonlasit, sorawee, tichaiyut, and arparat.
- Use the four user-supplied chef portraits for current team members only: Arparat, Tichaiyut, Chonlasit, then Sorawee. Preserve former team member names in historical tasks with neutral blank placeholders.
- Compute priority automatically from Due date: Low > 30 days, Medium 15–30 days, High 8–14 days, Urgent 0–7 days (overdue remains Urgent with an overdue label).
- Give every project a stable color across the timeline, Kanban cards, Today Plan, and Create Task modal.
- Keep the kitchen theme restrained to brand and Today Plan microcopy. The product must remain unmistakably a task tracker.
- Load live tasks from the existing Google Apps Script through the local read-only PHP endpoint. Do not send POST, PATCH, PUT, or DELETE requests.
- Until a new Google Sheet and Apps Script are created, save Daily Plan entries and locally created tasks only in the browser. Never modify the original sheet.
- Display current team names as Chonlasit, Sorawee, Tichaiyut, and Arparat. Keep former members in filters but visually de-emphasize them.
- The header contains only the live date and Create Task action; user selection belongs only in Today Plan.
- Use four top filters in this order: Project, Assignee, Status, and Priority.
- Today Plan defaults to All. While All is selected, show all Kanban tasks but disable planning. Selecting a current member filters Kanban to that member and enables copy-to-plan.
- Timeline must be a non-overlapping Gantt: one task per row with start/end dates, internal vertical scrolling, and horizontal scrolling across months.
- Timeline should expose about seven task rows at once and always provide its own vertical scrollbar. Sort current-month and future tasks above older work; keep past tasks below with only a 20% gray/fade treatment so project colors remain legible.
- Today Plan notes grow vertically as text wraps. All three Kanban columns must expose every task through independent vertical scrolling.
- Lock the Kanban wrapper, each column, and each column body directly so browser/grid sizing cannot expand them. The body must fit exactly five complete 124 px task cards plus four 7 px gaps (648 px); never reveal a partial sixth card. Remaining tasks use the column's independent vertical scrollbar. Each board status must include every matching task across past and future due dates, sorted oldest to newest; undated tasks come last.
- Keep all Kanban card metadata visible inside the fixed 124 px card: task key, issue type, Epic/Story breadcrumb, up to two title lines, assignee, created/due dates, Today action, priority, and overdue state. Use explicit grid rows rather than clipping overflowing content.
- Treat every legacy `Project` value as an `Epic`. Normalize all legacy rows to `Issue Type = Task`, `Story = null`, and `Parent ID = null` without writing those changes back to the original Google Sheet.
- Use the hierarchy `Workspace → Epic → Story → Task/Bug`. In this product, Story means a feature or component inside an Epic, such as Performance Dashboard or the farming data-entry screen.
- Show `Unassigned story` for null Story values and expose it as a Story filter option. New locally created Task/Bug items must choose an Epic and either an existing Story or create a new Story name in the same form.
- Kanban cards show Issue Type plus the `Epic › Story` breadcrumb. Keep exactly five complete cards visible per column after accommodating this hierarchy metadata; remaining cards scroll independently.

Kitchen mode is the selected visual direction. Display `Menu → Course → Food Piece / Kitchen Issue` while preserving the underlying `Epic → Story → Task / Bug` data model.

- Brand: Let We Cook. Timeline navigation is quarter-based with previous/next controls.
- The Create Task modal always shows Epic (Menu) → Story (Course) → Task (Food Piece) + Bug (Kitchen Issue).
- Kitchen mode includes Home and Character pages. Character cards use the supplied portraits and identities: Arparat = Saint - Chan (Data Provider), Chonlasit = Bon - Kun (AI Engineer), Sorawee = Ing - Kun (Web Developer), and Tichaiyut = Topu - Kun (Data Scientist).

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
