/**
 * The LSS event look.
 *
 * A single flag in Firebase drives a styling change across the OBS views: Tiller
 * in place of the usual face, and white text. The Event Presets page writes it;
 * the root layout reads it and applies the classes.
 */
import { writable } from 'svelte/store';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../firebaseClient';

export const LSS_EVENT_PATH = 'eventStyle/lssEvent';

/** True while the LSS look is on. Defaults to off until Firebase answers. */
export const lssEvent = writable(false);

let subscribed = false;

/** Keep the store in step with Firebase. Safe to call from more than one place. */
export function subscribeLssEvent() {
	if (subscribed) return;
	subscribed = true;
	onValue(ref(db, LSS_EVENT_PATH), (snap) => lssEvent.set(snap.val() === true));
}

/**
 * Turn the LSS look on or off for every connected view.
 * @param {boolean} enabled
 */
export async function setLssEvent(enabled) {
	try {
		await set(ref(db, LSS_EVENT_PATH), enabled === true);
	} catch (err) {
		console.error('Error saving the LSS event flag:', err);
	}
}

/**
 * Views that keep their current typeface: the clock and the life totals, plus the
 * scorekeepers, which are mostly clock and life totals.
 */
const FONT_EXEMPT = [
	'/views/timer',
	'/views/lifecounter',
	'/views/lifecounter2',
	'/views/scorekeeper',
	'/views/scorekeeper2'
];

/**
 * Whether a view should take the Tiller face.
 * @param {string} pathname
 * @returns {boolean}
 */
export function usesLssFont(pathname) {
	const path = (pathname || '').replace(/\/+$/, '');
	return !FONT_EXEMPT.includes(path);
}
