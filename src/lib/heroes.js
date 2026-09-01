/**
 * Hero list, loaded once per session from /api/heroes.
 *
 * The list is derived from `@flesh-and-blood/cards` on the server, so it stays
 * current with the package rather than with a checked-in file. Entries keep the
 * `{ name }` shape the components already expect.
 */
import { writable } from 'svelte/store';

export const heroes = writable([]);

let inFlight = null;

/**
 * Fetch the hero list, at most once per session. Safe to call from every
 * component that needs it; later callers reuse the first request.
 * @returns {Promise<Array<{name: string}>>}
 */
export function loadHeroes() {
	if (!inFlight) {
		inFlight = fetch('/api/heroes')
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to load heroes: ${res.status}`);
				return res.json();
			})
			.then((data) => {
				const list = data.heroes || [];
				heroes.set(list);
				return list;
			})
			.catch((err) => {
				console.error('Error loading heroes:', err);
				// Allow a later attempt rather than caching the failure forever.
				inFlight = null;
				return [];
			});
	}
	return inFlight;
}
