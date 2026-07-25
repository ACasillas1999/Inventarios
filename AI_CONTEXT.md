# AI Context Log

Shared handoff notes for any AI tool editing this project. Capped at 10 entries, most recent first.

## 2026-07-23 — Antigravity (Gemini 3.5 Flash)
Styled management modal-headers in BulkRequestsView.vue to transition background colors/accents per status, matching RequestsView.vue.
Replaced raw window.open image clicks with a premium overlay preview modal in both RequestsView.vue and BulkRequestsView.vue chats (fixed modal nesting so it renders properly outside active parent overlays).
Added all available filters (statuses checkboxes, branch selection, priority selection, limit input, and offset pagination) to the upper section of BulkRequestsView.vue, matching RequestsView.vue layout and responsive designs.
Added index-friendly date range filters (Fecha Desde and Fecha Hasta) end-to-end (Frontend template/state -> API client -> Express Controllers -> MySQL/MariaDB queries) for both Differences (RequestsView.vue) and Bulk Differences (BulkRequestsView.vue).
Optimized CSS layout, padding, font-sizes, and heights inside .filters block in both Views, applying a custom column grid distribution on desktop to make all filters (including Limite) fit beautifully on a single row.
Added Month and Year select filters to CountsDashboardView.vue, defaulting to the current month and year. Updated backend getDashboardStats queries in CountsService.ts to dynamically apply YEAR and MONTH filters on counts and left joins.

## 2026-07-23 — Claude Code (Sonnet 5)
Built "Diferencias masivas" (bulk_requests) module end-to-end: create form, status workflow, chat with attachments (also added to legacy Diferencias chat), in-app notification bell, per-file download tracking, status history timeline. All mirrors existing Diferencias patterns.

Gotchas:
- No migration runner in this repo — all DDL runs from inline `try/catch` blocks in `inventarios-backend/src/app.ts` `initializeDatabases()`, executed every startup. **Each independent ALTER/CREATE must be in its OWN try/catch** — learned this the hard way when `request_comments` (table never actually existed in this DB despite `commentsController.ts` referencing it) threw and silently skipped a second ALTER bundled in the same try block.
- Backend DB is MariaDB (not MySQL) at 192.168.60.117; `ADD COLUMN IF NOT EXISTS` works fine on it.
- Frontend axios instance defaults `Content-Type: application/json`; posting `FormData` needs `headers: {'Content-Type': undefined}` per-request or axios serializes it wrong instead of letting the browser set the multipart boundary.
- This sandbox's Bash tool can't `cd` into the project's UNC path (`\\192.168.60.117\...`) — use the PowerShell tool, and call `node .\node_modules\<pkg>\bin\...` directly instead of `npx`/`npm run` (those `.cmd` shims fail on UNC cwd too).

Scope agreed with user: chat attachments = 1 file/message max, text optional if a file is attached; file-download tracking only covers `bulk_request_files` (not chat attachments).

Pre-existing, not touched: `UsersView.vue` has 2 unrelated TS7006 errors (implicit `any` on `s` in `.some()` callbacks).
