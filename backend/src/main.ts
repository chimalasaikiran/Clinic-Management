import 'reflect-metadata'
import { createApp } from './app.factory'
import { loadEnv } from './config/env'

async function bootstrap() {
  const env = loadEnv()
  const app = await createApp(env)
  await app.listen(env.PORT, '0.0.0.0')
}

bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
