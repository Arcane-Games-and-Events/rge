/**
 * Card Image Utilities
 * Matching the logic from the premium website for CDN image URLs
 */

// CDN configuration
export const FAB_IMAGE_CDN = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

// Foil suffix mapping for CDN URLs
const FOIL_SUFFIXES = {
	S: '-CF', // Cold Foil (special)
	C: '-CF', // Cold Foil
	R: '-RF', // Rainbow Foil
	G: '-GF' // Gold Foil
};

/**
 * Get the CDN URL suffix for a foiling type
 * @param {string} foiling - Foiling code (S, C, R, G, or empty)
 * @returns {string} - URL suffix (e.g., '-CF', '-RF') or empty string
 */
function getFoilSuffix(foiling) {
	return FOIL_SUFFIXES[foiling] || '';
}

// Sets that don't work with the official CDN
export const NON_CDN_SETS = new Set([
	'FAB', 'LGS', 'HER', 'JDG', 'WIN', 'LSS', 'GEM', 'TCC',
	'AAZ', 'AGB', 'AIO', 'AKO', 'AMX', 'APR', 'APS', 'ASB', 'ASR', 'AST', 'AUA', 'AVS',
	'BET', 'BOL', 'BRI', 'CHN', 'CIN', 'DRO', 'DVR', 'ENG', 'FAI', 'FLR', 'FNG',
	'KSI', 'KYO', 'LEV', 'LXI', 'NUU', 'OLA', 'OLD', 'OSC', 'PSM', 'RHI', 'RVD',
	'VER', 'VIC', 'WOD', 'ZEN'
]);

/**
 * Find the best printing for a card
 * Priority order:
 * 1. CDN-compatible non-foil
 * 2. CDN-compatible cold foil (S)
 * 3. CDN-compatible rainbow foil (R)
 * 4. Any CDN printing (except gold foil G)
 * 5. Fallback to image_url (non-foil first)
 * 6. Any fallback with image_url (except gold foil)
 */
export function findBestPrinting(printings) {
	if (!printings || printings.length === 0) return null;

	const excludedRarities = ['P', 'V'];
	const excludedEditions = ['N'];

	const passesBasicFilters = (p) =>
		p.id && !excludedRarities.includes(p.rarity) && !excludedEditions.includes(p.edition);
	const isCdnCompatible = (p) => !NON_CDN_SETS.has(p.set_id);

	// Priority 1: CDN-compatible non-foil
	const cdnNonFoil = printings.find(
		(p) => passesBasicFilters(p) && isCdnCompatible(p) && (!p.foiling || p.foiling === '')
	);
	if (cdnNonFoil) return { printing: cdnNonFoil, useCdn: true };

	// Priority 2: CDN-compatible cold foil (S or C)
	const cdnColdFoil = printings.find(
		(p) => passesBasicFilters(p) && isCdnCompatible(p) && (p.foiling === 'S' || p.foiling === 'C')
	);
	if (cdnColdFoil) return { printing: cdnColdFoil, useCdn: true };

	// Priority 3: CDN-compatible rainbow foil
	const cdnRainbowFoil = printings.find(
		(p) => passesBasicFilters(p) && isCdnCompatible(p) && p.foiling === 'R'
	);
	if (cdnRainbowFoil) return { printing: cdnRainbowFoil, useCdn: true };

	// Priority 4: Any CDN printing (except gold foil)
	const anyCdnPrinting = printings.find(
		(p) => passesBasicFilters(p) && isCdnCompatible(p) && p.foiling !== 'G'
	);
	if (anyCdnPrinting) return { printing: anyCdnPrinting, useCdn: true };

	// Priority 5: Fallback to image_url (non-foil first)
	const fallbackNonFoil = printings.find((p) => p.image_url && (!p.foiling || p.foiling === ''));
	if (fallbackNonFoil) return { printing: fallbackNonFoil, useCdn: false };

	// Priority 6: Any fallback with image_url (except gold foil)
	const fallbackAny = printings.find((p) => p.image_url && p.foiling !== 'G');
	if (fallbackAny) return { printing: fallbackAny, useCdn: false };

	// Last resort
	const lastResort = printings.find((p) => p.image_url || p.id);
	return lastResort
		? { printing: lastResort, useCdn: !!lastResort.id && isCdnCompatible(lastResort) }
		: null;
}

/**
 * Get the best image URL for a card object
 * @param {Object} card - Card object with printings array
 * @returns {string|null} - Best image URL or null
 */
export function getCardImageUrl(card) {
	if (!card?.printings || card.printings.length === 0) {
		return card?.printings?.[0]?.image_url || null;
	}

	const result = findBestPrinting(card.printings);
	if (!result) return card.printings[0]?.image_url || null;

	const { printing, useCdn } = result;
	if (useCdn) {
		const suffix = getFoilSuffix(printing.foiling);
		return `${FAB_IMAGE_CDN}/${printing.id}${suffix}.webp`;
	}
	return printing.image_url;
}

/**
 * Get the best image URL from a printings array directly
 * @param {Array} printings - Array of printing objects
 * @returns {string|null} - Best image URL or null
 */
export function getImageUrlFromPrintings(printings) {
	if (!printings || printings.length === 0) {
		return printings?.[0]?.image_url || null;
	}

	const result = findBestPrinting(printings);
	if (!result) return printings[0]?.image_url || null;

	const { printing, useCdn } = result;
	if (useCdn) {
		const suffix = getFoilSuffix(printing.foiling);
		return `${FAB_IMAGE_CDN}/${printing.id}${suffix}.webp`;
	}
	return printing.image_url;
}

// Sets to exclude from fallback (History Packs, etc.)
const FALLBACK_EXCLUDED_SETS = new Set(['1HP', '2HP']);

// Rarities to exclude from fallback (Promos, Marvels)
const FALLBACK_EXCLUDED_RARITIES = new Set(['P', 'M']);

/**
 * Get a fallback image URL from a card's printings
 * Used when the primary CDN URL fails to load
 * Excludes marvels, promos, and history pack printings
 * @param {Object} card - Card object with printings array
 * @returns {string|null} - Fallback image URL or null
 */
export function getFallbackImageUrl(card) {
	if (!card?.printings || card.printings.length === 0) return null;

	const validPrinting = card.printings.find(
		(p) =>
			p.image_url &&
			!FALLBACK_EXCLUDED_SETS.has(p.set_id) &&
			!FALLBACK_EXCLUDED_RARITIES.has(p.rarity)
	);

	return validPrinting?.image_url || null;
}

/**
 * Get a fallback image URL from a printings array directly
 * @param {Array} printings - Array of printing objects
 * @returns {string|null} - Fallback image URL or null
 */
export function getFallbackImageUrlFromPrintings(printings) {
	if (!printings || printings.length === 0) return null;

	const validPrinting = printings.find(
		(p) =>
			p.image_url &&
			!FALLBACK_EXCLUDED_SETS.has(p.set_id) &&
			!FALLBACK_EXCLUDED_RARITIES.has(p.rarity)
	);

	return validPrinting?.image_url || null;
}

/**
 * Build a search URL for cards.fabtcg.com
 * @param {string} cardName - Name of the card to search
 * @returns {string} - Search URL
 */
export function getCardSearchUrl(cardName) {
	const searchQuery = cardName.replace(/\s+/g, '+').toLowerCase();
	return `https://cards.fabtcg.com/results/?q=${searchQuery}`;
}
