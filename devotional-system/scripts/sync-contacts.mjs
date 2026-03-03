#!/usr/bin/env node

/**
 * Planning Center → Firestore Contact Sync Script
 * 
 * Run this from the project root:
 *   node scripts/sync-contacts.mjs
 * 
 * This bypasses browser CORS restrictions by running server-side.
 * It reads .env.local for credentials and writes directly to Firestore.
 */

import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch, Timestamp } from 'firebase/firestore';

// ─── Load .env.local ─────────────────────────────────────────
const envFile = readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.startsWith('#') || !line.includes('=')) return;
    const [key, ...valueParts] = line.split('=');
    env[key.trim()] = valueParts.join('=').trim();
});

const PCO_APP_ID = env.PLANNING_CENTER_APP_ID || env.NEXT_PUBLIC_PLANNING_CENTER_APP_ID;
const PCO_SECRET = env.PLANNING_CENTER_SECRET || env.NEXT_PUBLIC_PLANNING_CENTER_SECRET;
const PCO_API_BASE = 'https://api.planningcenteronline.com/people/v2';

// Firebase config from env
const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!PCO_APP_ID || !PCO_SECRET) {
    console.error('❌ Missing Planning Center credentials in .env.local');
    console.error('   Expected: PLANNING_CENTER_APP_ID and PLANNING_CENTER_SECRET');
    process.exit(1);
}

if (!firebaseConfig.projectId) {
    console.error('❌ Missing Firebase config in .env.local');
    process.exit(1);
}

console.log('🔄 Planning Center → Firestore Sync');
console.log(`   PCO App ID: ${PCO_APP_ID.substring(0, 8)}...`);
console.log(`   Firebase Project: ${firebaseConfig.projectId}`);
console.log('');

// ─── Init Firebase ──────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Auth Header ────────────────────────────────────────────
const authHeader = `Basic ${Buffer.from(`${PCO_APP_ID}:${PCO_SECRET}`).toString('base64')}`;

async function fetchPCO(url) {
    const res = await fetch(url, {
        headers: { 'Authorization': authHeader },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`PCO API ${res.status}: ${body}`);
    }
    return res.json();
}

// ─── Sync ───────────────────────────────────────────────────
async function syncContacts() {
    const contacts = [];
    let nextUrl = `${PCO_API_BASE}/people?per_page=100&include=emails,phone_numbers`;
    let page = 0;

    while (nextUrl) {
        page++;
        console.log(`   📄 Page ${page}: ${nextUrl.substring(0, 80)}...`);
        const data = await fetchPCO(nextUrl);

        console.log(`      → ${data.data?.length || 0} people, ${data.included?.length || 0} included`);

        // Build lookup maps
        const emailMap = new Map();
        const phoneMap = new Map();

        if (data.included) {
            for (const item of data.included) {
                if (item.type === 'Email' && item.attributes?.address) {
                    const personId = item.relationships?.person?.data?.id;
                    if (personId && (item.attributes.primary || !emailMap.has(personId))) {
                        emailMap.set(personId, item.attributes.address);
                    }
                }
                if (item.type === 'PhoneNumber' && item.attributes?.number) {
                    const personId = item.relationships?.person?.data?.id;
                    if (personId && (item.attributes.primary || !phoneMap.has(personId))) {
                        phoneMap.set(personId, item.attributes.number);
                    }
                }
            }
        }

        console.log(`      → ${emailMap.size} emails, ${phoneMap.size} phones`);

        for (const person of (data.data || [])) {
            const email = emailMap.get(person.id) || '';
            const phone = phoneMap.get(person.id) || null;

            if (!email && !phone) continue;

            contacts.push({
                id: person.id,
                name: `${person.attributes.first_name || ''} ${person.attributes.last_name || ''}`.trim(),
                email,
                phone,
                whatsappOptIn: false,
                emailOptIn: !!email,
                planningCenterId: person.id,
                createdAt: person.attributes.created_at
                    ? Timestamp.fromDate(new Date(person.attributes.created_at))
                    : Timestamp.now(),
                updatedAt: person.attributes.updated_at
                    ? Timestamp.fromDate(new Date(person.attributes.updated_at))
                    : Timestamp.now(),
            });
        }

        nextUrl = data.links?.next || null;
    }

    console.log('');
    console.log(`✅ Found ${contacts.length} contacts with email or phone (${page} pages)`);

    // Write to Firestore in batches of 500
    if (contacts.length > 0) {
        const contactsRef = collection(db, 'contacts');
        let batchCount = 0;

        for (let i = 0; i < contacts.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = contacts.slice(i, i + 500);

            for (const contact of chunk) {
                batch.set(doc(contactsRef, contact.id), contact, { merge: true });
            }

            await batch.commit();
            batchCount++;
            console.log(`   💾 Batch ${batchCount}: wrote ${chunk.length} contacts`);
        }

        console.log(`\n✅ Synced ${contacts.length} contacts to Firestore!`);
    } else {
        console.log('⚠️  No contacts to sync.');
    }
}

syncContacts()
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    });
