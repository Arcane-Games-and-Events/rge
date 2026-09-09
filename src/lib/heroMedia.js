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
 * An array rather than a single URL so a second format can be added later without
 * touching the component that consumes it.
 * @param {string} name
 * @returns {string[]}
 */
export function heroVideoUrls(name) {
	const slug = heroSlug(name);
	if (!videoBase || !slug) return [];
	return [`${videoBase}/${slug}.mp4`];
}
