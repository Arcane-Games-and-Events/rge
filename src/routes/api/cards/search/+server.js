// src/routes/api/cards/search/+server.js
import { json } from '@sveltejs/kit';
import Searcher from '@flesh-and-blood/search';
import { cards } from '@flesh-and-blood/cards';
import { getCardImageUrl, getImageUrlCandidates } from '$lib/fabCardImage';

// The card dataset is ~8MB, so it stays on the server and the browser only ever
// receives the trimmed results below. The Searcher builds its index lazily on
// first search and is reused across requests in a warm serverless instance.
const searcher = new Searcher(cards);

const MAX_RESULTS = 15;

const toResult = (card) => ({
	cardIdentifier: card.cardIdentifier,
	name: card.name,
	pitch: card.pitch ?? null,
	typeText: card.typeText,
	imageUrl: getCardImageUrl(card),
	imageUrlCandidates: getImageUrlCandidates(card)
});

export async function GET({ url }) {
	const query = (url.searchParams.get('q') || '').trim();

	if (!query) {
		return json({ results: [] });
	}

	try {
		const { searchResults } = searcher.search(query);
		return json({ results: searchResults.slice(0, MAX_RESULTS).map(toResult) });
	} catch (error) {
		console.error('Error searching cards:', error);
		return json({ error: `Error searching cards: ${error.message}` }, { status: 500 });
	}
}
