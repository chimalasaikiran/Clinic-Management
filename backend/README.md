# ClinicOS backend

REST API for ClinicOS: accounts, sign-in sessions, organisations, roles, permissions, members and invitations.
NestJS 11 · TypeScript · Prisma ORM 7 · Neon serverless PostgreSQL. No Docker and no local database.

The admin panel (`../admin-panel`) is a separate app that talks to this API over versioned REST (`/v1/...`).

---

## 1. Folder structure

```
backend/
  backend.env.example        configuration template (copy to backend.env, which is git-ignored)
  prisma.config.ts           Prisma CLI settings: schema path, migrations path, DIRECT_URL for migrations
  prisma/
    schema.prisma            database models, enums, relations, indexes, unique constraints
    migrations/              SQL migrations, applied in order by `prisma migrate deploy` (commit these)
  src/
    main.ts                  starts the HTTP server
    app.module.ts            wires the feature modules and the global guards
    app.factory.ts           HTTP hardening: headers, CORS, rate limit, cookies, CSRF check, logging
    config/                  environment validation (fails fast on missing or unsafe settings)
    database/                Prisma client (one connection pool per process), transaction helper
    generated/prisma/        generated Prisma client (created by `prisma generate`, git-ignored)
    common/
      errors/                AppError and the global error filter (one response envelope)
      validation/            Zod helpers and shared field rules (email, password, name, code)
      middleware/            request id + no-store, Origin check (CSRF)
      security/              Postgres-backed rate limiter shared by all instances
      audit/                 append-only audit log
      mail/                  email sending (EmailJS or SMTP, or the console in development)
      decorators/, utils/    request context, crypto helpers
    modules/
      auth/                  register, login, logout, sessions, verification codes, password reset/change
      users/                 user repository and profile endpoints
      permissions/           permission catalogue, access calculation, AccessGuard, permission decorators
      roles/                 role CRUD with grant rules and optimistic locking, default role templates
      organisations/         clinic creation (onboarding) and branches
      members/               organisation members, role assignment, suspension
      invitations/           staff invitations and acceptance
      patients/              patient master records: registration, search, editing, status, duplicates
      scheduling/            therapists, weekly availability, slot generation, care scope, clinic time
      appointments/          booking, lifecycle (confirm, check-in, start, complete, cancel, no-show, reschedule)
      staff/                 staff records, branch assignments, login invitations, attendance, leave and blocks
      clinical/              encounters (SOAP, signing), vitals, diagnoses, allergies, safety alerts, notes, worklist,
                             prescriptions, diagnostic orders and results, referrals, care plans, incident reports
      billing/               service catalogue and prices, billing settings, charges, invoices, payments and
                             allocations, receipts, refunds, statement import and reconciliation, the finance ledger
      health/                liveness and readiness probes
  test/
    unit/                    no database needed (`npm test`)
    integration/             full flows against a separate Neon test branch (`npm run test:integration`)
```

Every feature module has the same layers, and they stay separate:

| Layer | File | Does | Never does |
| --- | --- | --- | --- |
| Controller | `*.controller.ts` | HTTP: route, validate input with Zod, call the service, set cookies | business rules, database access |
| Service | `*.service.ts` | business rules, transactions, audit entries | parse HTTP, write SQL |
| Repository | `*.repository.ts` | Prisma queries | business decisions |
| Schemas | `*.schemas.ts` | request validation rules | |

### Adding a new module (for example `patients`)

1. Add models to `prisma/schema.prisma`, then `npm run db:migrate:dev -- --name add_patients` (see section 4).
2. Create `src/modules/patients/` with `patients.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.schemas.ts`.
3. Use `@Controller({ path: 'patients', version: '1' })` and protect each route with `@RequirePermissions('patients.view')`.
   Every route already needs a signed-in, verified user; `@Public()` is the only way out.
4. New permission ids go in `src/modules/permissions/permission-catalogue.ts` **and** the web app's
   `admin-panel/src/features/role-management/data/roles.js`. A unit test fails if the two differ.
5. Add the module to `imports` in `src/app.module.ts`.

---

## 2. Requirements

- Node.js 22 or newer (`node -v`)
- A Neon account (free tier is enough to start): https://neon.tech

---

## 3. Neon database setup

### 3.1 Create the project

1. Sign in at https://console.neon.tech and click **New project**.
2. **Project name:** `clinicos`. **Postgres version:** 17 (16 also works). **Region:** the one closest to where the
   backend will run (for users in India, the closest Asia-Pacific region Neon offers).
3. Click **Create project**. Neon creates a branch called `main`, a database called `neondb` and an owner role.

### 3.2 Copy the two connection strings

1. On the project dashboard click **Connect**.
2. Choose **Branch:** `main`, **Database:** `neondb`, **Role:** the owner role.
3. Switch **Connection pooling** **ON**. Copy the string; its host contains `-pooler`. This is `DATABASE_URL`.
4. Switch **Connection pooling** **OFF**. Copy the string; the same host without `-pooler`. This is `DIRECT_URL`.

Why two? The API uses the pooled endpoint (PgBouncer), so many API instances share few database connections.
Migrations need a direct session-level connection, which the pooler does not provide.

### 3.3 Put them in `backend/backend.env`

```bash
cd backend
cp backend.env.example backend.env     # Windows PowerShell: Copy-Item backend.env.example backend.env
```

Open `backend.env` and replace the two placeholder lines:

```
DATABASE_URL=postgresql://<role>:<password>@ep-<name>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DIRECT_URL=postgresql://<role>:<password>@ep-<name>.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Set `TOKEN_PEPPER` too, if it is empty:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`backend.env` is git-ignored. Do not commit it, paste it into chat tools, or copy any of it into the admin panel.

### 3.4 Optional: a test branch

The integration tests delete all data in the database they use, so they need their own branch.

1. In the Neon console open **Branches** and click **Create branch**. Name it `test`, from `main`.
2. Click **Connect** for the `test` branch and copy the pooled and direct strings as in 3.2.
3. Add them to `backend.env`:

```
TEST_DATABASE_URL=<pooled string of the test branch>
TEST_DIRECT_URL=<direct string of the test branch>
```

The test setup refuses to run if these point at the same branch and database as `DATABASE_URL` / `DIRECT_URL`.

---

## 4. Prisma: migrations and the client

| Command | When |
| --- | --- |
| `npm install` | Installs packages and generates the Prisma client (`postinstall`). |
| `npm run db:migrate:deploy` | Applies every pending migration in `prisma/migrations` to the database in `DIRECT_URL`. Run it once after setup and before every release. Never resets data. |
| `npm run db:migrate:status` | Shows which migrations the database has and which are pending. |
| `npm run db:migrate:dev -- --name <change>` | Development only: after editing `schema.prisma`, creates a new migration folder and applies it. Commit the folder. |
| `npm run db:generate` | Regenerates the client after a schema change (also part of `build`). |
| `npm run db:validate` | Checks `schema.prisma` without touching a database. |
| `npm run db:studio` | Opens Prisma Studio to browse data. Be careful on the production branch. |

`db:migrate:dev` uses a temporary "shadow" database to check the migration. Neon's owner role can usually create it.
If it reports it cannot create the shadow database, create a database named `clinicos_shadow` in the Neon console
(**Databases** → **New database**) and set `SHADOW_DATABASE_URL` in `backend.env` to its **direct** string.
Never run `migrate dev` or `migrate reset` against the production branch.

### What the first migration creates

`prisma/migrations/20261115000000_init` creates these tables, with foreign keys, unique indexes and CHECK constraints:

| Table | Holds |
| --- | --- |
| `users` | account, Argon2id password hash, verification and lock state |
| `sessions` | one row per signed-in browser (hash of the cookie token), expiry, last activity |
| `verification_codes` | email verification and password reset codes (hashed), attempts |
| `organisations`, `branches` | clinics and their branches |
| `memberships`, `membership_roles` | who belongs to which organisation, with which roles |
| `roles`, `role_permissions`, `role_branches` | roles, their permissions and branch scope |
| `invitations` | staff invitations (hashed token), expiry, acceptance |
| `rate_limits` | shared rate-limit counters |
| `audit_log` | security events |

`prisma/migrations/20261115120000_patients_appointments` adds:

| Table | Holds |
| --- | --- |
| `patients` | organisation-level patient master record (MRN, demographics, contact, emergency contact, home branch, status) |
| `practitioners` | therapist profile for a member: display name, specialty, department, room, slot length |
| `practitioner_availability` | weekly consulting windows per branch (weekday + minutes after midnight, clinic local time) |
| `appointments` | bookings: patient, therapist, branch, start/end, type, status, channel, queue token |
| `appointment_events` | append-only history of every booking and status change |
| `org_counters` | per-organisation numbering (PT-000001, APT-000001, daily queue tokens) |

`prisma/migrations/20261116090000_staff_clinical_core` adds:

| Table | Holds |
| --- | --- |
| `staff_members`, `staff_branches` | people who work for the organisation (login optional), their branches and primary branch |
| `attendance_records`, `attendance_corrections` | one record per person, branch and day; every correction keeps the previous values |
| `staff_leaves` | leave and time blocks; while scheduled they remove the person's bookable slots |
| `encounters` | consultations: complaint, SOAP, in progress → signed (locked) |
| `vital_signs`, `diagnoses`, `allergies` | chart entries, with range and format checks |
| `clinical_alerts` | safety flags; acknowledging needs a disposition and justification |
| `clinical_notes`, `note_addenda` | signed notes (filed when an encounter is signed) and their addenda |

`prisma/migrations/20261117100000_orders_referrals_care` adds:

| Table | Holds |
| --- | --- |
| `prescriptions`, `prescription_items`, `prescription_events` | signed medication orders (never edited; a SHA-256 hash of the signed content), their lines and activity |
| `diagnostic_orders`, `diagnostic_order_items`, `order_events` | lab and imaging orders: ordered → specimen collected → result → reviewed (or cancelled) |
| `referrals`, `referral_events` | outgoing and received referrals, their response window and follow-up log |
| `care_plans`, `care_plan_goals`, `care_plan_interventions`, `care_plan_reviews` | care plans with a lead therapist, goals, interventions and every progress review |
| `incidents` | patient-safety reports; an anonymous report stores no reporter |

It also links an alert to the order whose result raised it (`clinical_alerts.order_id`) and lets an alert have no
creator (raised by an anonymous incident report).

`prisma/migrations/20261118090000_billing_finance` adds:

| Table | Holds |
| --- | --- |
| `billing_services`, `billing_service_prices` | the service catalogue: default price, tax treatment and GST rate, and the branches offering each service (with an optional branch price) |
| `billing_settings` | the organisation's billing defaults: model, enabled payment methods, advance, partial-payment and allocation policies |
| `charges` | an amount owed for one service, priced from the catalogue at the patient's branch; draft → unbilled → invoiced |
| `invoices`, `invoice_lines` | issued invoices; lines and totals are fixed at issue |
| `payments` | money received, each with its receipt number; never edited |
| `payment_allocations` | parts of a payment applied to invoices; a negative row releases an allocation for a refund |
| `refunds` | refund requests: pending → approved → processed (or rejected / failed) |
| `statement_imports`, `statement_lines`, `reconciliation_exceptions` | uploaded bank / gateway statements, each line's match to a payment, and the exceptions worked to a resolution |
| `finance_events` | the activity history of services, settings, charges, refunds and exceptions |

CHECK constraints keep amounts positive, totals consistent (`total = gross − discount + tax`), a due date on or
after the invoice date, a charge linked to an invoice exactly when invoiced, and a refund's decision, completion
and bank / gateway reference in step with its status.

`prisma/migrations/20261118120000_inventory_pharmacy` adds:

| Table | Holds |
| --- | --- |
| `stock_items`, `stock_item_suppliers` | the item master: code, category, units, safety / reorder / maximum levels, unit price, schedule, the medicine code and strength used to match prescriptions, and approved suppliers |
| `stock_locations` | stores and pharmacies, each in one branch |
| `suppliers` | supplier master data, with an active flag |
| `stock_batches` | stock per item, location and batch: posted, reserved and quarantined units, expiry, bin |
| `stock_movements` | the append-only stock ledger: every receipt, transfer, dispense, adjustment and restock, with the available quantity after it |
| `stock_requests`, `stock_request_lines`, `stock_reservations` | replenishment requests from a pharmacy, the approved quantities, and the store batches reserved for them |
| `stock_transfers`, `stock_transfer_lines` | stock moving between locations: ready → in transit → received (or cancelled) |
| `purchase_orders`, `purchase_order_lines` | orders to suppliers |
| `goods_receipts`, `goods_receipt_lines`, `receipt_discrepancies` | goods received against an order, the batches accepted, and short / damaged deliveries worked to a resolution |
| `stock_adjustments` | count corrections: draft → posted (or rejected) |
| `dispenses`, `dispense_lines` | each dispensing against a prescription, with the batch and unit price of every line |
| `pharmacy_cases` | returns and discrepancies reported at a pharmacy, and their decision |
| `inventory_events` | the activity history of suppliers, requests, transfers, orders, receipts, adjustments and cases |

CHECK constraints keep stock quantities, levels and prices non-negative, reserved plus quarantined units within the
posted units, a transfer between two different locations, received quantities within those sent or ordered, and an
adjustment's decision time in step with its status.

The database itself refuses double booking. Two exclusion constraints (using the `btree_gist` extension) reject an
open appointment (`pending`, `confirmed`, `arrived`, `in_progress`) that overlaps another open appointment with the
same therapist, or with the same patient. Another rejects overlapping weekly windows for one therapist. CHECK
constraints guard mobile, PIN, Aadhaar-last-4, email and blood-group formats, slot lengths and time ranges.

---

## 5. Running locally

Terminal 1, backend:

```bash
cd backend
npm install
npm run db:migrate:deploy
npm run dev                # http://localhost:4000; check http://localhost:4000/health/ready
```

Terminal 2, admin panel:

```bash
cd admin-panel
cp .env.example .env.local # VITE_API_URL=http://localhost:4000
npm install
npm run dev                # http://localhost:5173
```

With no email delivery configured, emails (including verification and reset codes) are printed in the backend
terminal.

### Email delivery

The backend generates and checks every code; the mail provider only delivers the message. It picks the first
configured option at startup and logs which one is active:

1. **EmailJS** when all four `EMAILJS_` values are set. Sent from the server through the EmailJS REST API, so
   codes never pass through the browser. Setup in the EmailJS dashboard:
   - **Email Services → Add New Service** (for example Gmail) → note the **Service ID**.
   - **Email Templates → Create New Template**: *To Email* `{{to_email}}`, *Subject* `{{subject}}`,
     *Content* `{{message}}` (one generic template serves verification, reset, invitation and notice emails)
     → note the **Template ID**.
   - **Account → General**: copy the **Public Key** and the **Private Key**.
   - **Account → Security**: turn on **Allow EmailJS API for non-browser applications** and **Use Private Key**.
   - The free plan sends 200 emails a month.
2. **SMTP** when `SMTP_URL` is set (`MAIL_FROM` is the sender); the login is checked at startup.
3. **Console** otherwise (development only; production refuses to start without 1 or 2).

A failed send is logged (`Failed to send ...` with the provider's reason) but the API response stays the
same, so it never reveals whether an email address has an account.

---

## 6. Configuration reference (`backend.env`)

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `NODE_ENV` | | `development` | `production` turns on the strict checks below |
| `PORT` | | `4000` | HTTP port |
| `LOG_LEVEL` | | `info` | `fatal` … `trace`, or `silent` |
| `DATABASE_URL` | yes | | Neon **pooled** connection string (API runtime) |
| `DIRECT_URL` | for migrations | | Neon **direct** connection string (Prisma CLI) |
| `DATABASE_POOL_MAX` | | `10` | connections per API process |
| `DATABASE_TX_TIMEOUT_MS` | | `10000` | longest a transaction may run; raise it (for example to `30000`) when the database region is far from the API |
| `SHADOW_DATABASE_URL` | | | only if `migrate dev` cannot create its shadow database |
| `TEST_DATABASE_URL`, `TEST_DIRECT_URL` | for integration tests | | a separate Neon branch |
| `CORS_ORIGINS` | yes | | admin panel origin(s), comma-separated, no trailing slash |
| `APP_URL` | yes | | admin panel base URL used in email links |
| `TOKEN_PEPPER` | yes | | 32+ random characters; key for hashing session tokens, codes, invitations, rate-limit keys |
| `SESSION_IDLE_MINUTES` | | `30` | session ends after this long without a request |
| `SESSION_MAX_AGE_HOURS` | | `12` | session ends this long after sign-in regardless |
| `COOKIE_SECURE` | production | `false` | `true` on HTTPS; required in production |
| `COOKIE_SAMESITE` | | `lax` | `lax`, `strict` or `none` (needs `COOKIE_SECURE=true`) |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` | production (or SMTP) | | EmailJS delivery; all four together |
| `SMTP_URL`, `MAIL_FROM` | production (or EmailJS) | | SMTP delivery; with neither option set, emails print to the console |
| `TRUST_PROXY` | | `0` | number of proxies in front (set `1` behind a load balancer) |
| `CLINIC_TIMEZONE` | | `Asia/Kolkata` | IANA zone used for appointment dates, slots and daily queue tokens |

The backend refuses to start with a missing, placeholder or unsafe value and names the variable.
In production it also requires HTTPS for `APP_URL` and `CORS_ORIGINS`, `COOKIE_SECURE=true`, and EmailJS or SMTP.

---

## 7. API reference

Base path `/v1`. JSON in, JSON out.

- Success: `{ "data": ... }` (or `204 No Content`).
- Error: `{ "error": { "code", "message", "details": [{ "field", "issue" }], "traceId" } }`. `message` is safe to show
  to users. `details` carries one message per invalid field. `429` responses include `Retry-After` (seconds).
- Auth: the session is an HttpOnly cookie set by `POST /v1/auth/login`. Browsers send it with `credentials: 'include'`.
- Organisation: routes marked *org* need the `X-Org-Id: <organisation id>` header and an active membership.

### Auth (`/v1/auth`)

| Method & path | Access | Body | Result |
| --- | --- | --- | --- |
| `POST /register` | public | `fullName, email, password` | `202 { status: 'verification_pending', email }`, same for new and existing emails |
| `POST /email-verification/confirm` | public | `email, code` | `200 { status: 'verified' }` or `400 CODE_INVALID` |
| `POST /email-verification/resend` | public | `email` | `202` (always) |
| `POST /login` | public | `email, password` | `200` session (below) + `Set-Cookie`; `401 INVALID_CREDENTIALS`; `403 ACCOUNT_DISABLED`; `429` |
| `POST /logout` | public | | `204`, ends this session and clears the cookie |
| `POST /logout-all` | signed in | | `204`, ends every session of the user |
| `GET /session` | signed in (unverified allowed) | | `200 { user, memberships }` |
| `GET /sessions` | signed in | | `200 [{ id, createdAt, lastSeenAt, expiresAt, ip, userAgent, current }]` |
| `DELETE /sessions/:id` | signed in | | `204`, ends one of your sessions |
| `POST /password-reset/request` | public | `email` | `202` (always) |
| `POST /password-reset/confirm` | public | `email, code, password` | `200`, ends all sessions |
| `POST /password/change` | signed in | `currentPassword, newPassword` | `200`, keeps this session, ends the others |

Session body: `{ user: { id, email, fullName, emailVerified }, memberships: [{ membershipId, organisation: { id, name, status }, roles: [{ id, name, scope, isSystem }], permissions: [string], branchScope: 'all' | [branchId] }] }`.

### Users, organisations, permissions

| Method & path | Access | Body | Result |
| --- | --- | --- | --- |
| `GET /users/me` | signed in | | `200 { id, email, fullName, emailVerified }` |
| `PATCH /users/me` | signed in | `fullName` | `200` profile |
| `POST /organisations` | signed in | `clinicName, location, city, state, facilityType` | `201` membership; the caller becomes Super Admin |
| `GET /branches` | org member | | `200 [{ id, code, name, city, state, status }]` |
| `GET /permissions` | org member | | `200` permission catalogue |

### Roles, members, invitations

| Method & path | Access | Body | Result |
| --- | --- | --- | --- |
| `GET /roles`, `GET /roles/:id` | `settings.roles` or `staff.credentials` | | role(s) with `permissions`, `branchIds`, `users`, `version` |
| `POST /roles` | `settings.roles` | `name, category, scope, status, description?, permissions?, branchIds?` | `201` role |
| `PATCH /roles/:id` | `settings.roles` | `version` + any role fields | `200` role; `409 VERSION_CONFLICT` if someone else saved first |
| `GET /members` | `settings.roles` or `staff.credentials` | | members with user and roles |
| `PUT /members/:id/roles` | `settings.roles` | `roleIds` | `200` member |
| `PATCH /members/:id` | `settings.roles` | `status: 'active' \| 'suspended'` | `200` member |
| `GET /invitations` | `settings.roles` or `staff.credentials` | | invitations with status |
| `POST /invitations` | `settings.roles` or `staff.credentials` | `email, roleIds` | `201`; emails a single-use link |
| `DELETE /invitations/:id` | `settings.roles` or `staff.credentials` | | `204` |
| `POST /invitations/preview` | public | `token` | `200 { email, organisation, invitedBy, roles, expiresAt, accountExists }` |
| `POST /invitations/accept-new` | public | `token, fullName, password` | `201`; creates a verified account and joins |
| `POST /invitations/accept` | signed in | `token` | `200`; joins with the signed-in account (email must match) |

### Patients

All patient routes send `X-Org-Id`. Patients are organisation-wide records. A therapist without `bookings.create`
only sees patients booked with them; anyone else with `patients.view` sees the whole directory.

| Method & path | Access | Body / query | Result |
| --- | --- | --- | --- |
| `GET /patients` | `patients.view` | `query?, status?, gender?, branchId?, department?, visitWithinDays?, page?, pageSize? (≤100)` | `{ data: patients, meta: { page, pageSize, total } }` |
| `GET /patients/duplicates` | `patients.create` or `patients.edit` | `mobile, excludeId?` | patients registered with that mobile number |
| `GET /patients/:id` | `patients.view` | | patient with `homeBranch` and `lastVisit` |
| `POST /patients` | `patients.create` | patient fields + `confirmedNotDuplicate` | `201`; `409 POSSIBLE_DUPLICATE` when the mobile number is already registered |
| `PATCH /patients/:id` | `patients.edit` | patient fields + `version` | `200`; `409 PATIENT_CHANGED` if someone else saved first |
| `PATCH /patients/:id/status` | `patients.edit` | `status: 'active' \| 'inactive', note?` | `200` |

### Therapists and slots

| Method & path | Access | Body / query | Result |
| --- | --- | --- | --- |
| `GET /practitioners` | `bookings.view`, `bookings.create` or `bookings.assign` | `status?, branchId?` | therapists with weekly `availability` |
| `GET /practitioners/candidates` | `bookings.assign` | | active members without a therapist profile |
| `GET /practitioners/:id` | as list | | therapist |
| `GET /practitioners/:id/slots` | `bookings.create` or `bookings.reschedule` | `branchId, from (YYYY-MM-DD), days? (≤62), excludeAppointmentId?` | per day: `slots: [{ time, state: available \| booked \| past }]` |
| `POST /practitioners` | `bookings.assign` | `membershipId, displayName, credentials?, specialty, department, room?, slotMinutes` | `201` |
| `PATCH /practitioners/:id` | `bookings.assign` | profile fields + `status` | `200` |
| `PUT /practitioners/:id/availability` | `bookings.assign` | `windows: [{ branchId, weekday (0=Sun), start 'HH:MM', end 'HH:MM' }]` | `200`; replaces the weekly schedule (booked appointments keep their times) |

### Appointments

Status changes are separate actions; the server checks each transition
(`pending → confirmed → arrived → in_progress → completed`; `cancelled` and `no_show` only before arrival).
Times are in `CLINIC_TIMEZONE` (default `Asia/Kolkata`). Therapists without `bookings.create` see only their own appointments.

| Method & path | Access | Body / query | Result |
| --- | --- | --- | --- |
| `GET /appointments` | `bookings.view` | `patientId?, practitionerId?, branchId?, date?, status?, page?, pageSize? (≤200)` | `{ data, meta }`; a `date` lists that day earliest first, otherwise newest first |
| `GET /appointments/:id` | `bookings.view` | | appointment with `events` (history) |
| `POST /appointments` | `bookings.create` | `patientId, practitionerId, branchId, date, time, type, channel, status ('pending' \| 'confirmed'), reason, internalNote?, notifyWhatsapp, notifySms, arrivedNow?, waitingQueue?` | `201`; `409 SLOT_TAKEN`, `PATIENT_DOUBLE_BOOKED`, `DUPLICATE_BOOKING`; `422 SLOT_NOT_AVAILABLE`, `SLOT_IN_PAST`, `PATIENT_INACTIVE` |
| `POST /appointments/:id/confirm` | `bookings.create` | | `200` |
| `POST /appointments/:id/check-in` | `bookings.create` | `note?` | `200`; issues a daily queue token (A-01…); only on the appointment day |
| `POST /appointments/:id/start` | `clinical.write` | | `200` |
| `POST /appointments/:id/complete` | `clinical.write` | | `200` |
| `POST /appointments/:id/reschedule` | `bookings.reschedule` | `date, time, reason, note (≥10 chars)` | `200`; same appointment, history keeps the old time |
| `POST /appointments/:id/cancel` | `bookings.cancel` | `reason, note (≥10 chars)` | `200` |
| `POST /appointments/:id/no-show` | `bookings.cancel` | `reason, note (≥10 chars)` | `200`; only after the appointment time |

### Staff

| Method & path | Access | Body / query | Result |
| --- | --- | --- | --- |
| `GET /staff` | `staff.view` | `query?, type?, department?, branchId?, status? (active, draft, inactive, on_leave), page?, pageSize?` | `{ data, meta }` |
| `GET /staff/summary` | `staff.view` | | counts by type and status, departments |
| `GET /staff/:id`, `GET /staff/:id/history` | `staff.view` | | record with branches, account and therapist profile; its audit history |
| `POST /staff`, `PATCH /staff/:id` | `staff.create` | person fields (+ `version` on update) | doctors need council, number and a qualification unless saved as draft |
| `PUT /staff/:id/branches` | `staff.create` | `branchIds, primaryBranchId` | |
| `POST /staff/:id/invite` | `staff.credentials` | `email, roleIds` | `result: 'invited'` (record links when accepted) or `'linked'` (existing member) |
| `GET /staff/:id/attendance` | `staff.view` | `month (YYYY-MM), branchId?` | records with corrections, counts |
| `POST /staff/:id/attendance` | `staff.attendance` | `branchId, date, status, time?, note?` | `409 ATTENDANCE_EXISTS` for a second record that day |
| `PATCH /staff/:id/attendance/:recordId` | `staff.attendance` | `status, time?, reason (≥10), version` | correction kept in history |
| `GET /staff/:id/leaves` | `staff.view` | | |
| `POST /staff/:id/leaves` | `staff.leave` | `kind, title, startDate, endDate, startTime?, endTime?, branchId?, reason` | `{ leave, affectedAppointments }` |
| `DELETE /staff/:id/leaves/:leaveId` | `staff.leave` | | cancels it; slots reopen |

### Clinical

Reading needs `clinical.read`, writing `clinical.write`; both follow the patient scope (a therapist without
booking rights only sees patients booked with them).

| Method & path | Body / query | Result |
| --- | --- | --- |
| `GET /patients/:id/chart` | | encounters, vitals, diagnoses, allergies, alerts, notes |
| `GET /clinical/worklist` | `date` | today's appointments with their encounter, open encounters, serious alerts, `me.practitionerId` |
| `POST /encounters` | `{ appointmentId }` or `{ patientId, branchId, type, reason }` | starts the appointment and opens the encounter in one transaction |
| `PATCH /encounters/:id` | `chiefComplaint, subjective, objective, assessment, plan, version` | only while in progress |
| `POST /encounters/:id/sign` | | needs a complaint and a diagnosis; locks it, files the note, completes the appointment |
| `POST /patients/:id/vitals`, `/diagnoses`, `/allergies`, `/alerts` | entry fields (`encounterId?` must be open) | a severe allergy also raises a critical alert |
| `POST /diagnoses/:id/resolve` | | |
| `POST /alerts/:id/acknowledge`, `/resolve` | `disposition, justification (≥10)` for acknowledge | |
| `POST /notes/:id/addenda` | `text (≥10)` | |

The chart (`GET /patients/:id/chart`) also returns `prescriptions`, `orders`, `referrals` and `carePlans`; the
worklist adds `ordersAwaitingReview` and `followUpsDue`. Every change below needs `clinical.write`:

| Method & path | Body | Rules |
| --- | --- | --- |
| `POST /patients/:id/prescriptions` | `encounterId` or `branchId`, `indication`, `precautionAcknowledged`, `items[]` | `422 ALLERGY_CONFLICT` when a drug class matches an allergy; `422 PRECAUTION_REQUIRED` for an NSAID with BP ≥ 130/80 unless acknowledged; quantity is worked out on the server |
| `POST /prescriptions/:id/discontinue` | `reason (≥10)` | only while active |
| `POST /patients/:id/orders` | `encounterId` or `branchId`, `indication`, `items[]` | any laboratory item makes it a lab order; non-routine priority makes it urgent |
| `POST /orders/:id/collect` | `note?` | lab orders only, from `ordered` |
| `POST /orders/:id/result` | `summary, flag (normal, abnormal, critical)` | abnormal or critical raises a chart alert |
| `POST /orders/:id/review` | `outcome, note (≥10)` | resolves the result's alerts in the same transaction |
| `POST /orders/:id/cancel` | `reason (≥10)` | only before a result |
| `POST /patients/:id/referrals` | `direction` (`outgoing`: `targetPractitionerId` or `facility`; `incoming`: `clinician`, `facility`), `priority`, `model`, `specialty`, `indication`, `narrative` | the response window comes from the priority |
| `POST /referrals/:id/follow-up`, `/reroute` | outcome, method, representative, staff, notes | outgoing referrals still waiting for a response |
| `POST /referrals/:id/triage` | `decision (accept, decline)` | received referrals, once |
| `POST /patients/:id/care-plans` | title, category, `leadPractitionerId`, rationale, dates, diagnoses, goals, interventions | dates must be in order |
| `POST /care-plans/:id/reviews` | `mode (save, complete, escalate)`, observation, goal statuses, adherence, `nextReview`, `version` | compliance and status are worked out on the server; completing needs every goal rated, a later review date and any worsening goal escalated; escalating raises an alert |

### Incidents

| Method & path | Access | Notes |
| --- | --- | --- |
| `POST /incidents` | any member | severity 1–5; actions required from 4; level 5 with a patient raises a critical alert; `anonymous: true` stores no reporter and audits without actor or connection details |
| `GET /incidents` | `clinical.read` | `page?, pageSize?` |

### Billing & finance (`/v1/billing`)

Every finance permission (`accounting.*`) opens the ledger. They are organisation-wide by design: a branch-scoped
role can never hold them. Amounts are rupees with at most two decimals; the server works in whole paise.

| Method & path | Access | Body / rules |
| --- | --- | --- |
| `GET /billing/ledger` | any `accounting.*` | `patientId?`. Branches, patients with finance records, services, settings, charges, invoices, payments with allocations, refunds, and (organisation-wide only) statement imports, lines and exceptions |
| `POST /billing/services`, `PATCH /billing/services/:id` | `accounting.invoices` | code (unique, upper-cased), name, category, price, `taxTreatment` (`exempt`, `no_tax`, `taxable`, `not_configured`), `taxConfig`, `prices[]` (branch, optional override); an active service needs a tax decision and a branch. PATCH takes `{ version, service }` |
| `POST /billing/services/:id/status` | `accounting.invoices` | `status`, `reason` (needed to deactivate), `version`; activation re-runs the checks |
| `PUT /billing/settings` | `accounting.invoices` | model, `cashEnabled`, `bankEnabled`, `upiEnabled` (at least one), policies, document defaults, `version` (`null` on the first save) |
| `POST /billing/charges`, `PATCH /billing/charges/:id` | `accounting.invoices` | patient, service, payer, model, quantity, discount, `confirm`; `422 SERVICE_INCOMPLETE` when confirming a service without a price or tax decision; only drafts change |
| `POST /billing/invoices` | `accounting.invoices` | patient, payer, model, dates, `discountPct?` (replaces each line's), `chargeIds[]` (unbilled only, `409 CHARGE_NOT_BILLABLE` otherwise), `items[]` (catalogue services) |
| `POST /billing/payments` | `accounting.payments` | patient, amount, channel, payer, `purpose` (`charges`, `advance`), `txnReference` (all but cash), `allocations[]`; `422 METHOD_DISABLED`, `409 DUPLICATE_PAYMENT` (same channel and reference) |
| `POST /billing/payments/:id/allocations` | `accounting.payments` | `invoiceId`, `amount` ≤ the payment's free credit and ≤ the invoice balance |
| `POST /billing/refunds` | `accounting.payments` | payment, amount, reason, method, internal reference, `releasesAllocations` |
| `POST /billing/refunds/:id/approve`, `/reject`, `/process`, `/fail` | `accounting.settlements` | `version`; reject and fail need a note; process needs the bank / gateway `outcomeReference` |
| `POST /billing/statements` | `accounting.payments` | `source`, `fileName`, `csv` (see below) |
| `POST /billing/statement-lines/:id/confirm`, `/reject` | `accounting.payments` | a suggested match counts only once confirmed; rejecting it raises an exception |
| `POST /billing/exceptions/:id/review`, `/evidence`, `/resolve` | `accounting.payments` | review assigns the exception to you; resolving needs a resolution type, a note and the evidence checked |

Rules the server enforces on every change:

- **Balances and locks.** Allocating, refunding and processing lock the payment (and invoice) rows first, so two
  cashiers cannot spend the same credit. A pending or approved refund holds its amount until it is processed,
  rejected or fails.
- **Refunds that take back applied money.** A refund with `releasesAllocations` may exceed the free credit; when it
  is processed, allocations are released newest invoice first and those invoices show a balance again.
- **Billing configuration.** Switched-off payment methods are refused. "Require full payment" refuses an allocation
  that leaves part of an invoice unpaid. "Apply to the oldest invoice first" applies a payment against charges with
  no allocation chosen. "Apply to the next invoice" spends the patient's unallocated credit when an invoice is issued.
- **Numbering.** CHG-, INV-, PAY-, REC-, ALC-, RFD-, IMP- and EXC- numbers come from per-organisation, gap-free counters.

#### Statement CSV

A header row is required; names are matched case-insensitively.

| Column | Required | Accepted headers | Format |
| --- | --- | --- | --- |
| Date | yes | `date`, `transaction date`, `txn date`, `value date` | `2026-11-17`, `17/11/2026` or `17-11-2026` |
| Reference | yes | `reference`, `ref`, `reference no`, `utr`, `transaction id`, `txn id`, `payment id` | up to 120 characters, unique in the file |
| Amount | yes | `amount`, `credit`, `credit amount`, `amount (inr)` | positive; `₹` and commas allowed (`1,500.50`) |
| Time | no | `time`, `transaction time`, `txn time` | `HH:MM` |
| Narration | no | `narration`, `description`, `remarks`, `details` | free text |

A file with any unreadable row is refused whole (`422 STATEMENT_INVALID`, one detail per row), at most 5,000 lines
and 1 MB. Lines already imported from the same source are skipped. Each new line is then matched: by the payment's
transaction reference (in the reference or the narration) and amount → matched; same reference, different amount →
"Amount mismatch" exception; already matched elsewhere → "Duplicate source line"; no reference but exactly one
unmatched non-cash payment of that amount on that day → a suggestion to confirm; otherwise "Missing ClinicOS record".

### Inventory & pharmacy (`/v1/inventory`, `/v1/pharmacy`)

`inventory.view` or `pharmacy.view` reads; `inventory.manage` runs the stores; `pharmacy.dispense` dispenses and
works the pharmacy. A branch-scoped role only acts on locations in its branches. Every change that can race takes a
`version` and returns `409` if the record changed in the meantime.

| Method & path | Access | Body / rules |
| --- | --- | --- |
| `GET /inventory/state` | `inventory.view` or `pharmacy.view` | branches, locations, items, suppliers, batches, the newest 1,000 movements, requests (with reserved batches), transfers, orders, receipts, adjustments, cases, members, and (with a pharmacy permission) the dispensing queue |
| `POST /inventory/items`, `PATCH /inventory/items/:id` | `inventory.manage` | code (unique), name, category, units, levels, unit price, schedule, `medicineCode` + `strength`, suppliers |
| `POST /inventory/locations`, `PUT /inventory/locations/:id/active` | `inventory.manage` | code, name, kind (`store`, `pharmacy`), branch |
| `POST /inventory/suppliers`, `PATCH /inventory/suppliers/:id`, `PUT /inventory/suppliers/:id/active` | `inventory.manage` | supplier details; deactivating needs a reason |
| `POST /inventory/requests`, `PATCH /inventory/requests/:id`, `POST /inventory/requests/:id/cancel` | `inventory.manage` or `pharmacy.dispense` | location, priority, required-by date, reason, `lines[]` |
| `POST /inventory/requests/:id/review` | `inventory.manage` | approve (in full or part) or reject; approving reserves store batches, earliest expiry first |
| `POST /inventory/requests/:id/transfer` | `inventory.manage` | moves the reserved batches onto a transfer |
| `POST /inventory/transfers`, `PATCH /inventory/transfers/:id`, `/dispatch`, `/cancel` | `inventory.manage` | from / to location (different), `lines[]` by batch; dispatching takes the stock out of the source |
| `POST /inventory/transfers/:id/receive` | `inventory.manage` or `pharmacy.dispense` | `received[]` per line; stock is posted at the destination |
| `POST /inventory/orders` | `inventory.manage` | supplier, store, expected date, `lines[]` (one per item) |
| `POST /inventory/receipts`, `PUT /inventory/receipts/:id` | `inventory.manage` | `mode` (`draft`, `record`, `post`); outside a draft, batch quantities must add up to the accepted units |
| `POST /inventory/receipts/:id/resolve`, `/post` | `inventory.manage` | a receipt with unresolved discrepancies cannot be posted; the order closes when fully received or closed as short |
| `POST /inventory/adjustments`, `PUT /inventory/adjustments/:id` | `inventory.manage` | `mode` (`draft`, `post`, `reject`), batch, non-zero change, reason, evidence; a change cannot take a batch below its reserved and quarantined units |
| `POST /pharmacy/prescriptions/:id/dispense` | `pharmacy.dispense` | pharmacy location, `quantities` by prescription item, `registerConfirmed`, `consentConfirmed` |
| `POST /pharmacy/cases`, `POST /pharmacy/cases/:id/decide` | `pharmacy.dispense` (decide also `inventory.manage`) | report a return or discrepancy; decide `restock`, `reject` or `resolve` (optionally with an adjustment) |

Dispensing rules:

- **Matching.** A prescription line is matched to the active stock item with the same `medicineCode` and `strength`.
  A line with no match cannot be dispensed until the item master has one.
- **Safety.** The prescription is locked first, so two pharmacists cannot dispense it twice. A medicine whose drug
  class is in the patient's recorded allergies is refused. A Schedule H1 medicine needs `registerConfirmed` and
  `consentConfirmed`.
- **Stock.** Units come from the pharmacy's batches, earliest expiry first; expired, reserved and quarantined units
  are never used. The prescription is completed when nothing remains to dispense.
- **Numbering.** SR-, TR-, PO-, GRN-, DSC-, ADJ-, DSP- and RET- / DIS- numbers come from per-organisation,
  gap-free counters.

### Health (no version prefix)

`GET /health/live` answers 200 while the process runs. `GET /health/ready` answers 200 only when Neon is reachable, otherwise 503.

---

## 8. Security

**Passwords**
- Hashed with Argon2id (19 MiB memory, 2 passes, 1 lane; OWASP baseline) with a random salt per password.
- Older, weaker hashes are upgraded at the next sign-in.
- The rule (8–128 characters, a letter and a number) is enforced on the server.
- An unknown email is checked against a dummy hash, so it takes as long as a wrong password.

**Sessions**
- Each sign-in gets a random 256-bit token. It lives in a cookie marked `HttpOnly` and `SameSite=Lax`, plus `Secure` in production (cookie name `__Host-clinicos_session`).
- The database stores only an HMAC of the token.
- A session ends after 30 minutes idle or 12 hours, and on sign-out, password reset or change, account disable, or "sign out everywhere".
- Each user is limited to 20 live sessions.

**Brute force**
- Login is limited per IP (30 per 15 minutes) and per email (10 per 15 minutes).
- 10 wrong passwords in a row lock the account for 15 minutes.
- Verification and reset codes: 6 digits, 10-minute expiry, 5 attempts, a 60-second resend cooldown, stored hashed, checked under a row lock.
- All counters live in Postgres, so the limits hold across every API instance.
- A coarse per-instance flood limit (300 requests per minute per IP) sits in front of everything.

**No account enumeration.** Register, resend and reset answer the same for every email. Login failures share one message.

**CSRF**
- `SameSite` cookies.
- A strict CORS allow-list with credentials.
- Every POST, PUT, PATCH and DELETE must come from an allowed `Origin`. A request carrying a cookie but no Origin is rejected.

**Authorisation**
- Global guards: every route needs a valid session and a verified email unless marked `@Public()` or `@AllowUnverified()`.
- Organisation routes check membership and permissions on every request, so changes apply immediately.
- Nobody can grant more access than they hold.
- System roles are read-only.
- An organisation must keep at least one active Super Admin, enforced under a row lock.
- Nobody can change their own access.

**SQL injection**
- All queries go through Prisma.
- The few raw queries (row locks, counters) use Prisma's tagged templates, which send values as bound parameters.
- A unit test fails if `$queryRawUnsafe`, `$executeRawUnsafe` or `Prisma.raw` ever appear.

**Input**
- Every body, parameter and header is validated with Zod.
- Bodies are limited to 100 kB.
- Emails are normalised to lower case, and the database enforces it with a CHECK constraint.

**HTTP**
- Helmet headers (HSTS, nosniff, frame options and others). No `X-Powered-By`.
- `Cache-Control: no-store`.
- A request id on every response.

**Logs and audit**
- Structured JSON logs with cookies, passwords, codes and tokens redacted.
- Internal errors return a generic message.
- The audit log records registrations, sign-ins and failures, lockouts, resets, password changes, session ends, role and membership changes, invitations and organisation creation.

**Secrets**
- Secrets live only in `backend.env` locally, or in a secret manager in production.
- The admin panel holds no secrets: its only setting is the public API URL.

---

## 9. Tests

```bash
npm test                  # unit tests, no database: config rules, Argon2, sessions, codes, CSRF check, HTTP stack, catalogue
npm run test:integration  # full flows against the Neon test branch (section 3.4); applies migrations first
npm run typecheck
```

The integration tests apply the real migrations to the test branch with `prisma migrate deploy`. Between tests they
truncate every table. Outgoing email is captured in memory.

Server logs are silent during tests. To see the error behind an unexpected 500, set `TEST_LOG_LEVEL=error` first
(PowerShell: `$env:TEST_LOG_LEVEL='error'`). Each database round trip takes as long as the distance to the Neon
region (about 250 ms from India to US East), so a full run there takes around half an hour.

---

## 10. Production

1. Create a separate Neon branch (or project) for production and keep its connection strings in your host's secret manager.
2. Set every variable from section 6. In production you also need:
   - `NODE_ENV=production`
   - `COOKIE_SECURE=true`
   - HTTPS `APP_URL` and `CORS_ORIGINS`
   - the `EMAILJS_` settings, or `SMTP_URL` and `MAIL_FROM`
   - `TRUST_PROXY=1` behind a load balancer
3. Build and migrate, then start:
   ```bash
   npm ci
   npm run build
   npm run db:migrate:deploy   # needs DIRECT_URL
   npm start                   # node dist/main.js
   ```
4. Serve the admin panel and API on the same site, for example `app.example.com` and `api.example.com`, so the `SameSite=Lax`
   cookie is sent. If they must be on unrelated domains, set `COOKIE_SAMESITE=none`. Some browsers block such
   third-party cookies, though, so the same site is strongly preferred.
5. Point the load balancer health checks at `/health/live` (liveness) and `/health/ready` (readiness).

The API is stateless apart from the database, so it scales horizontally: run more instances behind the load balancer.
Neon's pooler absorbs the extra connections. Raise `DATABASE_POOL_MAX` per instance only if the pool waits.
