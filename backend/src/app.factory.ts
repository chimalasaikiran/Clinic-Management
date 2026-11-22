import { INestApplication, LoggerService, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import cookieParser from 'cookie-parser'
import type { Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import pino from 'pino'
import pinoHttp from 'pino-http'
import { AppModule } from './app.module'
import { originCheck } from './common/middleware/origin-check.middleware'
import { requestContext } from './common/middleware/request-context.middleware'
import type { AppRequest } from './common/utils/request'
import { Env } from './config/env'
import { sessionCookieName } from './modules/auth/session-cookie'

export function createLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    // Credentials and personal data never reach the logs.
    redact: {
      paths: ['req.headers.cookie', 'res.headers["set-cookie"]', '*.password', '*.currentPassword', '*.newPassword', '*.token', '*.code'],
      censor: '[redacted]',
    },
    base: { service: 'clinicos-backend' },
  })
}

// Nest's Logger is called two ways in this code base: logger.warn('text') and, pino-style,
// logger.warn({ err }, 'text'). Both end up as structured JSON lines with the Nest context attached.
function nestLogger(logger: pino.Logger): LoggerService {
  const write =
    (level: 'info' | 'error' | 'warn' | 'debug' | 'trace') =>
    (message: unknown, ...rest: unknown[]) => {
      const context = typeof rest.at(-1) === 'string' ? (rest.at(-1) as string) : undefined
      const text = rest.filter((part): part is string => typeof part === 'string' && part !== context)
      if (typeof message === 'object' && message !== null) logger[level]({ ...message, context }, text.join(' ') || context || '')
      else logger[level]({ context }, String(message))
    }
  return { log: write('info'), error: write('error'), warn: write('warn'), debug: write('debug'), verbose: write('trace') }
}

// HTTP hardening shared by the real server and the integration tests. Order matters.
export function configureHttp(app: NestExpressApplication, env: Env, logger: pino.Logger) {
  app.set('trust proxy', env.TRUST_PROXY)
  app.disable('x-powered-by')
  app.use(requestContext)
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as AppRequest).traceId,
      customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  )
  app.use(helmet())
  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Org-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  })
  // Coarse per-instance flood protection. Sensitive endpoints also have shared, per-account limits in Postgres.
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req: Request, res: Response) =>
        res.status(429).json({
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.', details: [], traceId: (req as AppRequest).traceId },
        }),
    }),
  )
  app.use(cookieParser())
  // rawBody (set when the app is created) keeps the exact bytes, so webhook signatures can be checked.
  app.useBodyParser('json', { limit: '100kb' })
  // Post images are uploaded as the raw request body (POST /v1/media). Slightly over 5 MB so the service, not the
  // parser, gives the clear "at most 5 MB" message.
  app.useBodyParser('raw', { type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5200kb' })
  // Insurance agreement PDFs (POST /v1/insurance/documents), at most 10 MB.
  app.useBodyParser('raw', { type: 'application/pdf', limit: '10300kb' })
  app.use(originCheck(env.CORS_ORIGINS, sessionCookieName(env)))
  app.enableVersioning({ type: VersioningType.URI })
  app.enableShutdownHooks()
  return app
}

export async function createApp(env: Env): Promise<INestApplication> {
  const logger = createLogger(env)
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env), { bodyParser: false, rawBody: true, logger: nestLogger(logger) })
  return configureHttp(app, env, logger)
}

// Integration tests build the same application with selected providers replaced (for example the mail sender).
export async function createTestApp(env: Env, overrides: Array<{ provide: unknown; useValue: unknown }> = []) {
  let builder = Test.createTestingModule({ imports: [AppModule.register(env)] })
  for (const override of overrides) builder = builder.overrideProvider(override.provide).useValue(override.useValue)
  const moduleRef = await builder.compile()
  const logger = createLogger(env)
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, rawBody: true, logger: nestLogger(logger) })
  configureHttp(app, env, logger)
  await app.init()
  return app
}
