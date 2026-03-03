/**
 * Daily Devotional Orchestrator
 *
 * Main pipeline that runs daily (via cron or manually) to:
 * 1. Fetch today's devotional from Firestore
 * 2. Generate a 2-3 sentence summary
 * 3. Generate audio via Edge-TTS
 * 4. Upload audio to Firebase Storage
 * 5. Publish to Wix blog (first — so we have the URL for other channels)
 * 6. Send email via Mailchimp (with blog link)
 * 7. Send SMS via Twilio (summary + blog link)
 * 8. Send WhatsApp message (summary + blog link)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { generateSummary } from './services/summarizer';
import { synthesizeAudio } from './services/tts-client';
import { sendMailchimpCampaign } from './services/mailchimp';
import { sendWhatsAppMessage, isWhatsAppEnabled } from './services/whatsapp';
import { publishWixBlogPost, isWixEnabled } from './services/wix';
import { sendSms, isSmsEnabled } from './services/sms';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ─── Firebase Admin Init ───────────────────────────────────────

if (!getApps().length) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        initializeApp({
            credential: cert(serviceAccountPath),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    } else {
        console.warn('⚠️  Firebase service account not found. Running in offline mode.');
        initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    }
}

const db = getFirestore();
const storage = getStorage();

// ─── Types ─────────────────────────────────────────────────────

interface PipelineStep {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    message: string;
    startedAt: FirebaseFirestore.Timestamp | null;
    completedAt: FirebaseFirestore.Timestamp | null;
    error: string | null;
}

// ─── Pipeline ──────────────────────────────────────────────────

async function runPipeline(targetDate?: string) {
    const date = targetDate || new Date().toISOString().split('T')[0];
    console.log(`\n🚀 Starting devotional pipeline for ${date}\n`);

    // Create log entry
    const logRef = db.collection('pipelineLogs').doc();
    const steps: PipelineStep[] = [
        { name: 'Fetch Devotional', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Generate Summary', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Generate Audio', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Upload Audio', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Publish Blog', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Send Email', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Send SMS', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
        { name: 'Send WhatsApp', status: 'pending', message: '', startedAt: null, completedAt: null, error: null },
    ];

    await logRef.set({
        devotionalId: '',
        devotionalTitle: '',
        date,
        steps,
        status: 'running',
        startedAt: Timestamp.now(),
        completedAt: null,
        error: null,
    });

    const updateStep = async (index: number, update: Partial<PipelineStep>) => {
        steps[index] = { ...steps[index], ...update };
        await logRef.update({ steps });
    };

    const updateLog = async (update: Record<string, unknown>) => {
        await logRef.update(update);
    };

    try {
        // ─── Step 1: Fetch Devotional ────────────────────────────
        await updateStep(0, { status: 'running', startedAt: Timestamp.now() });
        console.log('📥 Step 1: Fetching devotional...');

        const snap = await db.collection('devotionals')
            .where('date', '==', date)
            .where('status', 'in', ['scheduled', 'draft'])
            .limit(1)
            .get();

        if (snap.empty) {
            await updateStep(0, { status: 'failed', error: `No devotional found for ${date}`, completedAt: Timestamp.now() });
            await updateLog({ status: 'failed', error: `No devotional found for ${date}`, completedAt: Timestamp.now() });
            console.log(`❌ No devotional found for ${date}`);
            return;
        }

        const devotionalDoc = snap.docs[0];
        const devotional = devotionalDoc.data();
        const devotionalId = devotionalDoc.id;

        await updateStep(0, {
            status: 'completed',
            message: `Found: "${devotional.title}"`,
            completedAt: Timestamp.now(),
        });
        await updateLog({ devotionalId, devotionalTitle: devotional.title });
        console.log(`✅ Found: "${devotional.title}"`);

        // ─── Step 2: Generate Summary ────────────────────────────
        await updateStep(1, { status: 'running', startedAt: Timestamp.now() });
        console.log('📝 Step 2: Generating summary...');

        const plainText = devotional.plainText || devotional.body?.replace(/<[^>]+>/g, '') || '';
        let summary = devotional.summary;

        if (!summary) {
            summary = await generateSummary(plainText);
            await devotionalDoc.ref.update({ summary });
        }

        await updateStep(1, {
            status: 'completed',
            message: `Summary: ${summary.substring(0, 80)}...`,
            completedAt: Timestamp.now(),
        });
        console.log(`✅ Summary: ${summary.substring(0, 80)}...`);

        // ─── Step 3: Generate Audio ──────────────────────────────
        await updateStep(2, { status: 'running', startedAt: Timestamp.now() });
        console.log('🎙️ Step 3: Generating audio (Edge-TTS)...');

        let audioBuffer: Buffer;
        try {
            audioBuffer = await synthesizeAudio(plainText);
            await updateStep(2, {
                status: 'completed',
                message: `Audio generated (${(audioBuffer.length / 1024).toFixed(0)}KB)`,
                completedAt: Timestamp.now(),
            });
            console.log(`✅ Audio generated (${(audioBuffer.length / 1024).toFixed(0)}KB)`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await updateStep(2, { status: 'failed', error: errMsg, completedAt: Timestamp.now() });
            console.log(`⚠️ Audio generation failed: ${errMsg}. Continuing without audio.`);
            audioBuffer = Buffer.alloc(0);
        }

        // ─── Step 4: Upload Audio ────────────────────────────────
        let audioUrl = '';
        if (audioBuffer.length > 0) {
            await updateStep(3, { status: 'running', startedAt: Timestamp.now() });
            console.log('☁️ Step 4: Uploading audio...');

            try {
                const bucket = storage.bucket();
                const filePath = `audio/${date}.mp3`;
                const file = bucket.file(filePath);
                await file.save(audioBuffer, { contentType: 'audio/mpeg' });
                await file.makePublic();
                audioUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

                await devotionalDoc.ref.update({ audioUrl });
                await updateStep(3, {
                    status: 'completed',
                    message: `Uploaded to ${filePath}`,
                    completedAt: Timestamp.now(),
                });
                console.log(`✅ Uploaded to ${audioUrl}`);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                await updateStep(3, { status: 'failed', error: errMsg, completedAt: Timestamp.now() });
                console.log(`⚠️ Upload failed: ${errMsg}`);
            }
        } else {
            await updateStep(3, { status: 'skipped', message: 'No audio to upload', completedAt: Timestamp.now() });
        }

        // ─── Step 5: Publish Blog (FIRST — so we have the URL) ──
        let blogUrl = '';
        if (isWixEnabled()) {
            await updateStep(4, { status: 'running', startedAt: Timestamp.now() });
            console.log('📰 Step 5: Publishing blog post...');

            try {
                const result = await publishWixBlogPost({
                    title: devotional.title,
                    body: devotional.body,
                    date,
                    author: devotional.author,
                    audioUrl,
                    summary,
                });

                blogUrl = result.url;

                await devotionalDoc.ref.update({
                    'channelStatus.blog': {
                        status: 'sent',
                        sentAt: Timestamp.now(),
                        error: null,
                        externalId: result.id,
                    },
                });
                await updateStep(4, {
                    status: 'completed',
                    message: `Published: ${blogUrl}`,
                    completedAt: Timestamp.now(),
                });
                console.log(`✅ Blog published: ${blogUrl}`);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                await updateStep(4, { status: 'failed', error: errMsg, completedAt: Timestamp.now() });
                await devotionalDoc.ref.update({
                    'channelStatus.blog': { status: 'failed', sentAt: null, error: errMsg, externalId: null },
                });
                console.log(`⚠️ Blog publish failed: ${errMsg}`);
            }
        } else {
            await updateStep(4, { status: 'skipped', message: 'Wix service not configured', completedAt: Timestamp.now() });
        }

        // ─── Step 6: Send Email ──────────────────────────────────
        await updateStep(5, { status: 'running', startedAt: Timestamp.now() });
        console.log('📧 Step 6: Sending email...');

        try {
            const campaignId = await sendMailchimpCampaign({
                title: devotional.title,
                body: devotional.body,
                date,
                author: devotional.author,
                audioUrl,
                summary,
                blogUrl,
            });

            await devotionalDoc.ref.update({
                'channelStatus.email': {
                    status: 'sent',
                    sentAt: Timestamp.now(),
                    error: null,
                    externalId: campaignId,
                },
            });
            await updateStep(5, {
                status: 'completed',
                message: `Campaign sent: ${campaignId}`,
                completedAt: Timestamp.now(),
            });
            console.log(`✅ Email sent: ${campaignId}`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await updateStep(5, { status: 'failed', error: errMsg, completedAt: Timestamp.now() });
            await devotionalDoc.ref.update({
                'channelStatus.email': { status: 'failed', sentAt: null, error: errMsg, externalId: null },
            });
            console.log(`⚠️ Email failed: ${errMsg}`);
        }

        // ─── Step 7: Send SMS ────────────────────────────────────
        if (isSmsEnabled()) {
            await updateStep(6, { status: 'running', startedAt: Timestamp.now() });
            console.log('📱 Step 7: Sending SMS...');

            try {
                // Fetch opted-in contacts with phone numbers
                const contactsSnap = await db.collection('contacts')
                    .where('emailOptIn', '==', true) // TODO: Add smsOptIn field
                    .get();

                const smsContacts = contactsSnap.docs
                    .map((d) => d.data())
                    .filter((c) => c.phone);

                if (smsContacts.length > 0) {
                    let sentCount = 0;
                    for (const contact of smsContacts) {
                        try {
                            await sendSms(contact.phone, {
                                title: devotional.title,
                                date,
                                summary,
                                blogUrl,
                            });
                            sentCount++;
                        } catch (err) {
                            console.error(`SMS failed for ${contact.name}: ${err}`);
                        }
                        // Rate limit
                        await new Promise((resolve) => setTimeout(resolve, 1100));
                    }

                    await devotionalDoc.ref.update({
                        'channelStatus.sms': {
                            status: 'sent',
                            sentAt: Timestamp.now(),
                            error: null,
                            externalId: `${sentCount}/${smsContacts.length} sent`,
                        },
                    });
                    await updateStep(6, {
                        status: 'completed',
                        message: `Sent to ${sentCount}/${smsContacts.length} contacts`,
                        completedAt: Timestamp.now(),
                    });
                    console.log(`✅ SMS sent to ${sentCount}/${smsContacts.length} contacts`);
                } else {
                    await updateStep(6, { status: 'skipped', message: 'No contacts with phone numbers', completedAt: Timestamp.now() });
                    console.log('⏭️ No contacts with phone numbers for SMS');
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                await updateStep(6, { status: 'failed', error: errMsg, completedAt: Timestamp.now() });
                await devotionalDoc.ref.update({
                    'channelStatus.sms': { status: 'failed', sentAt: null, error: errMsg, externalId: null },
                });
                console.log(`⚠️ SMS failed: ${errMsg}`);
            }
        } else {
            await updateStep(6, { status: 'skipped', message: 'Twilio SMS not configured', completedAt: Timestamp.now() });
            console.log('⏭️ SMS skipped (Twilio not configured)');
        }

        // ─── Step 8: Send WhatsApp ───────────────────────────────
        if (isWhatsAppEnabled()) {
            await updateStep(7, { status: 'running', startedAt: Timestamp.now() });
            console.log('💬 Step 8: Sending WhatsApp...');

            try {
                // Fetch opted-in contacts with phone numbers
                const contactsSnap = await db.collection('contacts')
                    .where('whatsappOptIn', '==', true)
                    .get();

                const waContacts = contactsSnap.docs
                    .map((d) => d.data())
                    .filter((c) => c.phone);

                if (waContacts.length > 0) {
                    let sentCount = 0;
                    for (const contact of waContacts) {
                        try {
                            await sendWhatsAppMessage(contact.phone, {
                                title: devotional.title,
                                date,
                                summary,
                                audioUrl,
                                blogUrl,
                            });
                            sentCount++;
                        } catch (err) {
                            console.error(`WhatsApp failed for ${contact.name}: ${err}`);
                        }
                        await new Promise((resolve) => setTimeout(resolve, 200));
                    }

                    await devotionalDoc.ref.update({
                        'channelStatus.whatsapp': {
                            status: 'sent',
                            sentAt: Timestamp.now(),
                            error: null,
                            externalId: `${sentCount}/${waContacts.length} sent`,
                        },
                    });
                    await updateStep(7, {
                        status: 'completed',
                        message: `Sent to ${sentCount}/${waContacts.length} contacts`,
                        completedAt: Timestamp.now(),
                    });
                    console.log(`✅ WhatsApp sent to ${sentCount}/${waContacts.length} contacts`);
                } else {
                    await updateStep(7, { status: 'skipped', message: 'No opted-in WhatsApp contacts', completedAt: Timestamp.now() });
                    console.log('⏭️ No opted-in WhatsApp contacts');
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                await updateStep(7, { status: 'failed', error: errMsg, completedAt: Timestamp.now() });
                await devotionalDoc.ref.update({
                    'channelStatus.whatsapp': { status: 'failed', sentAt: null, error: errMsg, externalId: null },
                });
                console.log(`⚠️ WhatsApp failed: ${errMsg}`);
            }
        } else {
            await updateStep(7, { status: 'skipped', message: 'WhatsApp not configured', completedAt: Timestamp.now() });
            console.log('⏭️ WhatsApp skipped (not configured)');
        }

        // ─── Complete ────────────────────────────────────────────
        const hasFailures = steps.some((s) => s.status === 'failed');
        await devotionalDoc.ref.update({
            status: 'published',
            publishedAt: Timestamp.now(),
        });
        await updateLog({
            status: hasFailures ? 'completed' : 'completed',
            completedAt: Timestamp.now(),
        });

        console.log(`\n✅ Pipeline completed for ${date} ${hasFailures ? '(with some failures)' : 'successfully'}!\n`);
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await updateLog({
            status: 'failed',
            error: errMsg,
            completedAt: Timestamp.now(),
        });
        console.error(`\n❌ Pipeline failed: ${errMsg}\n`);
    }
}

// ─── CLI Entry ─────────────────────────────────────────────────

const targetDate = process.argv[2]; // Optional date override
runPipeline(targetDate).catch(console.error);
