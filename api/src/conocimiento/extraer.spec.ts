import * as XLSX from 'xlsx';
import { extraerTexto, tipoDeArchivo, trocear } from './extraer';

describe('tipoDeArchivo', () => {
  it('reconoce por extensión y rechaza lo demás', () => {
    expect(tipoDeArchivo('precios.XLSX')).toBe('xlsx');
    expect(tipoDeArchivo('a.docx')).toBe('docx');
    expect(tipoDeArchivo('a.pdf')).toBe('pdf');
    expect(tipoDeArchivo('foto.jpeg')).toBe('imagen');
    expect(tipoDeArchivo('virus.exe')).toBeNull();
  });
});

describe('extraerTexto', () => {
  it('excel: cada fila como "columna: valor" para no mezclar filas', async () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet([
        { Plan: 'Básico', Precio: 99 },
        { Plan: 'Pro', Precio: 199 },
      ]),
      'Planes',
    );
    const buf = XLSX.write(libro, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
    const t = await extraerTexto('xlsx', buf);
    expect(t).toContain('Plan: Básico; Precio: 99');
    expect(t).toContain('Plan: Pro; Precio: 199');
  });
});

describe('trocear', () => {
  it('parte textos largos por párrafos sin pasarse del tamaño', () => {
    const parrafos = Array.from(
      { length: 30 },
      (_, i) => `Párrafo ${i} ` + 'x'.repeat(100),
    );
    const f = trocear(parrafos.join('\n\n'), 500);
    expect(f.length).toBeGreaterThan(5);
    expect(f.every((x) => x.length <= 500)).toBe(true);
    expect(f.join(' ')).toContain('Párrafo 29');
  });

  it('un párrafo gigante también se corta', () => {
    expect(trocear('y'.repeat(1200), 500).length).toBe(3);
  });

  it('texto vacío no genera fragmentos', () => {
    expect(trocear('  \n ')).toEqual([]);
  });
});
