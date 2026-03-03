import { Devotional } from '../types';

export class MailchimpService {
  private apiKey: string;
  private serverPrefix: string;
  private listId: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_MAILCHIMP_API_KEY || '';
    this.serverPrefix = process.env.NEXT_PUBLIC_MAILCHIMP_SERVER_PREFIX || '';
    this.listId = process.env.NEXT_PUBLIC_MAILCHIMP_LIST_ID || '';
    this.fromEmail = process.env.NEXT_PUBLIC_MAILCHIMP_FROM_EMAIL || 'admin@gracehousechurch.org';
    this.fromName = process.env.NEXT_PUBLIC_MAILCHIMP_FROM_NAME || 'Grace House Daily Devotional';
  }

  private get baseUrl(): string {
    return `https://${this.serverPrefix}.api.mailchimp.com/3.0`;
  }

  private get authHeader(): string {
    return `Basic ${btoa(`anystring:${this.apiKey}`)}`;
  }

  isEnabled(): boolean {
    return !!this.apiKey && !!this.serverPrefix && !!this.listId;
  }

  /**
   * Helper to call Mailchimp via the TTS/proxy server (avoids CORS).
   */
  private async proxyFetch(endpoint: string, method: string, body?: any): Promise<any> {
    const proxyUrl = process.env.NEXT_PUBLIC_TTS_SERVER_URL || '';
    if (!proxyUrl) throw new Error('TTS/Proxy server URL not configured');

    const res = await fetch(`${proxyUrl}/mailchimp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.apiKey,
        server_prefix: this.serverPrefix,
        endpoint,
        method,
        body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Mailchimp proxy error: ${res.status} ${errText}`);
    }

    return res.json();
  }

  async sendCampaign(devotional: Devotional): Promise<{ id: string; status: string }> {
    if (!this.isEnabled()) {
      console.warn('Mailchimp service is not configured (missing API Key, Server Prefix, or List ID)');
      return { id: '', status: 'skipped_config_missing' };
    }

    try {
      // 1. Create Campaign (via proxy)
      const campaign = await this.proxyFetch('/campaigns', 'POST', {
        type: 'regular',
        recipients: { list_id: this.listId },
        settings: {
          subject_line: `📖 ${devotional.title}`,
          title: devotional.title,
          from_name: this.fromName,
          reply_to: this.fromEmail,
        },
      });

      const campaignId = campaign.id;

      // 2. Set Campaign Content (HTML email via proxy)
      const htmlContent = this.buildEmailHtml(devotional);
      await this.proxyFetch(`/campaigns/${campaignId}/content`, 'PUT', { html: htmlContent });

      // 3. Send Campaign (via proxy)
      await this.proxyFetch(`/campaigns/${campaignId}/actions/send`, 'POST');

      console.log(`✅ Mailchimp campaign sent: ${campaignId} — "${devotional.title}"`);
      return { id: campaignId, status: 'sent' };

    } catch (error) {
      console.error('❌ Mailchimp campaign error:', error);
      throw error;
    }
  }

  public buildEmailHtml(devotional: Devotional): string {
    // ─── Header Image (fixed 600×250, no distortion) ───────────
    const headerImg = devotional.headerImage?.url
      ? `<div style="width:600px;height:250px;overflow:hidden;background:#f0f0f0;">
                 ${devotional.headerImage.link ? `<a href="${devotional.headerImage.link}" target="_blank">` : ''}
                 <img src="${devotional.headerImage.url}"
                      alt="${devotional.headerImage.alt || 'Header'}"
                      width="600" height="250"
                      style="display:block;width:600px;height:250px;object-fit:cover;border:0;" />
                 ${devotional.headerImage.link ? '</a>' : ''}
               </div>`
      : '';

    // ─── Audio Section ─────────────────────────────────────────
    const audioSection = devotional.audioUrl
      ? `<tr><td style="padding:0 24px;">
                 <div style="margin:24px 0;padding:16px;background:#f0f4ff;border-radius:8px;text-align:center;">
                   <p style="margin:0 0 8px;font-size:14px;color:#555;">🎧 Listen to today's devotional:</p>
                   <a href="${devotional.audioUrl}" style="display:inline-block;padding:12px 28px;background:#6c5ce7;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">
                     ▶ Play Audio
                   </a>
                 </div>
               </td></tr>`
      : '';

    // ─── Summary Section ───────────────────────────────────────
    const summarySection = devotional.summary
      ? `<tr><td style="padding:0 24px;">
                 <div style="margin:16px 0;padding:16px;background:#f9f9f9;border-left:4px solid #6c5ce7;border-radius:4px;">
                   <p style="margin:0;font-style:italic;color:#555;line-height:1.6;">${devotional.summary}</p>
                 </div>
               </td></tr>`
      : '';

    // ─── Footer Images (fixed 600×200 each, no distortion) ────
    const footerImgs = (devotional.footerImages || [])
      .filter(img => img.url)
      .map(img => {
        const width = img.position === 'half' ? 290 : 600;
        return `<div style="width:${width}px;height:200px;overflow:hidden;background:#f0f0f0;${img.position === 'half' ? 'display:inline-block;' : ''}">
                          ${img.link ? `<a href="${img.link}" target="_blank">` : ''}
                          <img src="${img.url}"
                               alt="${img.alt || 'Footer'}"
                               width="${width}" height="200"
                               style="display:block;width:${width}px;height:200px;object-fit:cover;border:0;" />
                          ${img.link ? '</a>' : ''}
                          ${img.caption ? `<p style="margin:4px 0 0;font-size:11px;color:#999;text-align:center;">${img.caption}</p>` : ''}
                        </div>`;
      })
      .join('\n');

    const footerSection = footerImgs
      ? `<tr><td style="padding:16px 24px 0;" align="center">${footerImgs}</td></tr>`
      : '';

    // ─── Full Email Template ───────────────────────────────────
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]><style>body{font-family:Arial,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <center>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin:0 auto;background:#ffffff;">
      <!-- Header Image -->
      ${headerImg ? `<tr><td style="padding:0;">${headerImg}</td></tr>` : ''}

      <!-- Title & Date -->
      <tr><td style="padding:32px 24px 8px;">
        <h1 style="margin:0;font-size:24px;color:#2d3436;font-weight:700;">📖 ${devotional.title}</h1>
      </td></tr>
      <tr><td style="padding:0 24px 24px;">
        <p style="margin:0;font-size:14px;color:#999;">
          ${devotional.date} &bull; by ${devotional.author || 'Grace House Church'}
        </p>
      </td></tr>

      <!-- Summary -->
      ${summarySection}

      <!-- Audio Player Button -->
      ${audioSection}

      <!-- Body Content -->
      <tr><td style="padding:16px 24px 32px;">
        <div style="font-size:16px;line-height:1.7;color:#333;">
          ${devotional.body || devotional.plainText || ''}
        </div>
      </td></tr>

      <!-- Footer Images (Ads/Branding) -->
      ${footerSection}

      <!-- Footer -->
      <tr><td style="padding:20px 24px;background:#f9f9f9;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;font-size:12px;color:#999;">
          Grace House Church &bull; Daily Devotional<br/>
          <a href="https://www.gracehousechurch.org" style="color:#6c5ce7;text-decoration:none;">gracehousechurch.org</a>
        </p>
        <p style="margin:8px 0 0;font-size:10px;color:#ccc;">
          <a href="*|UNSUB|*" style="color:#999;">Unsubscribe</a>
        </p>
      </td></tr>
    </table>
  </center>
</body>
</html>`;
  }
}
