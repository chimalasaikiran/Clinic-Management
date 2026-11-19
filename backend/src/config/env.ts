import { z } from 'zod'

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
)

const bool = z.enum(['true', 'false']).transform((value) => value === 'true')

const postgresUrl = z
  .string({ error: 'is required' })
  .min(1, 'is required')
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must be a postgresql:// connection string')
  .refine((value) => !/USER:PASSWORD|ep-XXXX/.test(value), 'still contains the placeholder from backend.env.example')

const EMAILJS_KEYS = ['EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_PRIVATE_KEY'] as const

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    // Pooled Neon connection for the running API. Migrations use DIRECT_URL through prisma.config.ts.
    DATABASE_URL: postgresUrl,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    // Longest a transaction may run. Every statement is a round trip, so a distant database region needs more.
    DATABASE_TX_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(10_000),

    CORS_ORIGINS: csv.pipe(z.array(z.url()).min(1)),
    APP_URL: z.url(),

    TOKEN_PEPPER: z.string({ error: 'is required' }).min(32, 'must be at least 32 characters'),

    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
    SESSION_MAX_AGE_HOURS: z.coerce.number().positive().max(24 * 30).default(12),
    COOKIE_SECURE: bool.default(false),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    // Email delivery: EmailJS (all four EMAILJS_ values) or SMTP (SMTP_URL + MAIL_FROM). Neither: printed to the console.
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    EMAILJS_SERVICE_ID: z.string().optional(),
    EMAILJS_TEMPLATE_ID: z.string().optional(),
    EMAILJS_PUBLIC_KEY: z.string().optional(),
    EMAILJS_PRIVATE_KEY: z.string().optional(),

    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // Messaging (Growth). The key encrypts each organisation's WhatsApp, SMS and email credentials: 32 random bytes,
    // base64. Without it no channel can be connected. The worker sends queued messages; tests turn it off.
    MESSAGING_SECRET_KEY: z
      .string()
      .optional()
      .refine((value) => !value || Buffer.from(value, 'base64').length === 32, 'must be 32 random bytes, base64-encoded'),
    MESSAGING_WORKER: bool.default(true),
    // Where providers reach this API, shown on the Channels screen as the webhook address (an https tunnel in development).
    PUBLIC_API_URL: z.url().optional(),
    // Neon's direct (unpooled) connection, used only to LISTEN for live updates from other API instances.
    REALTIME_DATABASE_URL: postgresUrl.optional(),

    // Local time zone of the clinics: appointment slots and dates are shown and generated in this zone.
    CLINIC_TIMEZONE: z
      .string()
      .default('Asia/Kolkata')
      .refine((zone) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: zone })
          return true
        } catch {
          return false
        }
      }, 'must be an IANA time zone such as Asia/Kolkata'),
  })
  .superRefine((env, ctx) => {
    const problem = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) problem('COOKIE_SAMESITE', '"none" requires COOKIE_SECURE=true')

    const emailJs = EMAILJS_KEYS.filter((key) => env[key])
    if (emailJs.length > 0 && emailJs.length < EMAILJS_KEYS.length) {
      for (const key of EMAILJS_KEYS) if (!env[key]) problem(key, 'is required when any EMAILJS_ setting is set')
    }
    if (env.NODE_ENV !== 'production') return

    if (!env.COOKIE_SECURE) problem('COOKIE_SECURE', 'must be true in production')
    if (emailJs.length === 0) {
      if (!env.SMTP_URL) problem('SMTP_URL', 'is required in production (or configure the EMAILJS_ settings)')
      if (!env.MAIL_FROM) problem('MAIL_FROM', 'is required in production when sending through SMTP')
    }
    if (!env.APP_URL.startsWith('https://')) problem('APP_URL', 'must use https in production')
    if (env.CORS_ORIGINS.some((origin) => !origin.startsWith('https://'))) problem('CORS_ORIGINS', 'must use https in production')
  })

export type Env = z.infer<typeof schema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Empty values in an env file mean "not set", so defaults and optional checks apply.
  const values = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''))
  const result = schema.safeParse(values)
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Invalid backend configuration (check backend/backend.env):\n${problems}`)
  }
  return result.data
}

export const ENV = Symbol('ENV')
