import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ARM Ventas',
    short_name: 'ARM',
    description: 'Atiende y convierte a tus clientes de WhatsApp',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f5f8',
    theme_color: '#ffffff',
    lang: 'es',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
