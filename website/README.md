# SmartMove website

Next.js 16, Tailwind and shadcn UI for public trip search and passenger bookings. Oracle stores accounts, trips, bookings, tickets, refunds and feedback status. MongoDB stores feedback content and the passenger notification inbox. The home page's featured routes and announcement remain labelled sample content.

## Local Oracle setup

**Verified local update (2026-10-07):** The MongoDB driver installation is repaired and `12_simplify_existing_web.sql` has been applied to the existing XEPDB1 schema after taking data/source backups and a completed native Oracle Data Pump export. The website supplies numeric IDs and uses the base coursework payment/refund/trip procedures. Ownership checks, full refunds, short transaction locks and the 30-minute hold limit remain. Login storage has since moved to browser tokens, as described below. All installed objects compile as valid.

The current local database is already upgraded: do not rerun migration 12. For another existing database with the original migrations, stop website requests, take a live-data backup, and apply `../database/database/oracle/12_simplify_existing_web.sql` once as SYSDBA in XEPDB1. Fresh installations use 09, 10 and 11 and skip 12. The shared `web_operations.sql` is included automatically. DDL cannot be rolled back.

The previously recorded `XEPDB1` setup has the original one-time migrations `../database/database/oracle/09_web_integration.sql`, `10_passenger_portal.sql`, and `11_admin_workspace.sql` applied. The simplified migration 11 creates the admin login view and grants access to coursework routines; the website coordinates finance and trip-cancellation transactions. The `SMARTMOVE_DATABASE_APP` user was created separately with a random password. Credentials are in the ignored `.env.local` file:

```text
ORACLE_USER=SMARTMOVE_DATABASE_APP
ORACLE_PASSWORD=<local generated password>
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=smartmove
AUTH_TOKEN_SECRET=<base64-encoded 32 random bytes>
NOTIFICATIONS_START_AT=<ISO timestamp with timezone>
```

For another database, create a dedicated `SMARTMOVE_DATABASE_APP` user with a new password in `XEPDB1`, apply migrations 09, 10, then 11 as SYSDBA after the base SmartMove schema, then set the environment variables. These are one-time scripts; do not rerun them on this database. Oracle and MongoDB services must be running. Never commit `.env.local` or use the example passwords in the coursework scripts.

For the admin Reports section, apply `../database/database/oracle/13_admin_report_permissions.sql` as SYSDBA to grant the website account access to all five existing report procedures. This grant-only script can be reapplied without recreating tables or sample data.

Working ADMIN and passenger demonstration accounts are stored in the ignored `.env.demo.local`. `node scripts/setup-demo.mjs` creates them using scrypt hashes and supplies daily Colombo–Kandy and Colombo–Galle trips for the next fourteen days. Existing accounts/passwords and historical bookings are retained; rerunning the utility verifies the saved accounts and skips matching trips. It uses owner credentials from `../database/.env.smartmove.local`. Public signup creates passengers only. Both roles use `/login`, then go to `/admin` or `/dashboard`.

## Browser authentication and existing installations

Oracle now contains only the 13 core business tables. `web_sessions`, `web_admin_sessions`, and `web_notification_baseline` are no longer created by fresh-install scripts 09-11. Login views and procedures remain in Oracle. No MongoDB session collection is used.

Set `AUTH_TOKEN_SECRET` to 32 cryptographically random bytes encoded in base64. Generate it once using `node -p "require('node:crypto').randomBytes(32).toString('base64')"`. Set `NOTIFICATIONS_START_AT` once to an ISO timestamp including its timezone, such as the output of `node -p "new Date().toISOString()"`. These are server-only settings in ignored `.env.local`; never prefix them with `NEXT_PUBLIC_`, commit the secret, or regenerate either value during normal restarts. Rotating the secret invalidates all existing tokens. A missing or invalid notification cutoff stops reconciliation rather than backfilling historical alerts.

Login/signup responses contain `token` and `expiresAt` plus the existing identity/destination fields. The browser stores only those two values under `smartmove_auth`. Same-origin API requests use `Authorization: Bearer <token>`. The server verifies HS256, issuer, audience, issue time, and a fixed seven-day expiry, then looks up the current Oracle user and role. Cookies are no longer accepted for authentication. Admin and passenger pages wait for `/api/auth/me` before loading protected content.

Logout and expiry clear browser storage and update other open tabs. Service outages retain the stored login. Logout cannot revoke a copied token before expiry; localStorage tokens are accessible to JavaScript. Existing cookie sessions must sign in again after migration.

For an existing local installation, run from `website`:

```powershell
node scripts/migrate-browser-auth.mjs --prepare
node --env-file=.env.local scripts/verify-browser-auth.mjs
node scripts/migrate-browser-auth.mjs --apply "<backup directory printed by --prepare>"
node --env-file=.env.local scripts/verify-browser-auth.mjs
```

`--prepare` backs up all three support tables, their definitions, explicit indexes and grants to ignored `database/backups/`, records counts for all core tables, copies the existing cutoff to configuration, and generates a signing secret only if missing. `--apply` checks that configuration and the core counts still match the backup, verifies token signing, executes the three drops from `14_remove_web_support_tables.sql`, and checks the 13 remaining table names and unchanged core counts. DDL commits immediately. Do not rerun setup, sample data, or migration 12. Fresh installations skip 14.

The current local installation has completed migration 14 with its existing notification cutoff and all core row counts preserved. Its support-table backup and migration receipt remain under ignored `database/backups/before-browser-auth-1792033428327/`.

`node --env-file=.env.local scripts/verify-browser-auth.mjs` checks real signup/login/me handlers, role isolation, booking ownership, JWT tampering/expiry, localStorage persistence and logout events, and notification cutoff behavior. SQL fixtures are rolled back. Browser storage/events are simulated; this does not start or inspect a browser.

## Current workflow

- `/` searches by origin, destination and date. `/trips` shows matching scheduled trips and filters by departure time, fare and seats needed.
- `/trips/[id]` shows route and vehicle details, available seats and a fare summary. One booking can reserve multiple seats atomically.
- `/signup` and `/login` create and authenticate passenger accounts. The server returns a signed seven-day token stored in browser localStorage. Protected API requests send it as a bearer token; passwords and profile data are not stored in localStorage.
- `/dashboard` is the default after login. It shows the next trip, pending reservations, bookings, tickets, completed trips, refunds and notifications.
- `/bookings` and `/bookings/[id]` show reservations, ticket links and whole-booking cancellation before departure. `/tickets/[id]` shows a passenger's own issued ticket.
- `/feedback` accepts one review per confirmed booking on a completed trip, or a complaint linked to any owned booking. Oracle stores type and status; MongoDB stores text, ratings and staff replies. This phase displays replies but has no staff reply UI.
- `/profile` lets passengers change their name and phone; email is read-only. The notification inbox supports read/unread state and reconciles newer Oracle booking/refund events when opened; there are no push updates.
- `/admin` is the single ADMIN workspace. It has live summary cards and guarded forms for routes, trips, vehicles, drivers, passengers, maintenance, bookings, payments, and eligible full refunds. Tickets follow booking/payment actions. Feedback is read-only. There are no separate staff role screens, admin user management, or standalone report pages.
- Its Reports section executes `popular_routes`, `revenue`, `passenger_history`, `maintenance_due`, and `trip_occupancy` from `04_reports.sql`. Previews and CSV exports read each procedure's `DBMS_OUTPUT` on the same connection; there are no separate report `SELECT` queries in the website. Passenger history requires a passenger ID, and maintenance uses the selected due date. Table columns match the fields printed by the procedures.
- Admins manage passenger announcements in MongoDB as drafts, published notices, or archived notices. The public home reads published notices; the old sample document remains visible as sample content.

A new booking is **PENDING**. Seats are held for 30 minutes. Availability and payment checks ignore expired holds without a background scheduler. Expired reservations appear cancelled in the website; their stored Oracle status is not automatically rewritten. The base `record_payment` procedure confirms a paid booking and issues its tickets when an admin records full payment; no external online payment gateway is connected. Booking confirmation and issued tickets are never shown as paid before that procedure runs.

Cancellation releases every seat in the booking. For a paid booking, Oracle records one full refund in the cancellation transaction. **“Refund recorded” means a database record exists; any actual payout happens outside SmartMove.**

`node scripts/verify-finalization.mjs` runs the real TypeScript login/signup/search/booking and ADMIN query handlers against Oracle without a server. Thirteen check groups cover credentials, role separation, all ADMIN resources, future search, multi-seat booking, payment, cancellation and duplicate-refund prevention. Commits are suppressed on a single test connection and all test SQL is rolled back; it is not a browser or HTTP-server test.

`node --env-file=.env.local scripts/verify-admin-workflows.mjs` checks the current admin save, delete, scheduling, payment, cancellation, refund, and announcement handlers. It verifies that procedure validation messages reach the forms instead of appearing as server outages. Oracle commits are suppressed and test rows roll back; the temporary private MongoDB announcement is removed. The maintenance date picker blocks past dates, and database procedures still enforce scheduling conflicts and record-state restrictions.

The older Oracle rollback/concurrency scripts remain in `../database/database/oracle/tests/`, but assume trip 2 is future-dated. That historical trip has departed, so those fixtures need revision. The old `test-passenger-mongo.mjs`, `test-admin-queries.mjs`, `test-admin-announcements.mjs` and `test-admin-workflows.mjs` utilities are absent from this checkout and were not restored in this selected scope.

Admins can select **Images** in Vehicles or Trip schedules to upload JPG, PNG or WebP photos (up to 5 MB each), add a caption, preview photos, or remove them. Images are decoded, resized, and stored as WebP files in MongoDB GridFS (`media_files.files` and `media_files.chunks`); links and captions are kept in `vehicle_assets` or `trip_media` using the corresponding Oracle ID. The passenger trip page shows the trip's photos and its assigned vehicle's photos. Upload and removal require an admin session.

Demo media remains in `public/uploads/`: two generated illustrations and a fictional vehicle record PDF. Existing MongoDB `/uploads/` image links also appear in the galleries. Vehicle documents are retained separately; the upload screen accepts images only.

`node --env-file=.env.local scripts/verify-admin-media.mjs` checks the real image handlers without a server: admin permissions, file validation and size limits, GridFS storage/downloads, resized images, passenger galleries, and removal. Its Oracle transaction rolls back and temporary MongoDB files and metadata are removed.

The project `AGENTS.md` asks not to start a development server or run a build unless explicitly requested. Typecheck and targeted lint are available through `npm run typecheck` and `npx eslint <paths>`.

## Backups and verification

`node scripts/backup-databases.mjs` takes consistent Oracle data/metadata/source snapshots and a MongoDB Extended JSON snapshot including indexes. `../database/backups/latest-finalization.txt` points to the pre-upgrade directory, which also contains the completed native Oracle Data Pump dump, export log and original presentation/source. Checksums were verified. A separate database restore has not been tested.

Typecheck and lint pass. The thirteen rollback-only verification groups and media-reference checks passed. See `../FINALIZATION_STATUS.md` for the detailed scope and remaining work. No build or development server was run.
