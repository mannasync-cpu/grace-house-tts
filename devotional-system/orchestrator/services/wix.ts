/**
 * Wix Blog Service
 * Auto-publishes devotional posts to the Wix site.
 * Returns the published post ID and public URL.
 * 
 * Rich Content structure follows Wix's Ricos schema:
 * https://dev.wix.com/docs/rest/api-reference/wix-blog/posts/rich-content
 */

const WIX_API_KEY = process.env.WIX_API_KEY || process.env.NEXT_PUBLIC_WIX_API_KEY || '';
const WIX_SITE_ID = process.env.WIX_SITE_ID || process.env.NEXT_PUBLIC_WIX_SITE_ID || '';
const WIX_ACCOUNT_ID = process.env.WIX_ACCOUNT_ID || process.env.NEXT_PUBLIC_WIX_ACCOUNT_ID || '';
const WIX_SITE_URL = process.env.WIX_SITE_URL || 'https://www.gracehousechurch.org';
const WIX_API = 'https://www.wixapis.com/blog/v3';

interface BlogPostData {
    title: string;
    body: string;
    date: string;
    author: string;
    audioUrl: string;
    summary: string;
    scripture?: string;       // e.g. "Romans 8:1-2"
    scriptureText?: string;   // The actual verse text
}

export function isWixEnabled(): boolean {
    return !!WIX_API_KEY && !!WIX_SITE_ID;
}

export async function publishWixBlogPost(data: BlogPostData): Promise<{ id: string; url: string }> {
    if (!isWixEnabled()) {
        throw new Error('Wix API credentials not configured');
    }

    const richContent = buildRichContent(data);

    // Create a draft post
    const createResponse = await fetch(`${WIX_API}/draft-posts`, {
        method: 'POST',
        headers: {
            'Authorization': WIX_API_KEY,
            'wix-site-id': WIX_SITE_ID,
            'wix-account-id': WIX_ACCOUNT_ID,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            draftPost: {
                title: data.title,
                richContent,
                featured: true,
                commentingEnabled: true,
                excerpt: data.summary || data.body.replace(/<[^>]+>/g, '').substring(0, 160),
            },
        }),
    });

    if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Wix create draft failed: ${createResponse.status} - ${error}`);
    }

    const draft = await createResponse.json() as any;
    const draftPostId = draft.draftPost?.id;

    if (!draftPostId) {
        throw new Error('No draft post ID returned from Wix');
    }

    // Publish the draft
    const publishResponse = await fetch(`${WIX_API}/draft-posts/${draftPostId}/publish`, {
        method: 'POST',
        headers: {
            'Authorization': WIX_API_KEY,
            'wix-site-id': WIX_SITE_ID,
            'wix-account-id': WIX_ACCOUNT_ID,
            'Content-Type': 'application/json',
        },
    });

    if (!publishResponse.ok) {
        const error = await publishResponse.text();
        throw new Error(`Wix publish failed: ${publishResponse.status} - ${error}`);
    }

    const published = await publishResponse.json() as any;
    const postId = published.post?.id || draftPostId;
    const slug = published.post?.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const blogUrl = `${WIX_SITE_URL}/post/${slug}`;

    return { id: postId, url: blogUrl };
}


// ─── Rich Content Builder ──────────────────────────────────────

function textNode(text: string, decorations: any[] = []) {
    return {
        type: 'TEXT',
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        textData: { text, decorations },
    };
}

function paragraphNode(children: any[], style?: string) {
    const node: any = {
        type: 'PARAGRAPH',
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        nodes: children,
    };
    if (style) {
        node.paragraphData = { textStyle: { textAlignment: 'AUTO' } };
    }
    return node;
}

function headingNode(text: string, level: number = 2) {
    return {
        type: 'HEADING',
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        nodes: [textNode(text)],
        headingData: { level },
    };
}

function dividerNode() {
    return {
        type: 'DIVIDER',
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        dividerData: {
            containerData: { width: { size: 'CONTENT' }, alignment: 'CENTER' },
            type: 'SINGLE',
            width: 'LARGE',
        },
    };
}

function blockquoteNode(children: any[]) {
    return {
        type: 'BLOCKQUOTE',
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        nodes: children,
    };
}

function buildRichContent(data: BlogPostData) {
    const nodes: any[] = [];

    // ─── 1. Date & Author metadata ──────────────────────────────
    const dateObj = new Date(data.date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    nodes.push(
        paragraphNode([
            textNode(
                `${data.author ? `By ${data.author}` : 'Grace Daily Devotional'} · ${formattedDate}`,
                [{ type: 'ITALIC' }, { type: 'COLOR', colorData: { foreground: '#999999' } }],
            ),
        ]),
    );

    // ─── 2. Scripture blockquote ────────────────────────────────
    // Try to extract scripture from the body if not provided separately
    const scriptureRef = data.scripture || extractScriptureRef(data.body);
    const scriptureText = data.scriptureText || extractScriptureText(data.body);

    if (scriptureText) {
        const quoteChildren: any[] = [];

        // Scripture text in italics
        quoteChildren.push(
            paragraphNode([
                textNode(`"${scriptureText.replace(/^[""]|[""]$/g, '')}"`, [{ type: 'ITALIC' }]),
            ]),
        );

        // Scripture reference in bold
        if (scriptureRef) {
            quoteChildren.push(
                paragraphNode([
                    textNode(`— ${scriptureRef}`, [{ type: 'BOLD' }]),
                ]),
            );
        }

        nodes.push(blockquoteNode(quoteChildren));
        nodes.push(dividerNode());
    }

    // ─── 3. Body content ────────────────────────────────────────
    // Split HTML body into paragraphs
    const bodyText = data.body.replace(/<[^>]+>/g, '').trim();
    const paragraphs = bodyText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    // Skip the first paragraph if it's the scripture we already extracted
    const startIdx = scriptureText && paragraphs[0]?.includes(scriptureText.substring(0, 30)) ? 1 : 0;

    for (let i = startIdx; i < paragraphs.length; i++) {
        nodes.push(paragraphNode([textNode(paragraphs[i])]));
    }

    // ─── 4. Audio section ───────────────────────────────────────
    if (data.audioUrl) {
        nodes.push(dividerNode());
        nodes.push(
            headingNode('🎧 Listen to Today\'s Devotional', 3),
        );
        nodes.push(
            paragraphNode([
                textNode('Tap below to listen to the audio version of this devotional.'),
            ]),
        );
        nodes.push(
            paragraphNode([
                textNode('▶️ Play Audio', [
                    {
                        type: 'LINK',
                        linkData: { link: { url: data.audioUrl, target: '_BLANK' } },
                    },
                    { type: 'BOLD' },
                ]),
            ]),
        );
    }

    // ─── 5. Closing & share prompt ──────────────────────────────
    nodes.push(dividerNode());
    nodes.push(
        paragraphNode([
            textNode('📖 ', []),
            textNode('Was this devotional a blessing? Share it with someone who needs encouragement today.', [
                { type: 'ITALIC' },
                { type: 'COLOR', colorData: { foreground: '#999999' } },
            ]),
        ]),
    );

    // Footer
    nodes.push(
        paragraphNode([
            textNode('— Grace House Church · ', [{ type: 'BOLD' }]),
            textNode('gracehousechurch.org', [
                {
                    type: 'LINK',
                    linkData: { link: { url: 'https://www.gracehousechurch.org', target: '_BLANK' } },
                },
            ]),
        ]),
    );

    return { nodes };
}


// ─── Helpers ───────────────────────────────────────────────────

/**
 * Try to extract a scripture reference like "Romans 8:1-2" from text.
 */
function extractScriptureRef(body: string): string | null {
    const plainText = body.replace(/<[^>]+>/g, '');
    // Match patterns like "(Romans 8:1-2)" or "Romans 8:1–2"
    const match = plainText.match(
        /\(?\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1\s*Samuel|2\s*Samuel|1\s*Kings|2\s*Kings|1\s*Chronicles|2\s*Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs?|Ecclesiastes|Song\s*of\s*Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1\s*Corinthians|2\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|1\s*Thessalonians|2\s*Thessalonians|1\s*Timothy|2\s*Timothy|Titus|Philemon|Hebrews|James|1\s*Peter|2\s*Peter|1\s*John|2\s*John|3\s*John|Jude|Revelation)\s+\d+[:\d\-–,\s]*\)?\b/i,
    );
    return match ? match[0].replace(/^\(|\)$/g, '').trim() : null;
}

/**
 * Try to extract the scripture quote text (typically in quotes or before the reference).
 */
function extractScriptureText(body: string): string | null {
    const plainText = body.replace(/<[^>]+>/g, '');
    // Match text between quotation marks (curly or straight)
    const match = plainText.match(/["""]([^"""]{20,300})["""]/);
    return match ? match[1].trim() : null;
}
