import { Global, Module } from '@nestjs/common';
import { jwksProvider } from './jwks.provider';

// Los guards globales se registran en AppModule, en orden: SuiteAuth → MiembroActivo → Roles.
@Global()
@Module({
  providers: [jwksProvider],
  exports: [jwksProvider],
})
export class AuthModule {}
