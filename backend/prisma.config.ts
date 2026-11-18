import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma CLI settings (generate, migrate, studio). Locally the CLI reads credentials from backend.env;
// in CI, production and the integration-test setup the variables come from the environment instead
// (the test setup sets SKIP_ENV_FILE so it can never migrate the main database by accident).
const envFile = path.resolve('backend.env')
if (!process.env.SKIP_ENV_FILE && existsSync(envFile)) process.loadEnvFile(envFile)

// Migrations use Neon's direct (non-pooled) connection: schema changes need a session-level connection,
// which the PgBouncer pooler does not provide. The running API uses the pooled DATABASE_URL.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { path: path.join('prisma', 'migrations') },
  datasource: {
    url: process.env.DIRECT_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
