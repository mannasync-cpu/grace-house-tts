/**
 * WhatsApp Business Cloud API Service
 * Sends daily devotional messages via Meta's WhatsApp Business API.
 * Includes summary + blog link.
 */

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.NEXT_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_API = 'https://graph.facebook.com/v21.0';

interface WhatsAppMessageData {
    title: string;
    date: string;
    summary: string;
    audioUrl: string;
    blogUrl: string;
}

export function isWhatsAppEnabled(): boolean {
    return !!WHATSAPP_TOKEN && !!PHONE_NUMBER_ID;
}

/**
 * Send a text message to a single recipient.
 * For first-contact: use sendWhatsAppTemplateMessage() instead.
 */
export async function sendWhatsAppMessage(
    to: string,
    data: WhatsAppMessageData,
): Promise<string> {
    if (!isWhatsAppEnabled()) {
        throw new Error('WhatsApp API credentials not configured');
    }

    // Format the date
    const dateObj = new Date(data.date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    // Build the message text
    const messageText = [
        `📖 *Daily Devotional – ${formattedDate}*`,
        `*${data.title}*`,
        '',
        data.summary,
        '',
        data.blogUrl ? `📰 Read: ${data.blogUrl}` : '',
        data.audioUrl ? `🎧 Listen: ${data.audioUrl}` : '',
        '',
        '— Grace House Church',
    ]
        .filter(Boolean)
        .join('\n');

    const response = await fetch(`${WHATSAPP_API}/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: messageText },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json() as any;
    return result.messages?.[0]?.id || 'sent';
}

/**
 * Send a template-based message (required for first-contact messaging).
 */
export async function sendWhatsAppTemplateMessage(
    recipientPhone: string,
    templateName: string,
    params: { title: string; summary: string; blogUrl: string; audioUrl: string },
): Promise<string> {
    const response = await fetch(`${WHATSAPP_API}/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipientPhone,
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'en' },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: params.title },
                            { type: 'text', text: params.summary },
                            { type: 'text', text: params.blogUrl },
                        ],
                    },
                ],
            },
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp template error: ${JSON.stringify(error)}`);
    }

    const result = await response.json() as any;
    return result.messages?.[0]?.id || 'sent';
}

/**
 * Send WhatsApp to all opted-in contacts.
 */
export async function sendBulkWhatsApp(
    data: WhatsAppMessageData,
    contacts: { phone: string; name: string }[],
): Promise<{ sent: number; failed: number }> {
    const results = { sent: 0, failed: 0 };

    for (const contact of contacts) {
        if (!contact.phone) continue;

        try {
            await sendWhatsAppMessage(contact.phone, data);
            results.sent++;
        } catch (err) {
            console.error(`WhatsApp failed for ${contact.name}: ${err}`);
            results.failed++;
        }

        // Rate limit: ~80 msgs/sec allowed, but be conservative
        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
}
