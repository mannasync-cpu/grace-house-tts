import {
    getDevotionalByDate,
    createPipelineLog,
    updatePipelineLog,
    updateDevotional,
    getAllContacts,
    getContactsByGroupIds,
    getContactsByIds,
} from './firestore';
import { services } from './services';
import { Devotional, PipelineLog, PipelineStep, ChannelStatus, Contact } from './types';
import { Timestamp } from 'firebase/firestore';
import { shortenUrl } from './urlShortener';

export class Orchestrator {

    /**
     * Resolve the target contact list based on devotional's recipient settings.
     * Deduplicates contacts by email and phone to prevent multiple messages.
     */
    private async resolveRecipients(devotional: Devotional): Promise<Contact[]> {
        const mode = devotional.recipientMode || 'all';
        let contacts: Contact[];

        switch (mode) {
            case 'groups':
                contacts = await getContactsByGroupIds(devotional.recipientGroupIds || []);
                break;
            case 'individual':
                contacts = await getContactsByIds(devotional.recipientContactIds || []);
                break;
            case 'all':
            default:
                contacts = await getAllContacts();
                break;
        }

        // Filter out globally unsubscribed contacts
        contacts = contacts.filter(c => !c.unsubscribedAt);

        // Deduplicate by email, then by phone — keep the most complete record
        const byEmail = new Map<string, Contact>();
        const byPhone = new Map<string, Contact>();
        const deduped: Contact[] = [];

        for (const c of contacts) {
            const email = c.email?.toLowerCase().trim();
            const phone = c.phone?.replace(/\D/g, '');

            // Check if we've already seen this email or phone
            if (email && byEmail.has(email)) continue;
            if (!email && phone && byPhone.has(phone)) continue;

            if (email) byEmail.set(email, c);
            if (phone) byPhone.set(phone, c);
            deduped.push(c);
        }

        console.log(`📋 Resolved ${deduped.length} unique recipients from ${contacts.length} total (mode: ${mode})`);
        return deduped;
    }

    /**
     * Filter contacts for a specific channel based on opt-in and DND status.
     */
    private filterForChannel(contacts: Contact[], channel: 'email' | 'sms' | 'whatsapp'): Contact[] {
        return contacts.filter(c => {
            switch (channel) {
                case 'email':
                    return c.email && c.emailOptIn !== false;
                case 'sms':
                    return c.phone && c.smsOptIn !== false && !c.dndRegistered;
                case 'whatsapp':
                    return c.phone && c.whatsappOptIn !== false && !c.dndRegistered;
                default:
                    return true;
            }
        });
    }

    async runPipeline(date?: string): Promise<string> {
        const targetDate = date || new Date().toISOString().split('T')[0];
        console.log(`Starting pipeline for date: ${targetDate}`);

        // 1. Initialize Log
        const logId = await createPipelineLog({
            date: targetDate,
            status: 'running',
            steps: [],
            startedAt: Timestamp.now()
        });

        const steps: PipelineStep[] = [];
        const addStep = (name: string, status: PipelineStep['status'] = 'pending', message = '') => {
            steps.push({
                name,
                status,
                message,
                startedAt: status === 'running' ? Timestamp.now() : null,
                completedAt: null,
                error: null
            });
            updatePipelineLog(logId, { steps, status: 'running' });
        };

        const updateStep = (name: string, status: PipelineStep['status'], message = '', error: string | null = null) => {
            const step = steps.find(s => s.name === name);
            if (step) {
                step.status = status;
                step.message = message;
                step.error = error;
                if (status === 'completed' || status === 'failed') {
                    step.completedAt = Timestamp.now();
                }
            }
            updatePipelineLog(logId, { steps });
        };

        try {
            // ── Step 1: Fetch Devotional ────────────────────────────
            addStep('Fetch Devotional', 'running', `Fetching for ${targetDate}`);
            const devotional = await getDevotionalByDate(targetDate);

            if (!devotional) {
                updateStep('Fetch Devotional', 'failed', 'No devotional found for this date', 'Not Found');
                await updatePipelineLog(logId, { status: 'failed', error: 'No devotional found', completedAt: Timestamp.now() });
                return logId;
            }

            updateStep('Fetch Devotional', 'completed', `Found: "${devotional.title}"`);
            await updatePipelineLog(logId, { devotionalId: devotional.id, devotionalTitle: devotional.title });

            const channelStatus: ChannelStatus = { ...devotional.channelStatus };

            // Resolve send channel preferences (default all on)
            const sendChannels = devotional.sendChannels || {
                email: true, sms: true, whatsapp: true, blog: true, tts: true,
            };

            // Resolve recipients once for all channels
            const allRecipients = await this.resolveRecipients(devotional);

            // ── Step 2: Generate Audio (TTS) ────────────────────────
            const ttsUrl = process.env.NEXT_PUBLIC_TTS_SERVER_URL || '';
            if (sendChannels.tts && ttsUrl && devotional.plainText) {
                addStep('Generate Audio (TTS)', 'running', 'Generating audio via Edge-TTS...');
                try {
                    const ttsRes = await fetch(`${ttsUrl}/synthesize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            text: devotional.plainText,
                            voice_id: process.env.NEXT_PUBLIC_TTS_VOICE_ID || 'default',
                        }),
                    });

                    if (!ttsRes.ok) {
                        throw new Error(`TTS server returned ${ttsRes.status}`);
                    }

                    // TTS server returns raw MP3 audio — upload to Firebase Storage
                    const audioBlob = await ttsRes.blob();
                    const fileName = `audio/${devotional.id}_${Date.now()}.mp3`;

                    const { getStorage } = await import('firebase/storage');
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const storage = getStorage();
                    const audioRef = ref(storage, fileName);
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    await uploadBytes(audioRef, new Uint8Array(arrayBuffer), { contentType: 'audio/mpeg' });
                    const audioUrl = await getDownloadURL(audioRef);

                    updateStep('Generate Audio (TTS)', 'completed', `Audio generated & uploaded`);

                    await updateDevotional(devotional.id, {
                        audioUrl,
                        audioDuration: 0,
                    });
                } catch (error: any) {
                    console.error('TTS Error:', error);
                    updateStep('Generate Audio (TTS)', 'failed', 'Failed to generate audio', error.message);
                }
            } else {
                addStep('Generate Audio (TTS)', 'skipped',
                    !sendChannels.tts ? 'TTS disabled for this devotional'
                        : ttsUrl ? 'No plain text content' : 'TTS server not configured');
            }

            // ── Step 3: Publish to Wix Blog ─────────────────────────
            if (sendChannels.blog && services.wix.isEnabled()) {
                addStep('Publish Blog (Wix)', 'running', 'Publishing to Wix Blog...');
                try {
                    const result = await services.wix.publishDevotional(devotional);
                    updateStep('Publish Blog (Wix)', 'completed', `Published to Wix: ${result.url}`);
                    channelStatus.blog = {
                        status: 'sent',
                        sentAt: Timestamp.now(),
                        error: null,
                        externalId: result.id
                    };
                } catch (error: any) {
                    console.error('Wix Error:', error);
                    updateStep('Publish Blog (Wix)', 'failed', 'Failed to publish', error.message);
                    channelStatus.blog = { status: 'failed', sentAt: null, error: error.message, externalId: null };
                }
            } else {
                addStep('Publish Blog (Wix)', 'skipped',
                    !sendChannels.blog ? 'Blog disabled for this devotional' : 'Wix service not configured');
            }

            // ── Step 4: Send Email (Mailchimp) ──────────────────────
            if (sendChannels.email && services.mailchimp.isEnabled()) {
                addStep('Send Email (Mailchimp)', 'running', 'Preparing email campaign...');
                try {
                    const result = await services.mailchimp.sendCampaign(devotional);
                    updateStep('Send Email (Mailchimp)', 'completed', `Campaign sent: ${result.id}`);
                    channelStatus.email = {
                        status: 'sent',
                        sentAt: Timestamp.now(),
                        error: null,
                        externalId: result.id
                    };
                } catch (error: any) {
                    console.error('Mailchimp Error:', error);
                    updateStep('Send Email (Mailchimp)', 'failed', 'Failed to send email', error.message);
                    channelStatus.email = { status: 'failed', sentAt: null, error: error.message, externalId: null };
                }
            } else {
                addStep('Send Email (Mailchimp)', 'skipped',
                    !sendChannels.email ? 'Email disabled for this devotional' : 'Mailchimp service not configured');
            }

            // Shorten URL once for both SMS and WhatsApp
            const rawDevotionalUrl = `https://grace-house-devotionals.web.app/devotional?id=${devotional.id}`;
            const devotionalShortUrl = (sendChannels.sms || sendChannels.whatsapp)
                ? await shortenUrl(rawDevotionalUrl) : rawDevotionalUrl;

            // ── Step 5: Send SMS (AWS SNS) ──────────────────────────
            if (sendChannels.sms && services.sns.isEnabled()) {
                const smsRecipients = this.filterForChannel(allRecipients, 'sms');
                addStep('Send SMS (AWS SNS)', 'running', `Broadcasting to ${smsRecipients.length} contacts...`);
                try {
                    const result = await services.sns.broadcastDevotional(
                        devotional.title,
                        devotional.summary || devotional.plainText?.substring(0, 120) || '',
                        devotionalShortUrl,
                        smsRecipients
                    );
                    updateStep('Send SMS (AWS SNS)', 'completed', `SMS sent to ${result.sent} contacts (${result.failed} failed)`);
                    channelStatus.sms = {
                        status: 'sent',
                        sentAt: Timestamp.now(),
                        error: result.failed > 0 ? `${result.failed} failed` : null,
                        externalId: result.messageIds[0] || null
                    };
                } catch (error: any) {
                    console.error('SNS Error:', error);
                    updateStep('Send SMS (AWS SNS)', 'failed', 'Failed to send SMS', error.message);
                    channelStatus.sms = { status: 'failed', sentAt: null, error: error.message, externalId: null };
                }
            } else {
                addStep('Send SMS (AWS SNS)', 'skipped',
                    !sendChannels.sms ? 'SMS disabled for this devotional' : 'AWS SNS not configured');
            }

            // ── Step 6: Send WhatsApp ───────────────────────────────
            if (sendChannels.whatsapp && services.whatsapp.isEnabled()) {
                const waRecipients = this.filterForChannel(allRecipients, 'whatsapp');
                addStep('Send WhatsApp', 'running', `Broadcasting to ${waRecipients.length} contacts...`);
                try {
                    const result = await services.whatsapp.broadcastDevotional(
                        devotional.title,
                        devotional.summary || devotional.plainText?.substring(0, 200) || '',
                        devotionalShortUrl,
                        waRecipients
                    );
                    updateStep('Send WhatsApp', 'completed', `WhatsApp sent to ${result.sent} contacts (${result.failed} failed)`);
                    channelStatus.whatsapp = {
                        status: 'sent',
                        sentAt: Timestamp.now(),
                        error: result.failed > 0 ? `${result.failed} failed` : null,
                        externalId: result.messageIds[0] || null
                    };
                } catch (error: any) {
                    console.error('WhatsApp Error:', error);
                    updateStep('Send WhatsApp', 'failed', 'Failed to send WhatsApp', error.message);
                    channelStatus.whatsapp = { status: 'failed', sentAt: null, error: error.message, externalId: null };
                }
            } else {
                addStep('Send WhatsApp', 'skipped',
                    !sendChannels.whatsapp ? 'WhatsApp disabled for this devotional' : 'WhatsApp service not configured');
            }

            // ── Update devotional channel status ────────────────────
            await updateDevotional(devotional.id, {
                channelStatus,
                status: 'published',
                publishedAt: Timestamp.now(),
            });

            // ── Finalize ────────────────────────────────────────────
            await updatePipelineLog(logId, { status: 'completed', completedAt: Timestamp.now() });
            console.log(`✅ Pipeline completed for "${devotional.title}"`);

            return logId;

        } catch (error: any) {
            console.error('❌ Pipeline Error:', error);
            await updatePipelineLog(logId, { status: 'failed', error: error.message, completedAt: Timestamp.now() });
            throw error;
        }
    }
}

export const orchestrator = new Orchestrator();
