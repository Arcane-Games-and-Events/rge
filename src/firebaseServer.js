// src/firebaseServer.js
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import * as dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
	const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: process.env.FIREBASE_DATABASE_URL
	});
}

const db = getDatabase();

export { db };
