import { Contact } from '../types';

/**
 * WhatsApp Business Cloud API Service
 * Uses Meta's Graph API to send template messages and text messages.
 * First 1,000 service conversations/month are free.
 *
 * Requires:
 * - NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN  (System User Token from Meta Business)
 * - NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID (Phone Number ID from WhatsApp Business)
 */
export class WhatsAppService {
    private accessToken: string;
    private phoneNumberId: string;
    private apiVersion = 'v21.0';

    constructor() {
        this.accessToken = process.env.NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN || '';
        this.phoneNumberId = process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || '';
    }

    isEnabled(): boolean {
        return !!this.accessToken && !!this.phoneNumberId;
    }

    private get baseUrl(): string {
        return `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    }

    /**
     * Send a template message to a single phone number.
     * Templates are pre-approved by Meta and required for initiating conversations.
     */
    async sendTemplateMessage(
        phoneNumber: string,
        templateName: string,
        languageCode: string = 'en_US',
        components?: any[]
    ): Promise<{ messageId: string; status: string }> {
        const payload: any = {
            messaging_product: 'whatsapp',
            to: this.normalizePhone(phoneNumber),
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
            },
        };

        if (components && components.length > 0) {
            payload.template.components = components;
        }

        const res = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(`WhatsApp API Error: ${error.error?.message || res.statusText}`);
        }

        const data = await res.json();
        const messageId = data.messages?.[0]?.id || 'unknown';
        return { messageId, status: 'sent' };
    }

    /**
     * Send a plain text message (only works within 24-hour conversation window).
     */
    async sendTextMessage(
        phoneNumber: string,
        text: string
    ): Promise<{ messageId: string; status: string }> {
        const res = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: this.normalizePhone(phoneNumber),
                type: 'text',
                text: { body: text },
            }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(`WhatsApp API Error: ${error.error?.message || res.statusText}`);
        }

        const data = await res.json();
        const messageId = data.messages?.[0]?.id || 'unknown';
        return { messageId, status: 'sent' };
    }

    /**
     * Broadcast devotional to contacts with phone numbers.
     * If a WhatsApp Community Group ID is configured, posts to the community instead.
     * Otherwise, sends individual messages to each contact.
     */
    async broadcastDevotional(
        title: string,
        summary: string,
        webUrl?: string,
        filteredContacts?: Contact[]
    ): Promise<{ sent: number; failed: number; messageIds: string[] }> {
        if (!this.isEnabled()) {
            console.warn('WhatsApp service is not configured');
            return { sent: 0, failed: 0, messageIds: [] };
        }

        // ── Check for Community Group posting ────────────
        const communityGroupId = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_GROUP_ID;
        if (communityGroupId) {
            console.log(`📣 Posting to WhatsApp Community group: ${communityGroupId}`);
            try {
                const result = await this.sendToGroup(communityGroupId, title, summary, webUrl);
                return { sent: 1, failed: 0, messageIds: [result.messageId] };
            } catch (error: any) {
                console.error('WhatsApp Community post failed:', error.message);
                console.log('Falling back to individual messages...');
                // Fall through to individual broadcast
            }
        }

        // ── Individual broadcast fallback ────────────────
        let waContacts: Contact[];
        if (filteredContacts) {
            waContacts = filteredContacts.filter(c => c.phone && c.phone.trim());
        } else {
            const { getAllContacts } = await import('../firestore');
            const contacts = await getAllContacts();
            waContacts = contacts.filter(c => c.phone && c.phone.trim());
        }

        if (waContacts.length === 0) {
            console.log('No contacts with phone numbers for WhatsApp.');
            return { sent: 0, failed: 0, messageIds: [] };
        }

        let sent = 0;
        let failed = 0;
        const messageIds: string[] = [];

        for (const contact of waContacts) {
            try {
                // Try template message first (always allowed)
                const result = await this.sendTemplateMessage(
                    contact.phone!,
                    'daily_devotional',
                    'en_US',
                    [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: title },
                                { type: 'text', text: summary.substring(0, 500) },
                            ],
                        },
                    ]
                );
                messageIds.push(result.messageId);
                sent++;
            } catch (templateError: any) {
                // If template not found, try plain text (only works in 24h window)
                try {
                    let message = `📖 *${title}*\n\n${summary}`;
                    if (webUrl) {
                        message += `\n\nRead more: ${webUrl}`;
                    }
                    if (message.length > 4000) {
                        message = message.substring(0, 3997) + '...';
                    }

                    const result = await this.sendTextMessage(contact.phone!, message);
                    messageIds.push(result.messageId);
                    sent++;
                } catch (textError: any) {
                    console.error(`Failed to WhatsApp ${contact.name}:`, textError.message);
                    failed++;
                }
            }
        }

        console.log(`✅ WhatsApp broadcast: ${sent} sent, ${failed} failed`);
        return { sent, failed, messageIds };
    }

    /**
     * Send a message to a WhatsApp Group / Community Announcement channel.
     * Uses the Group ID to post a single message that all members see.
     */
    async sendToGroup(
        groupId: string,
        title: string,
        summary: string,
        webUrl?: string
    ): Promise<{ messageId: string; status: string }> {
        let message = `📖 *${title}*\n\n${summary}`;
        if (webUrl) {
            message += `\n\nRead the full devotional: ${webUrl}`;
        }
        message += '\n\n— Grace House Church ✝️';
        if (message.length > 4000) {
            message = message.substring(0, 3997) + '...';
        }

        const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: groupId,
                type: 'text',
                text: { body: message },
            }),
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(`WhatsApp Group API Error: ${error.error?.message || res.statusText}`);
        }

        const data = await res.json();
        const messageId = data.messages?.[0]?.id || 'unknown';
        console.log(`✅ Posted to WhatsApp Community: ${messageId}`);
        return { messageId, status: 'sent' };
    }

    /**
     * Normalize phone number to E.164 format.
     * Removes spaces, dashes, parentheses. Adds country code if missing.
     */
    private normalizePhone(phone: string): string {
        // Strip non-digit characters
        let cleaned = phone.replace(/[^\d+]/g, '');

        // If starts with +, keep as-is (already has country code)
        if (cleaned.startsWith('+')) {
            return cleaned.replace('+', '');
        }

        // If starts with 1 and is 11 digits (US), use as-is
        if (cleaned.startsWith('1') && cleaned.length === 11) {
            return cleaned;
        }

        // If 10 digits (US without country code), prepend 1
        if (cleaned.length === 10) {
            return '1' + cleaned;
        }

        return cleaned;
    }
}
