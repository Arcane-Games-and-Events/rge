/**
 * Image resolution for draft cards read back from Firebase.
 *
 * Cards saved by the draft picker before the move off cards.json carry a full
 * `printings` array with baked-in `image_url`s. Cards saved since carry the
 * trimmed `{ image, images }` shape from `@flesh-and-blood/cards`. Draft pools
 * outlive the change, so a pack can hold both and both have to render.
 */
import { buildImageUrl, getImageUrlCandidates } from '$lib/fabCardImage';
import { getCardImageUrl as legacyCardImageUrl } from '$lib/cardImageUtils';

/**
 * Best image URL for a saved draft card, in either shape.
 * @param {Object} card - Card object read from draftTool/saved_cards
 * @returns {string|null}
 */
export function getDraftCardImageUrl(card) {
	if (card?.image) return buildImageUrl(card.image);
	// Saved before the data move: resolve from the stored printings.
	return legacyCardImageUrl(card);
}

/**
 * Ordered image URLs to try for a saved draft card, primary first.
 * @param {Object} card
 * @returns {string[]}
 */
export function getDraftCardImageCandidates(card) {
	if (card?.image) return getImageUrlCandidates(card.image, card.images);
	const legacy = legacyCardImageUrl(card);
	return legacy ? [legacy] : [];
}
