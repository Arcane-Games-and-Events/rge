// src/routes/api/cards/by-set/+server.js
import { json } from '@sveltejs/kit';
import { cards } from '@flesh-and-blood/cards';
import { setCodesForCard } from '$lib/fabSets';
import { getCardImageIds } from '$lib/fabCardImage';

// Cards grouped by set code once at startup, so a request is a lookup rather
// than a scan of the whole dataset.
const bySet = new Map();
for (const card of cards) {
	for (const code of setCodesForCard(card)) {
		if (!bySet.has(code)) bySet.set(code, []);
		bySet.get(code).push(card);
	}
}
for (const list of bySet.values()) {
	list.sort((a, b) => a.name.localeCompare(b.name));
}

const MAX_RESULTS = 60;

const toResult = (card) => {
	const { image, images } = getCardImageIds(card);
	return {
		cardIdentifier: card.cardIdentifier,
		name: card.name,
		pitch: card.pitch ?? null,
		typeText: card.typeText,
		image,
		images
	};
};

export async function GET({ url }) {
	const set = (url.searchParams.get('set') || '').trim().toUpperCase();
	const query = (url.searchParams.get('q') || '').trim().toLowerCase();

	if (!set) return json({ results: [] });

	const pool = bySet.get(set) || [];
	const matches = query ? pool.filter((c) => c.name.toLowerCase().includes(query)) : pool;

	return json({ results: matches.slice(0, MAX_RESULTS).map(toResult) });
}
