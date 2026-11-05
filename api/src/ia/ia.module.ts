import { Global, Module } from '@nestjs/common';
import { IaService, proveedoresDesdeEnv } from './ia.service';

@Global()
@Module({
  providers: [
    {
      provide: IaService,
      useFactory: () => new IaService(proveedoresDesdeEnv()),
    },
  ],
  exports: [IaService],
})
export class IaModule {}
