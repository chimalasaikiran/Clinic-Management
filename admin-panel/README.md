# ClinicOS Admin Panel

Frontend for the ClinicOS workspace. Built with React 19, Vite, Tailwind CSS 4 and React Router.
It talks to the ClinicOS backend in `../backend` over versioned REST (`/v1`).

## Getting started

Copy `.env.example` to `.env.local` and set `VITE_API_URL` (the backend URL, `http://localhost:4000` locally).
That is the only setting: the app holds no secrets. Start the backend as described in `../backend/README.md`.

Sign-in uses an HttpOnly session cookie set by the backend; the app never sees or stores a token.
Requests are sent with `credentials: 'include'` (see `src/lib/api.js`).

```
npm install
npm run dev      # start the dev server
npm run lint     # oxlint
npm test         # vitest
npm run build    # production build
```

## Project structure

```
src/
  app/                 router and app entry
  assets/              icons and images exported from the design
  components/
    layout/            shared page chrome (top bar, form and photo panels)
    ui/                reusable inputs, buttons and cards
  config/routes.js     route paths
  config/access.js     which permission opens each workspace section
  features/
    auth/              sign-in, sign-up, email verification, password reset, invitations, session provider, route guards
    role-management/   roles and permissions (API-backed)
    onboarding/        setup intro, clinic details, operating model, specialties, setup complete
    dashboard/         owner dashboard (layout, sections, mock data)
  hooks/               shared hooks
  lib/                 API client, class-name helper and input validators
  test/                test setup and helpers
```

## Status

- Authentication, sessions, route protection, role management and staff invitations run against the backend.
  The sidebar and route guards hide sections a role cannot open; the backend enforces the same permissions.
- The other modules (patients, billing, inventory, payroll, growth, configuration, dashboard) still use sample
  data held in memory until their APIs are built.
- Tests render pages with a signed-in Super Admin by default (`src/test/auth.js`); pass another session to
  `renderRoute` to test other roles or a signed-out visitor.
