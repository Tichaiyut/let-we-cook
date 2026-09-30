# Let We Cook — notes for AI assistants

Team task tracker for the 4-person TechFeed team. React 19 + Vite static site on GitHub Pages; data in a Google Sheet behind a Google Apps Script web app (`apps-script/Code.gs`). The owner communicates in Thai; UI copy is English kitchen vocabulary with Thai microcopy.

## Product decisions (confirmed with the owner)

- **Kitchen theme only.** There is no "normal" mode. UI terms: Menu (Epic) → Course (Story) → Food Piece (Task) / Kitchen Issue (Bug). Stations: Ready to Prep (To Do), Cooking (In Progress), Served (Done); Pantry = Backlog; Heat = Priority. Keep the underlying data model in Epic/Story/Task/Bug terms.
- Exactly three board stations. Backlog lives in the Pantry tab. Legacy "Review" maps to In Progress.
- Every work item belongs to a Menu and a Course. IDs are `MENU-COURSE-T0001` / `B0001` (3-letter codes). New Menus/Courses are created inside the create form; nothing is pre-seeded.
- Priority is always computed from the due date (≤7 days or overdue Urgent, ≤14 High, ≤30 Medium, else Low; Done → Done). Never trust a stored priority.
- Today's menu (Daily Plan) copies tickets; it never moves them. Planning requires choosing a chef; the chef filter and the plan's chef stay in sync. Plans load back from the sheet per chef + date.
- Each station shows exactly five complete 124px tickets (+ 7px gaps = 648px body); the rest scroll inside the station. Sort oldest due date first, undated last.
- Crew: Arparat = Saint - Chan (Data Provider), Tichaiyut = Topu - Kun (Data Scientist), Chonlasit = Bon - Kun (AI Engineer), Sorawee = Ing - Kun (Web Developer). **Never use real face photos** — the repo is public. Character art is configured in `src/team.js`.
- Former members and "Dev Team" are not shown. Only `Active = TRUE` people from the People sheet appear.
- Old data from the original "Tech Feed Development" sheet was intentionally **not** migrated; the new sheet started empty.
- Menu / Course codes are suggested automatically from the name (`src/lib/codes.js`) and stay editable.
- **Delete is soft** ("ทิ้งจาน" → Bin tab): `Deleted`/`DeletedAt`/`DeletedBy` columns on Work Items, added automatically by `ensureColumns_`. Undo toast + restore from the Bin. No hard delete in the UI.
- **IDs are never reused.** `nextItemNumber_` scans Work Items plus the Activity Log (WorkItemID/FromValue/ToValue).
- Editing can change everything; changing course or Task↔Bug re-IDs the ticket and moves its Task Assignees and Daily Plans references (logged as "Moved").
- Never ask the user to edit sheet headers by hand; Code.gs reads columns by header name.

## Auth model (in Code.gs, API 2.2)

- **Each chef has a 4-digit PIN.** First visit: pick your name → team password → choose PIN (`setupPin`). Obvious PINs (0000, 1234…) are rejected. The owner resets a forgotten PIN from the sheet menu (`resetChefPin`); there is deliberately no self-service reset.
- **The team password is a backup login** that acts as `team`: full task access, but Today's menu is read-only. It is also the proof of team membership when setting a first PIN.
- Secrets are salted + iterated HMAC-SHA256 in Script Properties (`PASSWORD_*`, `PIN_HASH_<id>`, `PIN_SALT_<id>`, `PIN_VER_<id>`). Changing the team password rotates `TOKEN_SECRET` (everyone out); changing/resetting a PIN bumps that chef's `PIN_VER` (only they are signed out).
- Token = `expires.who.pinVersion.nonce.hmac`, 2-hour expiry, sent in the POST body. **The server takes the actor from the token** — never from the request body.
- All requests are `text/plain` POSTs so Apps Script CORS works without preflight. `roster`, `login`, `chefLogin`, `setupPin` are the only unauthenticated actions.
- Apps Script cannot see client IPs: 5 wrong PINs lock **that chef** for 2h (any device); 5 wrong team passwords lock a browser (`clientId`); 20 failures site-wide in 10 min pause all logins for 15 min (CacheService).
- Today's menu: anyone signed in can read any chef's plan; only that chef can save it.
- `safeCell_` prefixes `'` to text starting with `= + - @` to stop formula injection.

## Working on it

- `npm run dev` uses in-browser sample data (`src/sampleKitchen.js`) and skips login. `VITE_USE_LIVE_API=true` (+ optional `VITE_API_URL`) talks to a real API.
- `npm test` runs `tests/*.test.mjs`, including `tests/apps-script.test.mjs`, which executes the real `Code.gs` in a Node `vm` with fake Google services. Update those fakes when Code.gs starts using a new service.
- Keep `api.js` (live) and `sampleKitchen.js` (dev) response shapes identical.
- `.github/workflows/deploy.yml` tests, builds and deploys `dist/` to GitHub Pages on every push to `main`. `vite.config.mjs` uses `base: "./"` so the same build also works on any static host.
- After editing `Code.gs`, the owner must paste it into the Apps Script editor and publish a new version of the existing deployment (same `/exec` URL).
