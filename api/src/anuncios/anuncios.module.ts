import { Module } from '@nestjs/common';
import { CanalesModule } from '../canales/canales.module';
import { AnunciosController } from './anuncios.controller';
import { AnunciosService } from './anuncios.service';

@Module({
  imports: [CanalesModule],
  controllers: [AnunciosController],
  providers: [AnunciosService],
  exports: [AnunciosService],
})
export class AnunciosModule {}
