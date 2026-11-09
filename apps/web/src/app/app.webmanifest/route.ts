export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    {
      name: 'Pìnnuli',
      short_name: 'Pìnnuli',
      description: 'Le tue compresse, all’ora giusta.',
      start_url: '/app',
      scope: '/app',
      display: 'standalone',
      background_color: '#FBF7F0',
      theme_color: '#A63F19',
      lang: 'it',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
