/**
 * The marketing copy the sponsor overlay carries: a tagline, the set's bundle
 * pricing as a sneak peek before it posts, and the note that goes with it.
 * The prices are per bundle, in dollars, with the short codes the shop uses:
 * NF is non-foil, RF is rainbow foil, C/R is commons and rares, M is
 * majestics.
 */
export const SPONSOR = {
	name: 'Hammurabi TCG',
	tagline: 'Sharpen your Daggers',
	product: 'Mastery Pack: Assassin',
	pitch: 'Bundles drop Monday',
	note: 'Legendaries & Marvels go up after full spoilers!'
};

/** Where to find the shop, as it goes along the foot of the overlay. */
export const CONTACTS = [
	{ kind: 'email', label: 'Email', value: 'hammurabitcg612@gmail.com' },
	{ kind: 'bluesky', label: 'Bluesky', value: '@hammurabitcg.bsky.social' },
	{ kind: 'x', label: 'X', value: '@Hpat612' }
];

export const BUNDLES = [
	{
		code: 'NF',
		finish: 'Non-Foil',
		rows: [
			{ code: 'C/R', label: 'Commons & Rares', price: 40 },
			{ code: 'M', label: 'Majestics', price: 475 }
		]
	},
	{
		code: 'RF',
		finish: 'Rainbow Foil',
		rows: [
			{ code: 'C/R', label: 'Commons & Rares', price: 250 },
			{ code: 'M', label: 'Majestics', price: 1250 }
		]
	}
];

export const dollars = (n) => `$${n.toLocaleString('en-US')}`;

/**
 * What the overlay shows, in order: the bundle pricing first, then the
 * singles message. A Stream Deck button steps between them through
 * /sponsor/next, and the step lives in the database at `sponsor/step`.
 */
export const SPONSOR_PATH = 'sponsor';

export const PANELS = [
	{ kind: 'pricing', label: 'Bundle pricing' },
	{
		kind: 'message',
		label: 'Singles message',
		title: 'Need singles? Just message us.',
		// Words between asterisks are picked out in tan on the overlay.
		body: ['Order by Nov 3rd and grab it all', 'at the *World Championship* in *Paris*.']
	}
];

export const LAST_STEP = PANELS.length - 1;

/** A body line split into plain and picked-out runs: [{ text, em }]. */
export const runs = (line) =>
	line
		.split('*')
		.map((text, i) => ({ text, em: i % 2 === 1 }))
		.filter((r) => r.text);

export const toStep = (v) => {
	const n = Number(v);
	return Number.isInteger(n) ? Math.max(0, Math.min(LAST_STEP, n)) : 0;
};

export const describeStep = (step) => PANELS[toStep(step)].label;
