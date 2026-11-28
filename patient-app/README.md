# Clinic OS: Patient App

The patient-facing mobile app, built with Expo (SDK 58), Expo Router and NativeWind.

The app is being connected to the ClinicOS API in stages (see
[`../docs/integration-plan.md`](../docs/integration-plan.md)).

| Connected to the API | Still sample data |
| --- | --- |
| Sign-in and registration, profile, consent choices, signed-in devices, log out, connected clinics, home, finding clinics, booking, appointments, rescheduling, cancelling, notifications, live updates, health records (consultations, prescriptions, orders, lab reports, care plans, history), refill requests, help requests | Notification preferences |

**Do not release it to patients yet.** A signed-in person still sees sample records on the
screens in the second column. The language choice is also still kept on the device only.

## Run it

Needs Node 22.13 or newer.

```bash
npm install
# the API address: a phone needs your computer's network address; the Android emulator uses 10.0.2.2
echo EXPO_PUBLIC_API_URL=http://192.168.1.10:4000 > .env.local
npm start          # then scan the QR code with Expo Go
npm run android    # open on a connected Android device or emulator
npm run ios        # open on the iOS simulator (macOS only)
npm run typecheck
```

## Trying the flows

- **Verification code:** start the API (`npm run dev` in `../backend`). Without MSG91 settings, each
  code is printed in the API console.
- **Connecting a clinic record:** in the admin panel, either list the branch under Configuration so a
  record with the same mobile number and date of birth connects by itself, or issue a connection code
  on the patient's record and enter it under Profile, then Connect Another Clinic.
- **Booking:** a clinic appears once a branch is listed (Configuration, Patient app). For it to take bookings,
  turn on *Accepts bookings from the patient app* for a therapist (Staff, OPD schedule) with hours at that
  branch, and *Patients can book this in the patient app* for an active service in the same department
  (Billing, Services). Booking registers a new patient when the clinic has no record of them; it asks for a
  desk code when a record might already be theirs.
- **Live updates:** while the app is open, changes the clinic makes appear without pulling to refresh.
- **Web build:** `react-native-web` is not a dependency. To try the app in a browser, install it first and
  add the web address to `CORS_ORIGINS` on the API. A browser forgets the sign-in on reload.
- **Health records:** shown once the clinic releases them: consultations when signed, prescriptions when issued, test results after a doctor's review, care plans without the care team's review notes.
- **Refills and help:** refill requests go to the clinic's pharmacy queue (admin panel, Pharmacy, Refill Requests); help requests go to its help inbox (Patients, Help Requests). Replies come back in the app.
- **Sample data:** the notification preferences screen still shows sample content.

Actions that need a service (downloads, calendar and wallet sync, spoken guidance,
location) show a short message saying they are not available yet.

## Layout

| Folder | Contents |
| --- | --- |
| `src/app` | Screens and navigation (one file per route) |
| `src/components` | Shared layout, form and UI components |
| `src/features` | Components used by one area of the app |
| `src/data` | Sample records for screens not yet connected |
| `src/state` | Signed-in session, live updates, and the choices made while booking |
| `src/lib`, `src/hooks` | Dates, validation and small helpers |
| `src/theme` | Colours and the icon list |
| `assets` | Icons and photos exported from the design |

`src/theme/icons.ts` lists the files in `assets/icons` with their design sizes. Add an
entry there when you add an icon.
