import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { IaService } from '../ia/ia.service';
import { trazar } from '../ia/traza';
import { ConocimientoDoc, TipoDoc } from './conocimiento-doc.entity';
import { extraerTexto, tipoDeArchivo, trocear } from './extraer';
import { EstadoPregunta, Pregunta } from './pregunta.entity';

type NuevoDoc = {
  titulo: string;
  tipo: TipoDoc;
  texto: string;
  archivo?: Buffer;
  mime?: string;
};

// ponytail: tope por documento para no llenar la base ni gastar embeddings sin control.
const MAX_FRAGMENTOS = 400;

@Injectable()
export class ConocimientoService {
  constructor(
    private readonly db: DataSource,
    private readonly ia: IaService,
  ) {}

  listar(tenant: string): Promise<ConocimientoDoc[]> {
    return this.db.getRepository(ConocimientoDoc).find({
      where: { tenant },
      order: { createdAt: 'DESC' },
    });
  }

  async agregar(tenant: string, d: NuevoDoc): Promise<ConocimientoDoc> {
    const texto = d.texto.trim();
    if (!texto) throw new BadRequestException('El documento no tiene texto');
    const fragmentos = trocear(texto).slice(0, MAX_FRAGMENTOS);
    // Fuera de la transacción: llamar a la IA puede tardar segundos.
    const vectores = await this.ia.embeddings(fragmentos);
    return this.db.transaction(async (em) => {
      const doc = await em.save(
        em.create(ConocimientoDoc, {
          tenant,
          titulo: d.titulo.trim().slice(0, 200) || 'Sin título',
          tipo: d.tipo,
          texto,
          archivo: d.archivo ?? null,
          mime: d.mime ?? null,
        }),
      );
      for (const [i, f] of fragmentos.entries()) {
        await em.query(
          `INSERT INTO conocimiento_fragmentos (tenant, doc_id, texto, embedding) VALUES ($1, $2, $3, $4)`,
          [tenant, doc.id, f, vectores ? JSON.stringify(vectores[i]) : null],
        );
      }
      delete (doc as Partial<ConocimientoDoc>).archivo;
      return doc;
    });
  }

  async agregarArchivo(
    tenant: string,
    titulo: string,
    nombre: string,
    datos: Buffer,
    mime: string,
  ): Promise<ConocimientoDoc> {
    const tipo = tipoDeArchivo(nombre);
    if (!tipo)
      throw new BadRequestException(
        'Formato no soportado: sube Word, Excel, PDF, PNG o JPG',
      );
    if (tipo === 'imagen') {
      const texto = await this.describirImagen(tenant, datos, mime);
      return this.agregar(tenant, {
        titulo,
        tipo,
        texto,
        archivo: datos,
        mime,
      });
    }
    let texto: string;
    try {
      texto = await extraerTexto(tipo, datos);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo');
    }
    return this.agregar(tenant, { titulo, tipo, texto });
  }

  private async describirImagen(
    tenant: string,
    datos: Buffer,
    mime: string,
  ): Promise<string> {
    if (!this.ia.activa())
      throw new BadRequestException('Configura la IA para poder leer imágenes');
    const r = await trazar(
      this.db,
      { tenant, conversacionId: null, tipo: 'imagen' },
      () =>
        this.ia.chat(
          [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe todo el texto visible de esta imagen (precios, planes, condiciones) y luego describe en dos líneas qué muestra, para que un vendedor sepa cuándo enviarla a un cliente.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mime};base64,${datos.toString('base64')}`,
                  },
                },
              ],
            },
          ],
          { maxTokens: 1500, modelo: process.env.AI_VISION_MODEL },
        ),
    );
    return r.texto;
  }

  /**
   * Fragmentos más parecidos a la consulta, siempre de la misma empresa. Con embeddings usa pgvector;
   * sin ellos, la búsqueda de texto en español de Postgres.
   */
  async buscar(tenant: string, consulta: string, k = 6): Promise<string[]> {
    const v = consulta.trim() ? await this.ia.embeddings([consulta]) : null;
    const filas: { texto: string }[] = v
      ? await this.db.query(
          `SELECT texto FROM conocimiento_fragmentos
            WHERE tenant = $1 AND embedding IS NOT NULL
            ORDER BY embedding <=> $2::vector LIMIT $3`,
          [tenant, JSON.stringify(v[0]), k],
        )
      : // Cualquier palabra de la consulta (OR), ordenado por relevancia: una pregunta natural nunca trae todas.
        await this.db.query(
          `WITH q AS (SELECT replace(plainto_tsquery('spanish', $2)::text, '&', '|')::tsquery AS q)
           SELECT texto FROM conocimiento_fragmentos, q
            WHERE tenant = $1 AND to_tsvector('spanish', texto) @@ q.q
            ORDER BY ts_rank(to_tsvector('spanish', texto), q.q) DESC
            LIMIT $3`,
          [tenant, consulta, k],
        );
    return filas.map((f) => f.texto);
  }

  async borrar(tenant: string, id: string): Promise<void> {
    const r = await this.db
      .getRepository(ConocimientoDoc)
      .delete({ tenant, id });
    if (!r.affected) throw new NotFoundException('Documento no encontrado');
  }

  /** Imagen guardada de la base, para que la IA o un humano la envíen. */
  async imagen(
    tenant: string,
    id: string,
  ): Promise<{ archivo: Buffer; mime: string; titulo: string }> {
    const d = await this.db
      .getRepository(ConocimientoDoc)
      .createQueryBuilder('d')
      .addSelect('d.archivo')
      .where('d.tenant = :tenant AND d.id = :id AND d.tipo = :tipo', {
        tenant,
        id,
        tipo: 'imagen',
      })
      .getOne();
    if (!d?.archivo || !d.mime)
      throw new NotFoundException('Imagen no encontrada');
    return { archivo: d.archivo, mime: d.mime, titulo: d.titulo };
  }

  // --- Preguntas sin respuesta ---

  async crearPregunta(
    tenant: string,
    conversacionId: string | null,
    pregunta: string,
  ): Promise<Pregunta> {
    const repo = this.db.getRepository(Pregunta);
    const texto = pregunta.trim().slice(0, 1000);
    const existente = await repo.findOneBy({
      tenant,
      conversacionId: conversacionId ?? IsNull(),
      pregunta: texto,
      estado: 'abierta',
    });
    return (
      existente ??
      repo.save(repo.create({ tenant, conversacionId, pregunta: texto }))
    );
  }

  listarPreguntas(
    tenant: string,
    estado?: EstadoPregunta,
  ): Promise<Pregunta[]> {
    return this.db.getRepository(Pregunta).find({
      where: { tenant, ...(estado ? { estado } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async responderPregunta(
    tenant: string,
    id: string,
    respuesta: string,
  ): Promise<Pregunta> {
    const p = await this.pregunta(tenant, id);
    p.respuesta = respuesta.trim();
    p.estado = 'respondida';
    return this.db.getRepository(Pregunta).save(p);
  }

  /** Nada se aprende sin aprobación humana: el gerente decide qué pasa a la base. */
  async aprobarPregunta(tenant: string, id: string): Promise<Pregunta> {
    const p = await this.pregunta(tenant, id);
    if (!p.respuesta)
      throw new BadRequestException('Primero escribe la respuesta');
    await this.agregar(tenant, {
      titulo: `Pregunta frecuente: ${p.pregunta}`.slice(0, 200),
      tipo: 'texto',
      texto: `Pregunta: ${p.pregunta}\nRespuesta: ${p.respuesta}`,
    });
    p.estado = 'aprobada';
    return this.db.getRepository(Pregunta).save(p);
  }

  async descartarPregunta(tenant: string, id: string): Promise<Pregunta> {
    const p = await this.pregunta(tenant, id);
    p.estado = 'descartada';
    return this.db.getRepository(Pregunta).save(p);
  }

  private async pregunta(tenant: string, id: string): Promise<Pregunta> {
    const p = await this.db.getRepository(Pregunta).findOneBy({ tenant, id });
    if (!p) throw new NotFoundException('Pregunta no encontrada');
    return p;
  }
}
