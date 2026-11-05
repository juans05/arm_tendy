// Copiado de huarique_backend/src/common/utils/encryption-transformer.ts (mismo formato iv:authTag:cifrado).
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { ValueTransformer } from 'typeorm';

const ALGORITHM = 'aes-256-gcm';

function clave(): Buffer {
  const secreto = process.env.FIELD_ENCRYPTION_KEY;
  if (!secreto) throw new Error('FIELD_ENCRYPTION_KEY es obligatoria');
  return scryptSync(secreto, 'salt', 32);
}

export const cifrado: ValueTransformer = {
  to(valor: string | null): string | null {
    if (valor === null || valor === undefined) return valor;
    const iv = randomBytes(16);
    const c = createCipheriv(ALGORITHM, clave(), iv);
    const enc = c.update(valor, 'utf8', 'hex') + c.final('hex');
    return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc}`;
  },
  from(valor: string | null): string | null {
    if (valor === null || valor === undefined) return valor;
    const partes = valor.split(':');
    if (partes.length !== 3) return valor;
    const [iv, tag, enc] = partes;
    const d = createDecipheriv(ALGORITHM, clave(), Buffer.from(iv, 'hex'));
    d.setAuthTag(Buffer.from(tag, 'hex'));
    return d.update(enc, 'hex', 'utf8') + d.final('utf8');
  },
};
