/**
 * The upcoming events list: a title line and any number of events, each with
 * a date, a name, where it is and which circuit it belongs to. The control
 * page writes them; the overlay draws them in date order, sized to however
 * many there are.
 */
export const UPCOMING_PATH = 'upcomingEvents';

/**
 * The circuits, each in its colour -- Tailwind's green-400, blue-400 and
 * purple-400, as the rest of the design uses them. The overlay colours each
 * event's bar by its circuit.
 */
export const CIRCUITS = [
	{ name: 'St Louis', color: '#4ade80' },
	{ name: 'Los Angeles', color: '#60a5fa' },
	{ name: 'New England', color: '#c084fc' }
];

/** The marks an event may carry, chosen on the control page. */
export const ICONS = [
	{ kind: '', label: 'None' },
	{ kind: 'trophy', label: 'Trophy' },
	{ kind: 'crown', label: 'Crown' }
];
export const toIcon = (v) => (ICONS.some((i) => i.kind === v && v) ? v : '');

/** The colour for a circuit name; tan, the overlays' neutral, when unknown. */
export function circuitColor(name) {
	return CIRCUITS.find((c) => c.name === name)?.color || '#d9b499';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A stored date, 'YYYY-MM-DD', as a local Date; null when it is not one. */
export function parseDate(value) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
	if (!m) return null;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return Number.isNaN(d.getTime()) ? null : d;
}

/** The parts the overlay prints: three-letter month, day, day of the week. */
export function dateParts(value) {
	const d = parseDate(value);
	if (!d) return { month: '', day: '', weekday: '' };
	return { month: MONTHS[d.getMonth()], day: String(d.getDate()), weekday: WEEKDAYS[d.getDay()] };
}

/** The stored node in a shape the pages can rely on, events in date order. */
export function normalizeUpcoming(raw) {
	const items = Object.entries(raw?.items || {})
		.map(([id, v]) => ({
			id,
			date: typeof v?.date === 'string' ? v.date : '',
			name: typeof v?.name === 'string' ? v.name : '',
			location: typeof v?.location === 'string' ? v.location : '',
			circuit: typeof v?.circuit === 'string' ? v.circuit : '',
			icon: toIcon(v?.icon),
			order: Number(v?.order) || 0
		}))
		.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.order - b.order);
	return {
		title: typeof raw?.title === 'string' ? raw.title : '',
		subtitle: typeof raw?.subtitle === 'string' ? raw.subtitle : '',
		items
	};
}
