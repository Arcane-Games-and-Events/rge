/**
 * Country list for the player flag picker.
 *
 * Derived from flag-icons' own country.json so the codes always match the CSS
 * classes it ships: a country's code `us` is rendered as `<span class="fi fi-us">`.
 * Non-ISO entries (subdivisions and historical flags) are dropped to keep the
 * dropdown to actual countries.
 */
import countries from 'flag-icons/country.json';

/**
 * Names the broadcast uses in place of the package's own.
 * Keyed by the flag-icons code, so the stored player value is unaffected.
 */
const NAME_OVERRIDES = {
	tw: 'Chinese Taipei'
};

/** @type {{ code: string, name: string }[]} sorted by name */
export const FLAG_COUNTRIES = countries
	.filter((c) => c.iso && c.code)
	.map((c) => {
		const code = c.code.toLowerCase();
		return { code, name: NAME_OVERRIDES[code] ?? c.name };
	})
	.sort((a, b) => a.name.localeCompare(b.name));

const byCode = new Map(FLAG_COUNTRIES.map((c) => [c.code, c]));

/**
 * The country for a stored code, or null when unset or unrecognised.
 * @param {string} code
 * @returns {{ code: string, name: string } | null}
 */
export function flagCountry(code) {
	return byCode.get(String(code || '').toLowerCase()) ?? null;
}
