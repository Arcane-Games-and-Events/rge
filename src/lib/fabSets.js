/**
 * Set helpers for card data from `@flesh-and-blood/cards`.
 *
 * The package identifies a printing by its full card code (`HVY003`), not by a
 * set code, so the set is the leading letters of that code. Every identifier in
 * the dataset parses, and the codes produced cover every set the old
 * cards.json listed, which keeps stored values like `draftTool/selectedSet`
 * working across the change.
 */

/**
 * Set code for a printing identifier, e.g. 'HVY003' -> 'HVY', '1HP001' -> '1HP'.
 * @param {string} identifier
 * @returns {string|null}
 */
export function setCodeFromIdentifier(identifier) {
	const match = String(identifier || '').match(/^([A-Z0-9]*?[A-Z])\d+$/);
	return match ? match[1] : null;
}

/**
 * Every set code a card was printed in.
 * @param {Object} card
 * @returns {string[]}
 */
export function setCodesForCard(card) {
	const codes = (card?.printings || [])
		.map((p) => setCodeFromIdentifier(p.identifier))
		.filter(Boolean);
	return [...new Set(codes)];
}
