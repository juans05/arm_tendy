import type { NextConfig } from 'next';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
const cuentas = process.env.NEXT_PUBLIC_CUENTAS_URL ?? 'http://localhost:3001';
const dev = process.env.NODE_ENV !== 'production';

// CSP: la app solo habla con la API de ARM y con Cuentas. En desarrollo Next necesita eval y websockets.
const csp = [
  "default-src 'self'",
  // connect.facebook.net y facebook.com: SDK de Meta para conectar WhatsApp (Embedded Signup).
  `script-src 'self' 'unsafe-inline' https://connect.facebook.net${dev ? " 'unsafe-eval'" : ''}`,
  'frame-src https://*.facebook.com',
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  `connect-src 'self' ${api} ${cuentas} https://*.facebook.com${dev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
