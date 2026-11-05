import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { jwksProvider } from './jwks.provider';
import { SuiteAuthGuard } from './suite-auth.guard';

@Global()
@Module({
  providers: [jwksProvider, { provide: APP_GUARD, useClass: SuiteAuthGuard }],
  exports: [jwksProvider],
})
export class AuthModule {}
