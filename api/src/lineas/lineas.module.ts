import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Miembro } from '../miembros/miembro.entity';
import { LineaProducto } from './linea-producto.entity';
import { LineasController } from './lineas.controller';
import { LineasService } from './lineas.service';

@Module({
  imports: [TypeOrmModule.forFeature([LineaProducto, Miembro])],
  controllers: [LineasController],
  providers: [LineasService],
  exports: [LineasService],
})
export class LineasModule {}
