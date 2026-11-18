import { Global, Module } from '@nestjs/common'
import { CountersRepository } from './counters.repository'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService, CountersRepository],
  exports: [PrismaService, CountersRepository],
})
export class DatabaseModule {}
