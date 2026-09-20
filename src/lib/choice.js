/**
 * Who won the die roll and what they chose: to play first, or second.
 *
 * One value for the booth, alongside the active-player marker: the seat that
 * chose and which order they took. The overlay shows the words with an arrow
 * toward that seat, so the other seat's order is implied and not stored.
 */
export const CHOICE_PATH = 'choice';

/** The four states the overlay has artwork for, keyed as stored. */
export const CHOICES = Object.freeze({
	'p1-first': { seat: 'p1', order: 'first', label: 'P1 chose first' },
	'p1-second': { seat: 'p1', order: 'second', label: 'P1 chose second' },
	'p2-first': { seat: 'p2', order: 'first', label: 'P2 chose first' },
	'p2-second': { seat: 'p2', order: 'second', label: 'P2 chose second' }
});

/**
 * Coerce whatever is stored into one of the four states, or '' when nothing is set.
 * @param {unknown} value
 * @returns {keyof typeof CHOICES | ''}
 */
export function toChoice(value) {
	return typeof value === 'string' && value in CHOICES ? value : '';
}

/**
 * The overlay artwork for a state: a 1920x1080 frame, white on transparent, that
 * lays over the scene as supplied.
 * @param {string} choice
 * @returns {string}
 */
export function choiceImage(choice) {
	return toChoice(choice) ? `/choice/${choice}.png` : '';
}
