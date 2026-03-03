import { Contact } from '../types';

export class SnsService {
    private accessKeyId: string;
    private secretAccessKey: string;
    private region: string;

    constructor() {
        this.accessKeyId = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '';
        this.secretAccessKey = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '';
        this.region = process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1';
    }

    isEnabled(): boolean {
        return !!this.accessKeyId && !!this.secretAccessKey;
    }

    /**
     * Sign an AWS request using Signature V4 (minimal implementation for SNS Publish).
     */
    private async signRequest(body: string): Promise<{ headers: Record<string, string> }> {
        const host = `sns.${this.region}.amazonaws.com`;
        const now = new Date();
        const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
        const dateStamp = amzDate.substring(0, 8);
        const service = 'sns';
        const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;

        // Create canonical request
        const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'content-type;host;x-amz-date';

        const payloadHash = await this.sha256Hex(body);
        const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        // Create string to sign
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await this.sha256Hex(canonicalRequest)}`;

        // Derive signing key
        const kDate = await this.hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
        const kRegion = await this.hmacSha256Raw(kDate, this.region);
        const kService = await this.hmacSha256Raw(kRegion, service);
        const kSigning = await this.hmacSha256Raw(kService, 'aws4_request');

        // Create signature
        const signatureBytes = await this.hmacSha256Raw(kSigning, stringToSign);
        const signature = this.bufToHex(signatureBytes);

        const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': host,
                'X-Amz-Date': amzDate,
                'Authorization': authorizationHeader,
            },
        };
    }

    private async sha256Hex(message: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return this.bufToHex(new Uint8Array(hash));
    }

    private async hmacSha256(key: string, message: string): Promise<Uint8Array> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
        return new Uint8Array(sig);
    }

    private async hmacSha256Raw(key: Uint8Array, message: string): Promise<Uint8Array> {
        const encoder = new TextEncoder();
        const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
        const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
        return new Uint8Array(sig);
    }

    private bufToHex(buf: Uint8Array): string {
        return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Send an SMS to a single phone number via AWS SNS.
     */
    async sendSms(phoneNumber: string, message: string): Promise<{ messageId: string; status: string }> {
        if (!this.isEnabled()) {
            return { messageId: '', status: 'skipped_config_missing' };
        }

        const host = `sns.${this.region}.amazonaws.com`;
        const body = new URLSearchParams({
            Action: 'Publish',
            Message: message,
            PhoneNumber: phoneNumber,
            Version: '2010-03-31',
            'MessageAttributes.entry.1.Name': 'AWS.SNS.SMS.SMSType',
            'MessageAttributes.entry.1.Value.DataType': 'String',
            'MessageAttributes.entry.1.Value.StringValue': 'Promotional',
        }).toString();

        const { headers } = await this.signRequest(body);

        const res = await fetch(`https://${host}/`, {
            method: 'POST',
            headers,
            body,
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`SNS Publish failed: ${res.status} — ${errorText}`);
        }

        const responseText = await res.text();
        // Parse MessageId from XML response
        const messageIdMatch = responseText.match(/<MessageId>(.+?)<\/MessageId>/);
        const messageId = messageIdMatch ? messageIdMatch[1] : 'unknown';

        return { messageId, status: 'sent' };
    }

    /**
     * Send the daily devotional SMS to contacts.
     * Accepts an optional pre-filtered contact list from the orchestrator.
     */
    async broadcastDevotional(
        title: string,
        summary: string,
        webUrl?: string,
        filteredContacts?: Contact[]
    ): Promise<{ sent: number; failed: number; messageIds: string[] }> {
        if (!this.isEnabled()) {
            console.warn('AWS SNS is not configured (missing Access Key or Secret)');
            return { sent: 0, failed: 0, messageIds: [] };
        }

        // Use provided contacts or fetch all
        let smsContacts: Contact[];
        if (filteredContacts) {
            smsContacts = filteredContacts.filter(c => c.phone && c.phone.trim());
        } else {
            const { getAllContacts } = await import('../firestore');
            const contacts = await getAllContacts();
            smsContacts = contacts.filter(c => c.phone && c.phone.trim());
        }

        if (smsContacts.length === 0) {
            console.log('No contacts with phone numbers to SMS.');
            return { sent: 0, failed: 0, messageIds: [] };
        }

        // Build message (160 char SMS limit friendly)
        let message = `📖 ${title}\n\n${summary}`;
        if (webUrl) {
            message += `\n\n${webUrl}`;
        }
        // Trim to 320 chars (2 SMS segments max)
        if (message.length > 320) {
            message = message.substring(0, 317) + '...';
        }

        let sent = 0;
        let failed = 0;
        const messageIds: string[] = [];

        for (const contact of smsContacts) {
            try {
                const result = await this.sendSms(contact.phone!, message);
                messageIds.push(result.messageId);
                sent++;
            } catch (error) {
                console.error(`Failed to SMS ${contact.name}:`, error);
                failed++;
            }
        }

        console.log(`✅ SMS broadcast: ${sent} sent, ${failed} failed`);
        return { sent, failed, messageIds };
    }
}
