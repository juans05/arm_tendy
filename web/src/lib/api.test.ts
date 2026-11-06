import { describe, expect, it } from 'vitest';
import { blobSeguro } from './api';

describe('blobSeguro', () => {
  it('un documento HTML o SVG del cliente se baja como archivo, no se abre como página', () => {
    expect(blobSeguro(new Blob(['<script>'], { type: 'text/html' })).type).toBe('application/octet-stream');
    expect(blobSeguro(new Blob(['<svg/>'], { type: 'image/svg+xml' })).type).toBe('application/octet-stream');
  });
  it('imágenes, audio, video y PDF se muestran tal cual', () => {
    for (const t of ['image/jpeg', 'image/png', 'audio/ogg', 'video/mp4', 'application/pdf'])
      expect(blobSeguro(new Blob(['x'], { type: t })).type).toBe(t);
  });
});
