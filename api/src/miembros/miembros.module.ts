import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Miembro } from './miembro.entity';
import { MiembrosController } from './miembros.controller';
import { MiembrosService } from './miembros.service';

@Module({
  imports: [TypeOrmModule.forFeature([Miembro])],
  controllers: [MiembrosController],
  providers: [MiembrosService],
  exports: [MiembrosService],
})
export class MiembrosModule {}
