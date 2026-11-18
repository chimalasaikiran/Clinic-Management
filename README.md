# Clinic-Management

ClinicOS: a clinic operations workspace.

| Folder | What | Docs |
| --- | --- | --- |
| [`backend/`](backend/) | REST API: authentication, sessions, organisations, roles, permissions, invitations. NestJS, Prisma, Neon PostgreSQL. | [backend/README.md](backend/README.md) |
| [`admin-panel/`](admin-panel/) | Web app (React, Vite, Tailwind). Talks to the backend over `/v1` REST. | [admin-panel/README.md](admin-panel/README.md) |

Quick start: set up Neon and `backend/backend.env` (backend README, sections 3–5), then run `npm run dev` in
`backend/` and in `admin-panel/`.

Secrets live only in `backend/backend.env` (git-ignored) or a secret manager. Only the `*.example` files are committed.
