// App icons (192, 512) from the same speech-bubble mark as favicon.svg.
import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';

export const getStaticPaths = () => [{ params: { icon: 'icon-192' } }, { params: { icon: 'icon-512' } }];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0B0B10"/><g transform="translate(2.2 1.6) scale(0.86)"><path d="M6 4h20a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H14.5L8 28.5V23H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="#C4FF3D"/><path d="M10.2 13.6l3.7 3.7 7.9-8" fill="none" stroke="#0B0B10" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

export const GET: APIRoute = ({ params }) => {
  const size = params.icon === 'icon-512' ? 512 : 192;
  const out = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/png' } });
};
