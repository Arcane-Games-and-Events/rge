/**
 * Asset URLs for hero artwork.
 *
 * Stills are served from the app itself; videos come from a bucket named by
 * PUBLIC_HERO_VIDEO_BASE_URL, so no video files live in this repo. With that variable
 * unset there are simply no video candidates and every view falls back to the still,
 * which is what makes this safe to deploy before a single video exists.
 */
import { env } from '$env/dynamic/public';
import { heroSlug } from '$lib/heroSlug';

/**
 * Still image for a hero, or '' when there is no name.
 *
 * There is deliberately no default.jpg fallback: no such file exists, so returning it
 * would only trade a blank for a 404. Callers guard on the hero name instead.
 * @param {string} name
 * @returns {string}
 */
export function heroImageUrl(name) {
	const slug = heroSlug(name);
	return slug ? `/heroImages/${slug}.jpg` : '';
}

// Read at module scope: $env/dynamic/public is populated during SSR and serialised
// into the page, so this is stable for the life of the page.
const videoBase = (env.PUBLIC_HERO_VIDEO_BASE_URL || '').trim().replace(/\/+$/, '');

/**
 * Video candidates for a hero, best first, or [] when no bucket is configured.
 *
 * Best first: the hero's own film, then the plain-name one it shares with its other
 * versions. The component works down the list, so a missing file costs one 404.
 * @param {string} name
 * @returns {string[]}
 */
export function heroVideoUrls(name) {
	const slug = heroSlug(name);
	if (!videoBase || !slug) return [];

	const urls = [`${videoBase}/${slug}.webm`];

	// A titled hero with no film of its own falls back to the plain name, because the
	// two are the same character: "Briar, Warden of Thorns" plays briar.webm. Twenty
	// three heroes rely on this rather than on a duplicated upload. Tried in order, so
	// a hero that does have its own film never reaches the fallback.
	const plain = heroSlug(String(name).split(',')[0]);
	if (plain && plain !== slug) urls.push(`${videoBase}/${plain}.webm`);

	return urls;
}
