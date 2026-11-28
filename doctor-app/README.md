# Clinic OS: Staff App

One mobile app for clinic staff, built with Expo (SDK 58), Expo Router and NativeWind. It talks to the
ClinicOS API in `../backend`. After signing in, a person sees the workspace their role's permissions open:
doctor, reception or nurse.

## Access control

The server decides everything. The app only picks which screens to show first:

| Workspace | Opens when the person has |
| --- | --- |
| Doctor | `clinical.write` and an active practitioner profile |
| Reception | `bookings.view` and `bookings.create` |
| Nurse | `clinical.vitals` |

Someone who qualifies for more than one can switch from their profile. Someone who qualifies for none is told
to use the admin panel. Reception screens never receive clinical detail.

## Run it

Needs Node 22.13 or newer, and the API running (see `../backend/README.md`).

```bash
npm install
EXPO_PUBLIC_API_URL=http://<your-computer-ip>:4000 npm start   # then scan the QR code with Expo Go
npm run android    # the Android emulator reaches the computer at http://10.0.2.2:4000
npm run typecheck
npx expo lint
```

Without `EXPO_PUBLIC_API_URL` the app uses `http://localhost:4000`, which only works on the same machine.

## Signing in

1. In the admin panel, add the person under Staff with their **mobile number**, give them a branch and invite
   them with a role. They accept the invitation and set a password.
2. In the app, they enter that mobile number and password, then the 6-digit code sent by SMS.

Without MSG91 keys, a development API prints the code in its console instead of sending it. The app's sign-in
routes refuse web browsers. Sessions end after 12 hours idle or 7 days. If two people share a mobile number,
neither can sign in with it until the staff records are corrected.

## What each workspace does

- **Reception:** today's desk, appointments (confirm, check in, reschedule, cancel, no-show), booking into real
  open slots, registration with a duplicate check, patient files, walk-in tokens and the queue board.
- **Doctor:** today's patients and schedule, chart and history, the consultation (notes, vitals, assessment,
  prescription, investigation orders, referral, care plan, follow-up, signing), result review, alerts, the
  clinical inbox, and the account screens.
- **Nurse:** today's queue, vital signs entry, specimen collection, chart alerts and notifications, and a
  preparation view of each checked-in patient.

Every role also has its own **attendance, leave, salary and advances**, notifications and help. These show only
the signed-in person's records. Staff can confirm they received a salary advance, which starts its recovery from
pay.

Workspace screens update on their own when records change on another device or in the admin panel. Attendance,
leave and pay reload when you open them.

## Not available yet

These screens say so instead of pretending: collecting payments in the app, messaging with patients or the care
team, dictation, rooming and patient transfers, nursing handoff notes and escalations, ward tasks, and slot
blocking by doctors. Vital readings outside the usual range are highlighted for the nurse, but nothing is sent.
Staff cannot check in or out, request leave or an advance, send a support request, download a PDF payslip or
choose notification channels.

## Layout

| Folder | Contents |
| --- | --- |
| `src/app` | Screens and navigation (one file per route; see also `reception/` and `nurse/`) |
| `src/components` | Shared layout, form and UI components |
| `src/features` | Code used by one area; `reception/desk.tsx`, `doctor/clinical.ts` and `nurse/ward.ts` hold each workspace's API types and logic |
| `src/state` | The signed-in session, live updates and unsent consultation drafts |
| `src/lib`, `src/hooks` | The API client, live stream, data loading and validation |
| `src/data` | The consultation steps, how a staff member is shown, and the help answers |
| `src/theme` | Colours and the icon list |
| `assets` | Icons and images from the design |

Reception, nurse and the shared staff screens use the Material icon set in `@expo/vector-icons`. The
attendance, leave and pay screens use Inter, as designed.

In a web build the session token is kept in memory only, so reloading the page signs out.
