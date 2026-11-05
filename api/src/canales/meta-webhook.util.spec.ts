import { parseMessageEchoes, parseMetaWebhook } from './meta-webhook.util';

const envolver = (msg: object, extra: object = {}) => ({
  entry: [
    {
      id: 'waba1',
      changes: [
        {
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'ph1' },
            contacts: [{ wa_id: '51911', profile: { name: 'Rosa' } }],
            messages: [
              { id: 'wamid.1', from: '51911', timestamp: '1762300000', ...msg },
            ],
            ...extra,
          },
        },
      ],
    },
  ],
});

describe('parseMetaWebhook', () => {
  it('texto', () => {
    expect(
      parseMetaWebhook(envolver({ type: 'text', text: { body: 'Hola' } })),
    ).toEqual([
      {
        phoneNumberId: 'ph1',
        from: '51911',
        nombre: 'Rosa',
        waMessageId: 'wamid.1',
        tipo: 'text',
        texto: 'Hola',
        mediaId: null,
        mimeType: null,
        referral: null,
        timestamp: new Date(1762300000 * 1000),
      },
    ]);
  });

  it('botón', () => {
    expect(
      parseMetaWebhook(
        envolver({ type: 'button', button: { text: 'Quiero info' } }),
      )[0].texto,
    ).toBe('Quiero info');
  });

  it('respuesta interactiva', () => {
    const [m] = parseMetaWebhook(
      envolver({
        type: 'interactive',
        interactive: { list_reply: { title: 'Spa' } },
      }),
    );
    expect(m.texto).toBe('Spa');
  });

  it('imagen con caption', () => {
    const [m] = parseMetaWebhook(
      envolver({
        type: 'image',
        image: { id: 'media9', mime_type: 'image/jpeg', caption: 'mi local' },
      }),
    );
    expect(m).toMatchObject({
      tipo: 'image',
      texto: 'mi local',
      mediaId: 'media9',
      mimeType: 'image/jpeg',
    });
  });

  it('audio sin texto', () => {
    const [m] = parseMetaWebhook(
      envolver({
        type: 'audio',
        audio: { id: 'media7', mime_type: 'audio/ogg' },
      }),
    );
    expect(m).toMatchObject({
      tipo: 'audio',
      texto: null,
      mediaId: 'media7',
      mimeType: 'audio/ogg',
    });
  });

  it('referral de anuncio', () => {
    const referral = {
      source_id: 'ad1',
      source_type: 'ad',
      source_url: 'https://fb.me/x',
      headline: 'Software para barberías',
      body: 'b',
    };
    const [m] = parseMetaWebhook(
      envolver({ type: 'text', text: { body: 'Hola' }, referral }),
    );
    expect(m.referral).toEqual({
      sourceId: 'ad1',
      sourceType: 'ad',
      sourceUrl: 'https://fb.me/x',
      headline: 'Software para barberías',
    });
  });

  it('estados de entrega → []', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'ph1' },
                statuses: [{ id: 'wamid.1', status: 'read' }],
              },
            },
          ],
        },
      ],
    };
    expect(parseMetaWebhook(payload)).toEqual([]);
  });

  it('payload vacío o raro → []', () => {
    expect(parseMetaWebhook(undefined)).toEqual([]);
    expect(parseMetaWebhook({ entry: 'x' })).toEqual([]);
  });
});

describe('parseMessageEchoes', () => {
  it('eco de coexistencia', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: 'smb_message_echoes',
              value: {
                metadata: { phone_number_id: 'ph1' },
                message_echoes: [
                  {
                    id: 'wamid.e1',
                    to: '51911',
                    type: 'text',
                    text: { body: 'Te llamo' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseMessageEchoes(payload)).toEqual([
      {
        phoneNumberId: 'ph1',
        to: '51911',
        messageId: 'wamid.e1',
        body: 'Te llamo',
      },
    ]);
  });
});
