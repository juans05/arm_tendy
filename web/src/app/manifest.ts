import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ARM Ventas',
    short_name: 'ARM',
    description: 'Atiende y convierte a tus clientes de WhatsApp',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f6fb',
    theme_color: '#1d2645',
    lang: 'es',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
