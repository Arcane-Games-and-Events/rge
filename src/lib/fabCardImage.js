/**
 * Image helpers for card data from `@flesh-and-blood/cards`.
 *
 * That package stores images as bare identifiers (`MST131`, `U-CRU001`,
 * `OMN243-CF`) rather than URLs, so the host is applied here. Both hosts below
 * serve the same identifier space; the CloudFront one is kept as a fallback for
 * when a card is missing from the primary bucket.
 */

export const LSS_IMAGE_HOST =
	'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large';

export const CLOUDFRONT_IMAGE_HOST = 'https://d2wlb52bya4y8z.cloudfront.net/media/cards/large';

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
 * Primary image URL for a card from `@flesh-and-blood/cards`.
 * @param {Object} card - Card object
 * @returns {string|null}
 */
export function getCardImageUrl(card) {
	const imageId = card?.defaultImage || card?.printings?.find((p) => p.image)?.image;
	return buildImageUrl(imageId);
}

/**
 * Ordered list of image URLs to try for a card, primary first.
 *
 * Used to walk to the next candidate when an image fails to load: the same
 * identifier on the fallback host, then every other printing's image.
 * @param {Object} card - Card object
 * @returns {string[]}
 */
export function getImageUrlCandidates(card) {
	if (!card) return [];

	const primaryId = card.defaultImage;
	const printingIds = (card.printings || []).map((p) => p.image).filter(Boolean);
	const orderedIds = [...new Set([primaryId, ...printingIds].filter(Boolean))];

	const urls = [];
	if (primaryId) {
		urls.push(buildImageUrl(primaryId, LSS_IMAGE_HOST));
		urls.push(buildImageUrl(primaryId, CLOUDFRONT_IMAGE_HOST));
	}
	for (const id of orderedIds) {
		urls.push(buildImageUrl(id, LSS_IMAGE_HOST));
	}

	return [...new Set(urls)];
}
