/**
 * Hero card artwork for the LSS card overlay.
 *
 * The cards are large transparent PNGs (798x1080), so like the videos they live in a
 * bucket named by an environment variable rather than in the repo. With the variable
 * unset there is no URL to request and the overlay simply shows nothing, which is what
 * makes it safe to deploy before the upload happens.
 */
import { env } from '$env/dynamic/public';
import { heroSlug } from '$lib/heroSlug';

const cardBase = (env.PUBLIC_HERO_CARD_BASE_URL || '').trim().replace(/\/+$/, '');

/**
 * Card art for a hero, or '' when there is no base configured or no name.
 *
 * Deliberately no fallback to the plain name, unlike the videos: a hero card is a
 * specific printing, so showing a different one would be wrong rather than merely
 * approximate.
 * @param {string} name
 * @returns {string}
 */
export function heroCardUrl(name) {
	const slug = heroSlug(name);
	return cardBase && slug ? `${cardBase}/${slug}.png` : '';
}
