/**
 * The prizing breakdown: which kind of event is on, what it is called, and
 * the finish-by-finish table. An Open Series event pays out in cash and AGE
 * Open points; the Players Championship pays out in cash alone, with the Gold
 * Cold Foil and the PTI going to the winner. Each kind keeps its own table,
 * so switching between them does not lose either.
 */
export const PRIZING_PATH = 'prizing';

export const EVENT_TYPES = [
	{ kind: 'open', label: 'Open Series', name: 'Open Series', points: true },
	{
		kind: 'championship',
		label: 'Players Championship',
		name: 'Players Championship',
		points: false
	}
];

export const toEventType = (v) => (EVENT_TYPES.some((t) => t.kind === v) ? v : 'open');
export const eventType = (kind) => EVENT_TYPES.find((t) => t.kind === toEventType(kind));

/** The tables as they stood on the reference graphics. */
export const DEFAULT_ROWS = {
	open: [
		{ finish: 'Winner', prize: '$400', points: '30' },
		{ finish: '2nd', prize: '$200', points: '25' },
		{ finish: '3rd-4th', prize: '$100', points: '20' },
		{ finish: '5th-8th', prize: '$50', points: '15' },
		{ finish: '9th-12th', prize: '', points: '12' },
		{ finish: '13th-16th', prize: '', points: '8' },
		{ finish: 'Participation', prize: '', points: '5' }
	],
	championship: [
		{ finish: 'Winner', prize: '$1100 + Gold Cold Foil + PTI', points: '' },
		{ finish: '2nd', prize: '$600', points: '' },
		{ finish: '3rd-4th', prize: '$250', points: '' },
		{ finish: '5th-8th', prize: '$100', points: '' },
		{ finish: '9th-16th', prize: '$50', points: '' }
	]
};

const str = (v) => (typeof v === 'string' ? v : '');

/** The stored node in a shape the pages can rely on. */
export function normalizePrizing(raw) {
	const type = toEventType(raw?.type);
	const rows = {};
	for (const t of EVENT_TYPES) {
		const stored = raw?.rows?.[t.kind];
		const list = Array.isArray(stored) ? stored : stored ? Object.values(stored) : null;
		rows[t.kind] = list
			? list
					.filter(Boolean)
					.map((r) => ({ finish: str(r.finish), prize: str(r.prize), points: str(r.points) }))
			: DEFAULT_ROWS[t.kind].map((r) => ({ ...r }));
	}
	return { type, eventName: str(raw?.eventName), rows };
}
