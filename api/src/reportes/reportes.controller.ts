import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual, Roles } from '../miembros/miembros.decorators';
import { FiltroKpis, ReportesService } from './reportes.service';

class FiltroKpisDto {
  @IsDateString() desde: string;
  @IsDateString() hasta: string;
  @IsOptional() @IsUUID() lineaId?: string;
  @IsOptional() @IsUUID() duenoId?: string;
  @IsOptional() @IsIn(['anuncio', 'organico']) origen?: 'anuncio' | 'organico';
}

const filtro = (q: FiltroKpisDto): FiltroKpis => ({
  ...q,
  desde: new Date(q.desde),
  hasta: new Date(q.hasta),
});

@Controller('panel')
@Roles('gerente')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('kpis')
  kpis(@MiembroActual() m: Miembro, @Query() q: FiltroKpisDto) {
    return this.reportes.kpis(m, filtro(q));
  }

  @Get('excel')
  @Header('Content-Disposition', 'attachment; filename="leads-arm.xlsx"')
  async excel(@MiembroActual() m: Miembro, @Query() q: FiltroKpisDto) {
    return new StreamableFile(await this.reportes.excel(m, filtro(q)), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}
