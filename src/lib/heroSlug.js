/**
 * The canonical hero slug.
 *
 * Hero names are turned into asset filenames (static/heroImages/<slug>.jpg, and the
 * matching video in the bucket), so this has to agree exactly with what is on disk.
 * Several views grew their own copy of this over time; new code should import from
 * here rather than adding another.
 */

/**
 * Fold the handful of non-ASCII hero names onto the a-z0-9 space the filenames use.
 * "Jarl Vetreiði" has to become "jarl-vetreidi"; dropping the ð instead would give
 * "jarl-vetreii", which matches no file.
 * @param {string} name
 * @returns {string}
 */
export function toAscii(name) {
	return (name || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ð/g, 'd')
		.replace(/Ð/g, 'D')
		.replace(/ø/g, 'o')
		.replace(/Ø/g, 'O')
		.replace(/þ/g, 'th')
		.replace(/Þ/g, 'Th')
		.replace(/æ/g, 'ae')
		.replace(/Æ/g, 'AE');
}

/**
 * Asset slug for a hero name, e.g. 'Bravo, Star of the Show' -> 'bravo-star-of-the-show'.
 *
 * Punctuation is deleted rather than replaced with a space, which matters: the art for
 * 'Arakni, 5L!p3d 7hRu 7h3 cR4X' is arakni-5lp3d-7hru-7h3-cr4x.jpg, so turning the "!"
 * into a separator would split "5lp3d" and miss the file. Trimming happens before
 * spaces become hyphens, since trim() cannot remove a hyphen once one is there.
 * @param {string} name
 * @returns {string}
 */
export function heroSlug(name) {
	return toAscii(name)
		.toLowerCase()
		.replace(/["',]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}
