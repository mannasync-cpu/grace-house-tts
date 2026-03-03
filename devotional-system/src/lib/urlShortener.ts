/**
 * URL Shortener Utility
 * Uses TinyURL API (free, no API key required) to shorten devotional links
 * for SMS and WhatsApp messages.
 */

export async function shortenUrl(longUrl: string): Promise<string> {
    try {
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (!response.ok) {
            console.warn(`URL shortener returned ${response.status}, using original URL`);
            return longUrl;
        }
        const shortUrl = await response.text();
        if (shortUrl && shortUrl.startsWith('http')) {
            console.log(`🔗 Shortened: ${longUrl} → ${shortUrl}`);
            return shortUrl;
        }
        return longUrl;
    } catch (error) {
        console.warn('URL shortener failed, using original URL:', error);
        return longUrl;
    }
}
