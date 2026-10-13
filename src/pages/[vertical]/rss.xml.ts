import type { APIRoute } from 'astro';
import { recordsFeed } from '../../lib/feeds';
import { VERTICALS, type Vertical } from '../../lib/taxonomy';

export const getStaticPaths = () => VERTICALS.map((vertical) => ({ params: { vertical } }));
export const GET: APIRoute = ({ params }) => recordsFeed(params.vertical as Vertical);
