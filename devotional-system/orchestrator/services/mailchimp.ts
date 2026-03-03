/**
 * Mailchimp Service
 * Creates and sends email campaigns for daily devotionals.
 */

const mailchimp = require('@mailchimp/mailchimp_marketing');

const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY || '';
const MAILCHIMP_SERVER = process.env.MAILCHIMP_SERVER_PREFIX || 'us1';
const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID || '';
const FROM_EMAIL = process.env.MAILCHIMP_FROM_EMAIL || '';
const FROM_NAME = process.env.MAILCHIMP_FROM_NAME || 'Grace House Church';

// Initialize Mailchimp
mailchimp.setConfig({
  apiKey: MAILCHIMP_API_KEY,
  server: MAILCHIMP_SERVER,
});

interface CampaignData {
  title: string;
  body: string;
  date: string;
  author: string;
  audioUrl: string;
  summary: string;
  blogUrl: string;
}

export async function sendMailchimpCampaign(data: CampaignData): Promise<string> {
  if (!MAILCHIMP_API_KEY) {
    throw new Error('Mailchimp API key not configured');
  }

  // Format the date
  const dateObj = new Date(data.date + 'T12:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build email HTML
  const emailHtml = buildEmailTemplate(data, formattedDate);

  // Create campaign
  const campaign = await mailchimp.campaigns.create({
    type: 'regular',
    recipients: {
      list_id: MAILCHIMP_LIST_ID,
    },
    settings: {
      subject_line: `📖 Daily Devotional – ${formattedDate}`,
      preview_text: data.summary,
      title: `Devotional ${data.date}`,
      from_name: FROM_NAME,
      reply_to: FROM_EMAIL,
    },
  });

  // Set campaign content
  await mailchimp.campaigns.setContent(campaign.id, {
    html: emailHtml,
  });

  // Send campaign
  await mailchimp.campaigns.send(campaign.id);

  return campaign.id;
}

function buildEmailTemplate(data: CampaignData, formattedDate: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Devotional – ${formattedDate}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: Georgia, 'Times New Roman', serif; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #7c5cfc, #00d4aa); padding: 32px 24px; text-align: center; }
    .header h1 { color: white; font-size: 24px; margin: 0 0 8px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin: 0; }
    .content { padding: 32px 24px; line-height: 1.8; color: #333; font-size: 16px; }
    .content h2 { font-size: 22px; color: #1a1a2e; margin: 0 0 8px; }
    .meta { font-size: 13px; color: #888; margin-bottom: 24px; }
    .audio-cta { display: block; background: linear-gradient(135deg, #7c5cfc, #00d4aa); color: white; text-align: center; padding: 16px 24px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold; margin: 24px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
    .divider { height: 1px; background: #eee; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📖 Daily Devotional</h1>
      <p>${formattedDate}</p>
    </div>
    <div class="content">
      <h2>${data.title}</h2>
      <div class="meta">${data.author ? `By ${data.author} · ` : ''}${formattedDate}</div>
      ${data.body}
      ${data.audioUrl ? `
      <div class="divider"></div>
      <a href="${data.audioUrl}" class="audio-cta">🎧 Listen to Today's Devotional</a>
      ` : ''}
      ${data.blogUrl ? `
      <a href="${data.blogUrl}" style="display: block; text-align: center; padding: 12px 24px; color: #7c5cfc; font-size: 14px; text-decoration: underline; margin-top: 8px;">📰 Read on our website →</a>
      ` : ''}
    </div>
    <div class="footer">
      <p>Grace House Church · Daily Devotional</p>
      <p><a href="*|UNSUB|*" style="color: #999;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}
