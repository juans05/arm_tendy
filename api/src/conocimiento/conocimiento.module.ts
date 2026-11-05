import { Module } from '@nestjs/common';
import { ConocimientoController } from './conocimiento.controller';
import { ConocimientoService } from './conocimiento.service';

@Module({
  controllers: [ConocimientoController],
  providers: [ConocimientoService],
  exports: [ConocimientoService],
})
export class ConocimientoModule {}
