# ClinicOS: mobile apps, backend and admin panel integration plan

Prepared 27 November 2026 from a reading of the code in this repository. Decisions D1 to D4 (section 10)
were approved with the recommended option the same day.

## 0. Progress

| Item | State |
| --- | --- |
| Patient identity: one-time codes, accounts, sessions, consents, record linking, desk codes | Built, with unit and integration tests |
| Branch opt-in and patient app access in the admin panel | Built |
| Patient app: sign-in, registration, profile, consents, devices, log out, connected clinics | Built; type check and Android bundle pass; **not yet run against a live API or on a device** |
| Live event stream and in-app notifications (staff and patient) | Built, with unit and integration tests; push, SMS and WhatsApp delivery and preferences are not built |
| Patient clinic discovery, booking, reschedule, cancel; admin booking settings, live schedule, notices in the alerts bell | Built; tested, and walked through in a browser (app web build and admin panel) against the test database |
| Patient health records: consultations, prescriptions, orders and results, care plans, timeline; notices when records are released | Built, with unit and integration tests, and walked through in a browser against the test database |
| Refill requests and help requests, with the admin refill queue and help inbox | Built, with unit and integration tests, and walked through in browsers (app and admin) against the test database |
| Staff app sign-in: mobile and password, then an SMS code; bearer sessions that refuse browsers; workspace from permissions | Built, with unit and integration tests, and walked through in a browser against the test database |
| Staff app, reception workspace: desk overview, appointments, patients, appointment actions, check-in, booking, registration, walk-in queue, queue board | Built; type check and lint pass; walked through in a browser against the test database, including a live update |
| Staff app, doctor workspace: today, schedule, patient queue, search, chart, history, encounter view, the consultation (notes, vitals, diagnoses, prescription, orders, referral, care plan, follow-up, review, signing), result review, alerts, inbox, profile and account | Built; type check and lint pass |
| Staff app, nurse workspace: today, queue, tasks (vitals due and specimens to collect), alerts and notifications, preparation, vitals entry, readiness check, profile | Built; type check and lint pass; walked through in a browser against the test database, including the nurse's vitals appearing in the doctor's consultation |
| Staff app self-service: own attendance, leave, payslips and advances (including confirming receipt of an advance), notifications; help answers | Built, with integration tests, and walked through in a browser against the test database |
| Phase 0 (commit) and phases 3 to 8 | Not started, apart from the items above |

| Migration | Neon test branch | Main database |
| --- | --- | --- |
| `20261127090000_patient_identity` | Applied | Applied 27 November 2026 |
| `20261127150000_patient_booking` | Applied | Applied 27 November 2026 |
| `20261127200000_patient_requests` | Applied | Applied 27 November 2026 |
| `20261128090000_staff_app_sessions` | Applied | Applied 28 November 2026 |

Changes from the design in sections 2 to 4:

- **No `app_events` table.** Live events carry only ids and go through Postgres `NOTIFY`. A client reloads
  what it shows whenever its stream connects, so there is nothing to replay, and a replay cursor ordered by
  insert time could skip events committed late. Streams close after five minutes so access is checked again.
- **Who takes a patient booking.** The patient picks a service. The server gives the time to a free therapist
  in that service's department who accepts app bookings, trying the next one if the slot is taken first.
- **First visit.** Booking at a clinic with no matching record registers one. A match that is not certain is
  refused with a request for a desk code, so no duplicate is created.
- **Changes by patients** are allowed until the appointment starts. No notice period is enforced.

Changes in the staff app:

- **Doctors do not book.** The Clinician role has no booking permission, so the follow-up step writes a
  `Follow-up:` line into the encounter plan for reception to book from. Someone who can book sees a button.
- **Signing needs only a chief complaint and a diagnosis**, as the server requires. Prescriptions, orders,
  referrals, care plans and follow-up are shown as optional.
- **Clinical live updates for staff.** Record events now carry a branch and reach staff with `clinical.read`
  there. Vitals, diagnoses, allergies, alerts and note edits now send them as well.
- **New read routes:** `GET /v1/orders/:id` and `GET /v1/alerts/:id` (clinical read, care scope applies), and
  `/v1/me/staff` now includes the person's own registration, qualifications and consulting hours.
- **Self-service.** New routes `/v1/me/attendance`, `/v1/me/leaves`, `/v1/me/pay` and
  `/v1/me/pay/advances/:id/acknowledge` act only on the signed-in member's own staff record. Attendance and
  leave are read-only: ClinicOS has no check-in, leave request, approval or balance. Payslips show only
  processed runs. There is no staff help desk, so support requests are not sent.
- **Nursing.** There is no rooming, handoff, escalation or ward-task feature, so those screens say so. Tasks
  are worked out from records (checked-in patients without vitals, lab orders without a specimen). Readings out
  of the usual range are flagged on screen for the nurse to tell the doctor; nothing is sent. Vitals taken
  before a consultation have no encounter and count for that day's visit on the doctor's side.
- **Not built, so the screens say so:** payments at the desk (who may collect is not decided), messaging with
  patients and the care team, dictation, slot blocking by doctors, and WhatsApp sharing of care plans (the
  preference is recorded; nothing is sent).

Still open for records: attachments on help requests, downloadable copies, and loading more than 50 records of one kind.

Still open for booking: appointment reminders from the app, loading more than 50 past visits, and asking for
the PIN code during registration (today the first booking sends the patient to their profile to add it).

Sections 1 to 9 describe the state before the work started and the target design.

## 1. Where the product stands

| Part | State |
| --- | --- |
| `backend/` | NestJS 11, Prisma 7, Neon PostgreSQL. 12 migrations, role-based access, audit log. About 29 feature modules covering patients, appointments, clinical records, billing, pharmacy, inventory, payroll, growth, configuration and reports. |
| `admin-panel/` | React and Vite. Connected to the backend. |
| `patient-app/` | Expo. 39 route files. No network calls; all data is in memory. |
| `doctor-app/` | Expo staff app for doctor, reception and nurse. 66 route files. No network calls; the role is picked from the phone number. |

Baseline measured on 27 November 2026:

| Check | Result |
| --- | --- |
| Backend typecheck and unit tests | Pass (176 tests) |
| Backend integration tests | Not run for this plan |
| Admin panel lint and tests | Pass (628 tests, lint warnings only) |
| `patient-app` typecheck | Pass |
| `doctor-app` typecheck | **Fails** on typed route errors; to be diagnosed in phase 0 |

The working tree also holds uncommitted work: both apps, the role dashboards and the branch map.

**So the job is not a new backend.** It is: connect two apps to the existing backend, build what the apps need that does not exist, add the matching admin screens, add live updates, and fix the parts that will not scale.

### 1.1 Gaps that shape the design

| # | Finding | Consequence |
| --- | --- | --- |
| G1 | Authentication reads only a browser cookie. Sessions end after 30 idle minutes or 12 hours. | The apps need a token transport and their own session limits. |
| G2 | Patients cannot sign in. `patients.portal_user_id` is reserved and unused. | A separate patient identity and API are needed. |
| G3 | Live updates exist only for the Growth message inbox. | A general event stream is needed. |
| G4 | `appointments.booked_by` and `appointment_events.actor_user_id` require a staff user. | A patient cannot book, move or cancel without a schema change. |
| G5 | Collecting a payment needs `accounting.payments`. Finance permissions cannot be given to branch roles. | The reception billing screens would be refused for a normal front desk. |
| G6 | The medicine list is hard-coded in the admin panel (`patients/data/catalog.js`). | The doctor app needs it from the server. |
| G7 | Leave is entered by an administrator. There is no request, approval or balance. | The staff leave screens need new records. |
| G8 | No records exist for notifications, support requests, nurse tasks, handoffs, room calls or staff messages. | New tables. |
| G9 | Branches have no coordinates and no flag for appearing in the patient app. | Clinic discovery needs both. |
| G10 | The billing ledger, inventory and payroll "state" endpoints load an organisation's full history. | They slow down in proportion to history and will not work at large volume. |
| G11 | The database is in `us-east-2`. Earlier measurements from India were about 250 ms per round trip. | API and database must sit together, near the users. This matters more than any query tuning. |
| G12 | The API runs on a free Render instance that sleeps. Background workers run inside the API process. | Not suitable for production. |

## 2. Target architecture

```
patient-app ──┐  Bearer token (SecureStore)     /v1/patient/*   PatientGuard
staff app  ───┤  Bearer token (SecureStore)     /v1/*           SessionGuard + AccessGuard
admin panel ──┘  HttpOnly cookie (unchanged)    /v1/*           SessionGuard + AccessGuard
                              │
                       NestJS API (stateless, N instances)
                              │ after commit: outbox row + NOTIFY
                       PostgreSQL ── LISTEN ──> SSE streams
                              │
                       Worker process (messages, reminders, push, scheduled jobs)
```

### 2.1 Two identity realms

Patients and staff do not share tables, sessions, guards or routes.

- A patient token is looked up only in `patient_sessions`, so it can never satisfy a staff route, even through a coding mistake in a permission check.
- Every `/v1/patient/*` query is scoped by the patient records linked to the signed-in account. The client never supplies a patient ID that is trusted on its own.
- Patient responses use their own view shapes. Internal notes, unsigned encounters, unreviewed results and staff-only alerts are not selected at all.

### 2.2 App sessions

- `POST /v1/auth/app/login` returns the token in the body and sets no cookie. It refuses requests that carry a browser `Origin`, so a script in the admin panel cannot obtain a readable token.
- `SessionGuard` accepts `Authorization: Bearer` only for sessions created as app sessions. Cookie sessions keep today's rules, including the origin check.
- App limits (configurable): staff 15 minutes idle with a device unlock to resume and 7 days maximum; patients 30 days idle and 90 days maximum.
- Tokens are stored with `expo-secure-store`. Only a keyed hash is stored on the server, as today.

### 2.3 Role and permissions in the staff app

The server decides. The app reads `GET /v1/users/me` and picks a workspace from permissions, using the same rule as the admin role dashboards.

| Workspace | Condition |
| --- | --- |
| Doctor | `clinical.write` and an active practitioner profile |
| Nurse | `clinical.vitals` |
| Reception | `bookings.create` |
| None | A message that the role has no mobile workspace |

Hiding a screen is only presentation. Every route keeps its server permission check and the existing care scope.

Permission changes:

- `billing.collect` (new, allowed on branch roles): see a patient's open invoices at the branch and record a payment. No revenue, refunds, settlements or reconciliation. This resolves G5 without weakening the finance rule.
- `clinical.write` may book a follow-up for the doctor's own patient with themselves.
- Self-service routes (own attendance, leave, payslips, advances) need only an active membership with a linked staff record, and return only that person's rows.
- `support.manage`, `staff.leave` (existing) and `pharmacy.view` (existing) guard the new admin queues.

### 2.4 Live updates

- A write records an `app_events` row in the same transaction: organisation, branch, topic, entity ID and, where relevant, patient ID. `NOTIFY` fires after commit. This extends today's `RealtimeService`.
- `GET /v1/events/stream` (staff) filters by topic permission, branch scope and care scope. `GET /v1/patient/events/stream` sends only the account's own events.
- Events carry IDs only, never names or clinical data. The client refetches through the normal authorised route.
- Reconnecting sends `Last-Event-ID`; missed events are replayed from the table, which is pruned after 24 hours.
- Admin panel: one `useLiveRefresh(topics, reload)` hook. Apps: a stream while in the foreground, a refetch on resume, and push for the background.

| Change | Seen live by |
| --- | --- |
| Patient books, moves or cancels | Admin schedule and dashboard, reception, doctor, nurse |
| Check-in, call, rooming, handoff | Reception queue, nurse, doctor, admin dashboard |
| Vitals saved | Doctor |
| Encounter signed, prescription issued, result reviewed | Patient |
| Payment recorded | Admin billing, patient |
| Leave request and decision | Admin approvals, staff member |
| Support request and reply | Admin support inbox, requester |

## 3. Database design

All changes are additive migrations. IDs are UUIDv7, times are `timestamptz`, and every tenant table carries `org_id`. Nothing existing is dropped.

### 3.1 Patient identity

| Table | Key columns | Rules |
| --- | --- | --- |
| `patient_accounts` | mobile, full_name, email, date_of_birth, gender, blood_group, address fields, emergency contact, language, photo_media_id, status, deleted_at | unique mobile among live accounts |
| `patient_otps` | mobile_hash, code_hash, purpose, expires_at, attempts, consumed_at | rate-limited by number and IP; codes stored hashed |
| `patient_sessions` | account_id, token_hash, device_name, platform, last_seen_at, expires_at, revoked_at | unique token_hash |
| `patient_links` | account_id, org_id, patient_id, status, method, verified_at, revoked_by | unique (account_id, patient_id); one active link per patient |
| `patient_link_codes` | patient_id, code_hash, expires_at, used_at, issued_by | single use |
| `patient_consents` | account_id, org_id, purpose, granted, recorded_at, policy_version | append-only; latest row wins |

`patient_links` replaces the idea behind `patients.portal_user_id`, because one person can be a patient at several clinics.

### 3.2 Booking and visit flow

| Change | Detail |
| --- | --- |
| `appointments` | `booked_by` becomes nullable; add `booked_by_account_id`; CHECK that exactly one is set. Add `called_at`, `called_room`, `roomed_at`, `room`. |
| `appointment_events` | Same nullable actor pair and CHECK. |
| `branches` | `latitude`, `longitude`, `listed_in_patient_app` (default false). |
| `practitioners` | `online_booking` (default false). |
| `billing_services` | `patient_bookable` and the existing `department`; supplies the fee shown to patients. |
| `saved_clinics` | account_id, branch_id. |

A clinic appears in the patient app only after an administrator lists it. Double booking stays prevented by the existing database exclusion constraints, which apply to patient bookings too.

### 3.3 Notifications and support

| Table | Key columns |
| --- | --- |
| `notifications` | recipient (exactly one of membership_id or account_id), org_id, topic, title, body, link_kind, link_id, read_at, dismissed_at |
| `notification_preferences` | recipient, topic, channel, enabled, quiet hours |
| `push_devices` | session, recipient, expo_push_token, platform, disabled_at |
| `support_tickets` | org_id, reference, requester pair, category, desk, subject, description, attachment_media_id, status, assignee |
| `support_messages` | ticket_id, author, body |
| `refill_requests` | org_id, account_id, prescription_id, status, decided_by, note |
| `app_events` | sequence, org_id, branch_id, patient_id, topic, entity_id, created_at |

### 3.4 Staff operations

| Table or change | Key columns |
| --- | --- |
| `leave_policies` | org_id, leave_type, annual_quota |
| `leave_requests` | staff_id, leave_type, from, to, days, reason, status, decided_by, decision_note, leave_id. Approval creates the existing `staff_leaves` row, so slot blocking keeps working. |
| `attendance_records` | add `check_in_at`, `check_out_at`, `source` |
| `staff_requests` | staff_id, kind (attendance correction, availability change, credential correction, encounter amendment), payload, status, decision |
| `nurse_tasks` | org_id, branch_id, patient_id, appointment_id, title, category, priority, status, assignee, completed_by |
| `visit_handoffs` | appointment_id, vital_sign_id, note, escalated, submitted_by, acknowledged_by |
| `staff_threads`, `staff_messages`, `staff_thread_members` | internal messages about a patient or task |
| `medicines` | org_id, code, name, strength, form, route, drug_class; seeded from the admin catalogue, which then reads it from the API |
| `users` | `mobile` and `mobile_verified_at`, if staff sign in by mobile |

Existing tables already cover encounters, vitals, diagnoses, allergies, alerts, prescriptions, orders and results, referrals, care plans, incidents, invoices, payments, payroll entries (payslips) and advances (including acknowledgement).

## 4. API design

Conventions stay as today: `/v1`, Zod validation, `{ data }` or `{ error: { code, message, details, traceId } }`, optimistic locking by `version`, and an audit entry for writes. New lists use cursor pagination.

### 4.1 Patient API (`/v1/patient`)

| Area | Routes |
| --- | --- |
| Auth | `POST otp/request`, `POST otp/verify`, `POST register`, `POST logout`, `GET sessions`, `DELETE sessions/:id`, `POST sessions/revoke-others` |
| Profile | `GET/PATCH me`, `PUT/DELETE me/photo`, `GET/PUT consents`, `DELETE me` (account deletion request) |
| Clinic links | `GET links`, `POST links/code`, `DELETE links/:id` |
| Discovery | `GET clinics`, `GET clinics/:branchId`, `GET clinics/:branchId/services`, `PUT/DELETE clinics/:branchId/saved` |
| Booking | `GET clinics/:branchId/slots`, `GET appointments`, `GET appointments/:id`, `POST appointments`, `POST appointments/:id/reschedule`, `POST appointments/:id/cancel` |
| Records | `GET home`, `GET history`, `GET consultations[/:id]`, `GET prescriptions[/:id]`, `GET orders[/:id]`, `GET reports[/:id]`, `GET care-plans[/:id]`, `GET invoices`, `POST prescriptions/:id/refill-requests` |
| Inbox and help | `GET notifications`, `POST notifications/read`, `GET/PUT notification-preferences`, `PUT push-device`, `GET/POST support-tickets`, `GET support-tickets/:id` |
| Live | `GET events/stream` |

Visibility rules: consultations only when signed; prescriptions once issued; results only after clinician review; care plans without internal reviews; a record only through an active link.

### 4.2 Staff API additions

| Area | Routes |
| --- | --- |
| App auth | `POST auth/app/login`, `POST auth/app/verify` (second step) |
| Self-service | `GET me/staff`, `GET me/attendance`, `POST me/attendance/check-in`, `POST me/attendance/check-out`, `GET me/leave`, `POST me/leave-requests`, `POST me/leave-requests/:id/cancel`, `GET me/payslips[/:id]`, `GET me/advances[/:id]`, `POST me/advances/:id/acknowledge`, `GET/POST me/requests` |
| Visit flow | `GET queue`, `POST appointments/:id/call`, `POST appointments/:id/room`, `POST appointments/:id/handoff`, `POST handoffs/:id/acknowledge` |
| Nurse | `GET/POST nurse-tasks`, `POST nurse-tasks/:id/start`, `POST nurse-tasks/:id/complete` |
| Doctor | `GET doctor/inbox` (results, referrals, handoffs, messages), `GET medicines`, `GET diagnosis-codes`, `POST encounters/:id/follow-up` |
| Reception | `GET billing/desk/invoices`, `POST billing/desk/payments` (`billing.collect`) |
| Messages | `GET/POST threads`, `GET/POST threads/:id/messages`, `POST threads/:id/read` |
| Inbox and help | `GET notifications`, `POST notifications/read`, `PUT push-device`, `GET/POST support-tickets` |
| Admin | `GET/POST leave-requests`, `POST leave-requests/:id/decision`, `GET staff-requests`, `POST staff-requests/:id/decision`, `GET support-tickets`, `POST support-tickets/:id/replies`, `GET refill-requests`, `POST refill-requests/:id/decision`, `GET patients/:id/app-access`, `POST patients/:id/app-link-code`, `DELETE patients/:id/app-links/:linkId` |
| Live | `GET events/stream` |

## 5. Screen mapping

Key: **A** existing API, client work only. **B** extend an existing API. **C** new backend. **X** depends on an outside service, approval or missing design (section 6).

### 5.1 Patient app

| Screens | Data and actions | Type |
| --- | --- | --- |
| Welcome, language | Static; language choice saved to the profile. Screens stay in English (no translations exist). | C, X |
| Phone, verify | Send and check a code | C, X (SMS) |
| Account, about you, privacy | Create account, profile, consents | C |
| Home | Next appointment, recent records, linked clinics | C |
| Clinics, clinic detail | Listed branches, services, saved clinics, directions, call | C |
| Booking: service, schedule, confirmed | Fees, live slots, create booking | B |
| Appointments: list, detail, cancel, cancelled, reschedule, rescheduled | Own appointments and lifecycle; QR shows the booking reference | B |
| Health hub, history | Combined timeline | C |
| Consultations (list, detail) | Signed encounters | B |
| Prescriptions (list, detail) | Items, dispense status, refill request | B, C |
| Orders and lab reports (4) | Order progress and reviewed results | B |
| Care plans (list, detail) | Goals, interventions, next review | B |
| Notifications | Inbox | C |
| Profile, edit | Profile and photo | C |
| Notification preferences | Saved preferences | C |
| Help (index, request, confirmation) | Static answers; tickets | C |
| Security | Sessions, sign out others, app lock | C |

### 5.2 Staff app

| Screens | Data and actions | Type |
| --- | --- | --- |
| Sign in, verify | App session and second step | C |
| Doctor today, schedule, appointment | Day queue and appointments | A, B |
| Patients: queue, search, record, history, encounter | Patient search and chart | A |
| Workspace, notes, vitals, assessment | Encounter, vitals, diagnoses | A, C (code list) |
| Prescription, review | Safety checks and issue | A, C (medicines) |
| Orders, review | Diagnostic orders | A |
| Referral, care plan | Referrals and care plans | A, B |
| Follow-up, review, complete, completed | Follow-up booking, sign encounter | A, B |
| Inbox, inbox task, results | Results sign-off, alerts, referral triage | B |
| Chat | Internal staff messages | C |
| Availability, branches, credentials, security | Practitioner and staff data, change requests, sessions | A, B, C |
| Nurse today, patients, alerts, profile | Day queue, alerts | B |
| Nurse tasks | Tasks | C |
| Preparation, vitals, rooming, handoff | Vitals (existing), room and handoff (new) | A, C |
| Reception cockpit, appointments, queue | Day board, call, check-in | A, B, C |
| Register, patient directory and file | Registration with duplicate check | A |
| Book, appointment, check-in | Booking lifecycle | A |
| Billing, collect, payment | Open invoices, record payment, receipt | B |
| Attendance, leave (2) | Self-service | C |
| Salary, payslip, advances (2) | Own payroll records | B |
| Notifications, support (3) | Inbox and tickets | C |

Screens that now show one hard-coded patient (nurse preparation, reception appointment and invoice, the doctor encounter) will take the selected record's ID, which also removes the "only the sample patient" messages.

### 5.3 Admin panel additions

Built with the existing components, fonts, colours and navigation pattern.

| Screen | Purpose |
| --- | --- |
| Support inbox | Answer patient and staff requests |
| Leave approvals (in Staff) | Decide requests, set quotas |
| Staff requests (in Staff) | Corrections and amendments |
| Refill queue (in Pharmacy) | Decide refill requests |
| Patient app panel (patient record) | Issue a link code, see and revoke access |
| Patient app listing (branch configuration) | List the branch, set coordinates, choose online booking and fees |
| Live refresh | Schedule, dashboard, queues, billing, clinical worklist |

## 6. What code alone cannot deliver

| Design feature | Needs | Plan until then |
| --- | --- | --- |
| SMS sign-in codes | An SMS account and DLT-approved template | Build behind a provider interface; print codes to the console in development only |
| Push notifications | An Expo (EAS) project and a development build | In-app inbox and live stream work without it |
| ABHA linking and "ABDM" exchange | Government sandbox and certification | Store the number as unverified |
| Card or UPI gateway, patient online payment | Gateway account and contract | Reception records the UTR or approval code; nothing is marked paid by sending a link |
| Video visits, voice notes, dictation | Third-party services | Existing "not available" message |
| Wallet passes, calendar sync, QR scanning, slip printers | Native modules or hardware; calendar can follow later | Existing "not available" message |
| Home delivery, token wait-time predictions | No process or data behind them | Hidden or "not available" |
| Downloadable signed PDFs | Document generation, storage and a signing certificate | Records readable in the app; no download |
| Hindi and other languages | Translations | Preference saved only |
| Nurse intake checklist and vitals history (NUR-08, NUR-09) | Designs | Not built |

**Claims on screen.** Both apps state things such as "ISO 27001", "ABDM M3 compliant", "end-to-end encrypted", "Class 3 DSC signed", "SHA-256 hash" values, ratings and clinic counts. The product does not currently support them. Shipping them to patients would be misleading. The recommendation is to keep each layout and show only true text, as was done for the admin dashboard footer.

## 7. Security

- Server-side authorisation on every route; tests that try to cross patients, organisations, branches and realms.
- OTP: 6 digits, 5 minutes, 5 attempts, limits per number and IP, identical responses whether or not an account exists.
- Linking: a phone number alone never opens a record, because families share numbers. See decision D2.
- Audit entries for patient-record reads from the staff app, and for link, consent and session changes.
- Uploads: type and size checks; private media served only through authorised or short-lived signed links.
- Push and live events carry no health data. Logs keep today's redaction.
- Apps: SecureStore, HTTPS only in production, app lock, clear cached data at sign-out.
- Before launch: privacy policy, terms, consent wording, account deletion and a data retention schedule under India's DPDP Act. These need legal review.

## 8. Performance and scale

"Lakhs of users" is a target to prove by load test, not a property code can claim. The work:

| Priority | Item |
| --- | --- |
| 1 | Move Neon and the API to the same region near India (for example Singapore). Needs an account change and a data migration. |
| 2 | Bound the ledger, inventory and payroll state endpoints: summaries from SQL, cursor-paged registers, date windows. The admin panel computes balances from the full lists today, so its screens change with them. |
| 3 | Cursor pagination on every new list; trigram indexes for patient and staff search; indexes for each new filter. |
| 4 | Run workers as a separate process; keep the API stateless; use Neon's pooled connection. |
| 5 | Cache the public clinic directory; limit open streams per account. |
| 6 | Load test booking, patient home, the staff queue and sign-in with a stated target (concurrent users, p95 latency, error rate) on production-like hosting. |
| 7 | Production hosting: paid instances, a custom domain (`app.` and `api.`, which cookie sign-in needs), monitoring, error tracking, backups and a restore drill. |

## 9. Implementation plan

Each phase ends with typecheck, unit tests, new integration tests on the Neon test branch, admin tests and an app bundle export. Migrations are applied to the test branch; applying them to the main database needs your approval.

| Phase | Work | Done when |
| --- | --- | --- |
| 0. Safety | Commit the existing work (with approval); fix the `doctor-app` typecheck; run the integration suite for a baseline | Clean baseline |
| 1. Platform | App sessions, patient realm, event stream, notifications, shared app API client (errors, sign-out, offline and retry states) | Cross-realm and isolation tests pass |
| 2. Patient: access and booking | Onboarding, profile, clinic linking, discovery, booking lifecycle, admin listing and link screens, live schedule | A patient booking appears in the admin schedule without reload, and staff changes reach the app |
| 3. Patient: records and help | Records, refills, notifications, preferences, support; admin support inbox and refill queue | Only released records are visible |
| 4. Staff: sign-in and reception | Roles, day board, queue, registration, booking, check-in, desk billing | A visit runs from booking to payment |
| 5. Staff: nurse and doctor | Tasks, vitals, rooming, handoff, encounter through signing, inbox, messages | A visit runs from check-in to a signed record the patient can read |
| 6. Staff: self-service | Attendance, leave, payslips, advances, requests; admin approvals | Approved leave blocks booking slots |
| 7. Mock removal | Delete `src/data` samples and demo roles, correct on-screen claims, add loading, empty and error states | No sample data in either app |
| 8. Scale and release | Section 8, security review, device testing, store builds, runbook | Load targets met on production hosting |

Every phase leaves the admin panel working. The screen designs do not change except for true text, real data and the loading, empty and error states that real data needs.

### 9.1 Verification limits

- This machine has no Android or iOS device or emulator. Apps can be checked by typecheck, bundle export and click-through in a web build. Testing on real devices is still required.
- Live SMS, email delivery to patients, push and provider integrations stay unverified until accounts exist.
- This is a large programme that will take several working sessions. Each phase can be reviewed and shipped separately.

## 10. Decisions needed

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | How sign-in codes are delivered, and how staff sign in | MSG91 SMS behind a provider interface; staff use mobile and password as designed, then a code |
| D2 | How a patient account reaches a clinic record | Automatic only when the verified mobile **and** date of birth match exactly one record; otherwise a one-time code issued at the clinic desk |
| D3 | Unsupported claims and unavailable features | Keep layouts, show only true text |
| D4 | What to build first | Platform, then the patient app, then the staff app |
