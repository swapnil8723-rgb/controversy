// App icons (192, 512) from the same receipt mark as favicon.svg.
import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';

export const getStaticPaths = () => [{ params: { icon: 'icon-192' } }, { params: { icon: 'icon-512' } }];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0B0B10"/><path d="M8 5h16v21l-2.7-1.8-2.6 1.8-2.7-1.8-2.7 1.8-2.6-1.8L8 26z" fill="#B6FF3B"/><path d="M12 15.2l2.7 2.7 5.3-5.8" fill="none" stroke="#0B0B10" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const GET: APIRoute = ({ params }) => {
  const size = params.icon === 'icon-512' ? 512 : 192;
  const out = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  return new Response(new Uint8Array(out), { headers: { 'Content-Type': 'image/png' } });
};
