import { Module } from '@nestjs/common';
import { AnunciosModule } from '../anuncios/anuncios.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [AnunciosModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
