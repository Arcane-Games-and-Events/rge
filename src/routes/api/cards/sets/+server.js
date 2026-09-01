// src/routes/api/cards/sets/+server.js
import { json } from '@sveltejs/kit';
import { cards } from '@flesh-and-blood/cards';
import { setCodesForCard } from '$lib/fabSets';

const sets = [...new Set(cards.flatMap(setCodesForCard))].sort();

export async function GET() {
	return json({ sets });
}
