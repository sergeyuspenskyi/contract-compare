import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/compare': [
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-*/**/*',
      './node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/canvas*/**/*',
    ],
  },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Frame-Options', value: 'DENY' },
  ] }]; },
};
export default config;
