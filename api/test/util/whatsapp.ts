import { DataSource } from 'typeorm';
import { NumeroWhatsapp } from '../../src/canales/numero-whatsapp.entity';

// Payload de Meta con un mensaje de texto entrante.
export const payloadTexto = (phoneNumberId: string, wamid: string, texto = 'Hola', from = '51911', extra: object = {}) => ({
  entry: [
    {
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: phoneNumberId },
            contacts: [{ wa_id: from, profile: { name: 'Rosa' } }],
            messages: [{ id: wamid, from, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: texto }, ...extra }],
          },
        },
      ],
    },
  ],
});

export async function crearNumero(db: DataSource, tenant: string, phoneNumberId: string) {
  const repo = db.getRepository(NumeroWhatsapp);
  return repo.save(repo.create({ tenant, phoneNumberId, wabaId: 'w-' + phoneNumberId, telefono: '51900', token: 'tok', coexistencia: false }));
}
