import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual, Roles } from '../miembros/miembros.decorators';
import { ConocimientoService } from './conocimiento.service';
import { RespuestaDto, TextoDto } from './dto/conocimiento.dto';
import { EstadoPregunta } from './pregunta.entity';

const MAX_ARCHIVO = 10 * 1024 * 1024;
const ESTADOS: EstadoPregunta[] = [
  'abierta',
  'respondida',
  'aprobada',
  'descartada',
];

@Controller()
export class ConocimientoController {
  constructor(private readonly svc: ConocimientoService) {}

  @Get('conocimiento')
  listar(@MiembroActual() m: Miembro) {
    return this.svc.listar(m.tenant);
  }

  @Post('conocimiento/texto')
  @Roles('gerente')
  texto(@MiembroActual() m: Miembro, @Body() dto: TextoDto) {
    return this.svc.agregar(m.tenant, {
      titulo: dto.titulo,
      tipo: 'texto',
      texto: dto.texto,
    });
  }

  @Post('conocimiento/archivo')
  @Roles('gerente')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_ARCHIVO } }),
  )
  archivo(
    @MiembroActual() m: Miembro,
    @UploadedFile() f: Express.Multer.File | undefined,
    @Body('titulo') titulo?: string,
  ) {
    if (!f) throw new BadRequestException('Falta el archivo');
    return this.svc.agregarArchivo(
      m.tenant,
      (typeof titulo === 'string' && titulo.trim()) || f.originalname,
      f.originalname,
      f.buffer,
      f.mimetype,
    );
  }

  @Get('conocimiento/:id/imagen')
  async imagen(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const img = await this.svc.imagen(m.tenant, id);
    return new StreamableFile(img.archivo, { type: img.mime });
  }

  @Delete('conocimiento/:id')
  @Roles('gerente')
  borrar(@MiembroActual() m: Miembro, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.borrar(m.tenant, id);
  }

  @Get('preguntas')
  preguntas(@MiembroActual() m: Miembro, @Query('estado') estado?: string) {
    return this.svc.listarPreguntas(
      m.tenant,
      ESTADOS.find((e) => e === estado),
    );
  }

  @Put('preguntas/:id/respuesta')
  responder(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespuestaDto,
  ) {
    return this.svc.responderPregunta(m.tenant, id, dto.respuesta);
  }

  @Post('preguntas/:id/aprobar')
  @Roles('gerente')
  aprobar(@MiembroActual() m: Miembro, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.aprobarPregunta(m.tenant, id);
  }

  @Post('preguntas/:id/descartar')
  @Roles('gerente')
  descartar(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.descartarPregunta(m.tenant, id);
  }
}
