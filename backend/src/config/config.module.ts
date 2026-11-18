import { DynamicModule, Global, Module } from '@nestjs/common'
import { ENV, Env } from './env'

// Makes the validated configuration injectable everywhere with @Inject(ENV).
@Global()
@Module({})
export class ConfigModule {
  static register(env: Env): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: ENV, useValue: env }], exports: [ENV] }
  }
}
