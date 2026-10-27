# ClinicOS Admin Panel

Frontend for the ClinicOS workspace: account onboarding, clinic setup and the owner dashboard.
Built with React 19, Vite, Tailwind CSS 4 and React Router.

## Getting started

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
  features/
    auth/              create account and verify account
    onboarding/        setup intro, clinic details, operating model, specialties, setup complete
    dashboard/         owner dashboard (layout, sections, mock data)
  hooks/               shared hooks
  lib/                 class-name helper and input validators
  test/                test setup and helpers
```

## Status

This is a frontend-only build. There is no authentication, API or database yet:

- Forms validate input on the client and then move to the next step; nothing is submitted anywhere.
- The dashboard reads from `src/features/dashboard/data/mockDashboardData.js`. Replace those exports with
  API calls when the backend exists; the section components take their data as props.
- "Sign in", the resend-code link and the dashboard shortcut buttons are not wired up.
