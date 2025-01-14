// src/routes/api/[player]/[property]/+server.js
import { json } from '@sveltejs/kit';
import { db } from '../../../../firebaseServer';

export async function GET({ params }) {
	const { player, property } = params;
	const playerRef = db.ref(`playerInfo/${player}/${property}`);

	try {
		const snapshot = await playerRef.once('value');
		if (snapshot.exists()) {
			return json({ [property]: snapshot.val() });
		} else {
			return json({ error: `${property} not found for ${player}` }, { status: 404 });
		}
	} catch (error) {
		console.error('Error fetching data from Firebase:', error);
		return json({ error: `Error fetching data from Firebase: ${error.message}` }, { status: 500 });
	}
}
