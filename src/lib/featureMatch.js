import { ref, update } from 'firebase/database';
import { ROUND_INFO_PATH } from '$lib/tournament';

/**
 * The feature match: a table picked on the tournament page, or a match on the
 * Top 8 page, whose players are sent to the production booth's Table 1 in one
 * go -- name, hero and record -- in place of typing them. During Swiss the
 * record is the players' W-L as the round began; in the Top 8 it is their
 * seed, "3rd", as the bracket graphics say it.
 *
 * A marker says which table is on the booth, so the page that sent it can
 * show it, and the other page can see it has been superseded. A Top 8 match
 * also sets the booth's round line to its stage of the bracket.
 */
export const FEATURE_PATH = 'featureMatch';

/**
 * @param {import('firebase/database').Database} db
 * @param {{ p1: Seat, p2: Seat }} seats
 * @param {{ kind: 'swiss', round: number, table: number } | { kind: 'top8', match: string }} marker
 * @typedef {{ name: string, hero: string, record: string }} Seat
 */
export function sendFeatureMatch(db, seats, marker) {
	const updates = { [FEATURE_PATH]: { ...marker, at: Date.now() } };
	if (marker.kind === 'top8') updates[ROUND_INFO_PATH] = bracketStage(marker.match);
	for (const key of ['p1', 'p2']) {
		const s = seats[key] || {};
		updates[`playerInfo/${key}/name`] = s.name || '';
		updates[`playerInfo/${key}/hero`] = s.hero || '';
		updates[`playerInfo/${key}/record`] = s.record || '';
	}
	// One multi-path update, so the booth never shows one seat's new player
	// beside the other's old one. Flags and pronouns are left as they are.
	return update(ref(db), updates);
}

/** The stage of the bracket a Top 8 match key belongs to: m0-m3, m4-m5, m6. */
export function bracketStage(match) {
	const n = Number(String(match).replace(/^m/, ''));
	if (n <= 3) return 'Quarterfinals';
	if (n <= 5) return 'Semifinals';
	return 'Finals';
}

/** Whether the stored marker is this Swiss table. */
export const isFeaturedTable = (marker, round, table) =>
	marker?.kind === 'swiss' && Number(marker.round) === round && Number(marker.table) === table;

/** Whether the stored marker is this Top 8 match. */
export const isFeaturedMatch = (marker, match) => marker?.kind === 'top8' && marker.match === match;
