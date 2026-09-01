// src/routes/api/heroes/+server.js
import { json } from '@sveltejs/kit';
import { cards } from '@flesh-and-blood/cards';

// Hero names are slugified into local image filenames (static/heroImages), and
// the slugify helpers around the app drop any character outside a-z0-9. Folding
// the one non-ASCII hero name to ASCII here keeps it pointing at the art it
// already has rather than at a slug with the character silently removed.
const toAscii = (name) =>
	name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ð/g, 'd')
		.replace(/Ð/g, 'D')
		.replace(/ø/g, 'o')
		.replace(/Ø/g, 'O')
		.replace(/þ/g, 'th')
		.replace(/Þ/g, 'Th')
		.replace(/æ/g, 'ae')
		.replace(/Æ/g, 'AE');

const heroes = [
	...new Set(cards.filter((c) => (c.types || []).includes('Hero')).map((c) => c.name))
]
	.map((name) => ({ name: toAscii(name) }))
	.sort((a, b) => a.name.localeCompare(b.name));

export async function GET() {
	return json({ heroes });
}
