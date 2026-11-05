import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { TipoDoc } from './conocimiento-doc.entity';

const EXTENSIONES: Record<string, Exclude<TipoDoc, 'texto'>> = {
  docx: 'docx',
  xlsx: 'xlsx',
  xls: 'xlsx',
  pdf: 'pdf',
  png: 'imagen',
  jpg: 'imagen',
  jpeg: 'imagen',
  webp: 'imagen',
};

export const tipoDeArchivo = (
  nombre: string,
): Exclude<TipoDoc, 'texto'> | null =>
  EXTENSIONES[nombre.split('.').pop()?.toLowerCase() ?? ''] ?? null;

/** Texto de un archivo de oficina. Las imágenes las describe la IA (ver ConocimientoService). */
export async function extraerTexto(
  tipo: 'docx' | 'xlsx' | 'pdf',
  datos: Buffer,
): Promise<string> {
  if (tipo === 'docx')
    return (await mammoth.extractRawText({ buffer: datos })).value;
  if (tipo === 'pdf') {
    const pdf = new PDFParse({ data: datos });
    try {
      return (await pdf.getText()).text;
    } finally {
      await pdf.destroy();
    }
  }
  // Excel: cada fila como "columna: valor; …" para que la IA no mezcle datos de filas distintas.
  const libro = XLSX.read(datos, { type: 'buffer' });
  return libro.SheetNames.map((hoja) => {
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      libro.Sheets[hoja],
      { defval: '' },
    );
    return [
      `Hoja: ${hoja}`,
      ...filas.map((f) =>
        Object.entries(f)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join('; '),
      ),
    ].join('\n');
  }).join('\n\n');
}

/** Fragmentos de hasta `max` caracteres, cortando por párrafos y, si uno es enorme, a la fuerza. */
export function trocear(texto: string, max = 1000): string[] {
  const piezas = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) =>
      p.length <= max
        ? [p]
        : Array.from({ length: Math.ceil(p.length / max) }, (_, i) =>
            p.slice(i * max, (i + 1) * max),
          ),
    );
  const fragmentos: string[] = [];
  let actual = '';
  for (const p of piezas) {
    if (actual && actual.length + 2 + p.length > max) {
      fragmentos.push(actual);
      actual = p;
    } else actual = actual ? `${actual}\n\n${p}` : p;
  }
  if (actual) fragmentos.push(actual);
  return fragmentos;
}
