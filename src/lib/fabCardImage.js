/**
 * Image helpers for card data from `@flesh-and-blood/cards`.
 *
 * That package stores images as bare identifiers (`MST131`, `U-CRU001`,
 * `OMN243-CF`) rather than URLs, so the host is applied here. Both hosts below
 * serve the same identifier space; the CloudFront one is kept as a fallback for
 * when a card is missing from the primary bucket.
 *
 * The search endpoint sends identifiers rather than URLs and the browser builds
 * the URLs, which keeps the payload small enough to refetch on every keystroke.
 */

export const LSS_IMAGE_HOST =
	'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large';

export const CLOUDFRONT_IMAGE_HOST = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

// Enough alternates to recover from a bad printing without bloating a response
// that carries dozens of cards.
const MAX_FALLBACK_IDS = 5;

/**
 * Build a card image URL from an image identifier.
 * @param {string} imageId - Image identifier, e.g. 'MST131'
 * @param {string} [host] - Image host to use
 * @returns {string|null}
 */
export function buildImageUrl(imageId, host = LSS_IMAGE_HOST) {
	return imageId ? `${host}/${imageId}.webp` : null;
}

/**
 * Extract the image identifiers to send to the browser for a card.
 * @param {Object} card - Card object from `@flesh-and-blood/cards`
 * @returns {{ image: string|null, images: string[] }}
 */
export function getCardImageIds(card) {
	const printingIds = (card?.printings || []).map((p) => p.image).filter(Boolean);
	const image = card?.defaultImage || printingIds[0] || null;
	const images = [...new Set(printingIds)].filter((id) => id !== image).slice(0, MAX_FALLBACK_IDS);
	return { image, images };
}

/**
 * Ordered list of image URLs to try, primary first.
 *
 * Used to walk to the next candidate when an image fails to load: the same
 * identifier on the fallback host, then every other printing's image.
 * @param {string|null} image - Primary image identifier
 * @param {string[]} [images] - Alternate image identifiers
 * @returns {string[]}
 */
export function getImageUrlCandidates(image, images = []) {
	const urls = [];
	if (image) {
		urls.push(buildImageUrl(image, LSS_IMAGE_HOST));
		urls.push(buildImageUrl(image, CLOUDFRONT_IMAGE_HOST));
	}
	for (const id of images) {
		urls.push(buildImageUrl(id, LSS_IMAGE_HOST));
	}
	return [...new Set(urls.filter(Boolean))];
}
