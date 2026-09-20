/**
 * Layout for the LSS metagame overlay: how many columns to run, how tall each row
 * is, and where the block sits, for however many heroes are in the field.
 *
 * Every dimension of a row is a fixed multiple of its height -- the reference row is
 * 514 wide by 75 tall -- so the only real decisions are the column count and the row
 * height. For each candidate column count the row height is the largest that fits
 * both ways: rows stacked down the area, and columns laid across it. Of the counts
 * whose rows come within a few percent of the tallest possible, the one that spreads
 * widest across the canvas wins -- a wide, shallow block reads better on a broadcast
 * frame than a tall, narrow one of nearly the same row size. The height is capped so
 * a small field is generous rather than absurd.
 *
 * That leaves the band under the heading only partly used whenever the width binds
 * first, which is most of the time. So the rows then take up the slack in two
 * bounded steps: each grows taller than its proportional height, widths unchanged,
 * up to maxStretch; then the spacing between rows opens, up to maxGapRatio of a
 * row. Whatever is left after that is margin, and the block is centred in it.
 */

/** The reference row, in pixels, and the ratios everything is drawn from. */
export const REF = Object.freeze({
	rowH: 75,
	rowW: 514,
	rowGap: 8,
	cut: 20,
	colGap: 40,
	/** Tallest a row may grow: 1.6x the reference, for a field of a handful. */
	maxRowH: 120,
	/** Smallest worth drawing; below this the names stop being legible on air. */
	minRowH: 44,
	/** How much taller than its proportional height a row may grow to fill the band. */
	maxStretch: 1.3,
	/** Widest the row spacing may open, as a fraction of the row height. */
	maxGapRatio: 0.5
});

/** How much shorter a row may be, as a fraction, for a wider layout to be preferred. */
const WIDTH_TOLERANCE = 0.07;

/**
 * @param {number} count heroes with at least one player
 * @param {{ width: number, top: number, bottom: number, sideMargin: number, joinShift?: (rowH: number) => number }} area
 *   The canvas width, the y where the block may start (under the header), the y it must
 *   stay above, and the side margin. joinShift is the extra width the gapped joins add.
 * @returns {{ columns: number, rowsPerColumn: number, baseRowH: number, rowH: number, rowGap: number, rowW: number, left: number, top: number, blockW: number, blockH: number }}
 *   baseRowH scales every width and font; rowH is the height the row stands at.
 */
export function metagameLayout(count, area) {
	const areaH = area.bottom - area.top;
	const usableW = area.width - 2 * area.sideMargin;
	const shift = area.joinShift ?? (() => 0);

	if (count <= 0) {
		return {
			columns: 0,
			rowsPerColumn: 0,
			baseRowH: 0,
			rowH: 0,
			rowGap: 0,
			rowW: 0,
			left: 0,
			top: area.top,
			blockW: 0,
			blockH: 0
		};
	}

	const candidates = [];
	for (let columns = 1; columns <= 8; columns++) {
		const rowsPerColumn = Math.ceil(count / columns);
		if (columns > 1 && Math.ceil(count / (columns - 1)) === rowsPerColumn) continue; // no fewer rows than one column fewer: pointless

		// Stacked: r rows and r-1 gaps, the gap being a fixed fraction of the row.
		const gapRatio = REF.rowGap / REF.rowH;
		const byHeight = areaH / (rowsPerColumn + (rowsPerColumn - 1) * gapRatio);

		// Across: c rows wide plus the column gaps. Row width scales with height, plus
		// the two join gaps, which also scale, so solve for h with shift folded in.
		const widthRatio = REF.rowW / REF.rowH;
		const shiftRatio = (2 * shift(REF.rowH)) / REF.rowH;
		const byWidth = (usableW - (columns - 1) * REF.colGap) / (columns * (widthRatio + shiftRatio));

		const rowH = Math.min(REF.maxRowH, byHeight, byWidth);
		candidates.push({
			columns,
			rowsPerColumn,
			rowH,
			blockW: columns * rowH * (widthRatio + shiftRatio) + (columns - 1) * REF.colGap
		});
	}

	// Widest layout among those whose rows are within tolerance of the tallest.
	const tallest = Math.max(...candidates.map((c) => c.rowH));
	const best = candidates
		.filter((c) => c.rowH >= tallest * (1 - WIDTH_TOLERANCE))
		.sort((a, b) => b.blockW - a.blockW || a.columns - b.columns)[0];

	// baseRowH sets every width and font; rowH is what the row actually stands at.
	const baseRowH = Math.max(REF.minRowH, Math.floor(best.rowH));
	const rows = best.rowsPerColumn;
	const rowW = (REF.rowW / REF.rowH) * baseRowH + 2 * shift(baseRowH);
	let rowGap = (REF.rowGap / REF.rowH) * baseRowH;

	// Fill the band: stretch the rows first, then the spacing, each within its bound.
	const tallestFit = (areaH - (rows - 1) * rowGap) / rows;
	const rowH = Math.floor(Math.max(baseRowH, Math.min(tallestFit, baseRowH * REF.maxStretch)));
	if (rows > 1) {
		const spare = areaH - (rows * rowH + (rows - 1) * rowGap);
		const widest = REF.maxGapRatio * rowH;
		rowGap = Math.min(widest, rowGap + Math.max(0, spare / (rows - 1)));
	}

	const blockW = best.columns * rowW + (best.columns - 1) * REF.colGap;
	const blockH = rows * rowH + (rows - 1) * rowGap;

	return {
		columns: best.columns,
		rowsPerColumn: rows,
		baseRowH,
		rowH,
		rowGap,
		rowW,
		blockW,
		blockH,
		left: Math.round((area.width - blockW) / 2),
		top: Math.round(area.top + Math.max(0, (areaH - blockH) / 2))
	};
}
