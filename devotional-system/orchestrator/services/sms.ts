/**
 * Twilio SMS Service
 * Sends daily devotional summary + blog link via SMS.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || '';
const TWILIO_API = 'https://api.twilio.com/2010-04-01';

interface SmsData {
    title: string;
    date: string;
    summary: string;
    blogUrl: string;
}

export function isSmsEnabled(): boolean {
    return !!TWILIO_SID && !!TWILIO_TOKEN && !!TWILIO_PHONE;
}

/**
 * Send an SMS to a single recipient.
 */
export async function sendSms(to: string, data: SmsData): Promise<string> {
    if (!isSmsEnabled()) {
        throw new Error('Twilio SMS credentials not configured');
    }

    // Format the date
    const dateObj = new Date(data.date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    // Build concise SMS message (160 char target, 320 max)
    const message = [
        `📖 ${data.title}`,
        `${formattedDate}`,
        '',
        data.summary.length > 120
            ? data.summary.substring(0, 117) + '...'
            : data.summary,
        '',
        `Read & Listen: ${data.blogUrl}`,
        '',
        '— Grace House Church',
    ].join('\n');

    // Twilio REST API (Basic Auth)
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

    const body = new URLSearchParams();
    body.append('To', to);
    body.append('From', TWILIO_PHONE);
    body.append('Body', message);

    const response = await fetch(
        `${TWILIO_API}/Accounts/${TWILIO_SID}/Messages.json`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        },
    );

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Twilio SMS error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    return result.sid || 'sent';
}

/**
 * Send SMS to all opted-in contacts from Firestore.
 * Returns count of messages sent.
 */
export async function sendBulkSms(
    data: SmsData,
    contacts: { phone: string; name: string }[],
): Promise<{ sent: number; failed: number; messageIds: string[] }> {
    const results = { sent: 0, failed: 0, messageIds: [] as string[] };

    for (const contact of contacts) {
        if (!contact.phone) continue;

        try {
            const messageId = await sendSms(contact.phone, data);
            results.sent++;
            results.messageIds.push(messageId);
        } catch (err) {
            console.error(`SMS failed for ${contact.name}: ${err}`);
            results.failed++;
        }

        // Rate limit: Twilio allows ~1 msg/sec on trial
        await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    return results;
}
