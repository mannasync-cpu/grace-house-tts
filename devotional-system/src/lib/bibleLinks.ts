/**
 * Bible Verse Auto-Linking
 * 
 * Detects Bible references in text and wraps them in hyperlinks to Bible Gateway (NIV).
 * 
 * Supported formats:
 *   - John 3:16
 *   - Genesis 1:1-3
 *   - 1 Corinthians 13:4-7
 *   - Psalm 23
 *   - Rev 21:1
 *   - Philippians 4:6-7
 */

const BIBLE_BOOKS = [
    // Old Testament
    'Genesis', 'Gen', 'Exodus', 'Exod', 'Ex', 'Leviticus', 'Lev',
    'Numbers', 'Num', 'Deuteronomy', 'Deut', 'Joshua', 'Josh',
    'Judges', 'Judg', 'Ruth', '1 Samuel', '1 Sam', '2 Samuel', '2 Sam',
    '1 Kings', '2 Kings', '1 Chronicles', '1 Chron', '2 Chronicles', '2 Chron',
    'Ezra', 'Nehemiah', 'Neh', 'Esther', 'Est',
    'Job', 'Psalms?', 'Ps', 'Proverbs?', 'Prov',
    'Ecclesiastes', 'Eccl', 'Song of Solomon', 'Song', 'Isaiah', 'Isa',
    'Jeremiah', 'Jer', 'Lamentations', 'Lam', 'Ezekiel', 'Ezek',
    'Daniel', 'Dan', 'Hosea', 'Hos', 'Joel', 'Amos',
    'Obadiah', 'Obad', 'Jonah', 'Micah', 'Mic', 'Nahum', 'Nah',
    'Habakkuk', 'Hab', 'Zephaniah', 'Zeph', 'Haggai', 'Hag',
    'Zechariah', 'Zech', 'Malachi', 'Mal',
    // New Testament
    'Matthew', 'Matt', 'Mark', 'Luke', 'John', 'Acts',
    'Romans', 'Rom', '1 Corinthians', '1 Cor', '2 Corinthians', '2 Cor',
    'Galatians', 'Gal', 'Ephesians', 'Eph', 'Philippians', 'Phil',
    'Colossians', 'Col', '1 Thessalonians', '1 Thess', '2 Thessalonians', '2 Thess',
    '1 Timothy', '1 Tim', '2 Timothy', '2 Tim', 'Titus', 'Philemon', 'Phlm',
    'Hebrews', 'Heb', 'James', 'Jas', '1 Peter', '1 Pet', '2 Peter', '2 Pet',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation', 'Rev',
];

// Build regex pattern from book names
const bookPattern = BIBLE_BOOKS
    .map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

// Matches: "John 3:16", "1 Cor 13:4-7", "Psalm 23", "Genesis 1:1-3"
const VERSE_REGEX = new RegExp(
    `\\b(${bookPattern})\\s+(\\d+)(?::(\\d+)(?:\\s*[-–—]\\s*(\\d+))?)?\\b`,
    'gi'
);

/**
 * Generate a Bible Gateway URL for a verse reference.
 */
function getBibleGatewayUrl(reference: string, version = 'NIV'): string {
    const encoded = encodeURIComponent(reference);
    return `https://www.biblegateway.com/passage/?search=${encoded}&version=${version}`;
}

/**
 * Process plain text and wrap Bible references in <a> tags.
 * Returns HTML string with linked references.
 */
export function linkBibleVerses(text: string): string {
    return text.replace(VERSE_REGEX, (match) => {
        const url = getBibleGatewayUrl(match);
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="bible-link" title="Read ${match} on Bible Gateway">${match}</a>`;
    });
}

/**
 * Process HTML content and wrap Bible references in links.
 * Avoids double-linking (references already inside <a> tags).
 */
export function linkBibleVersesInHtml(html: string): string {
    // Split HTML into text and tag parts to avoid modifying inside tags
    const parts = html.split(/(<[^>]+>)/g);

    let insideLink = false;
    return parts.map(part => {
        if (part.startsWith('<')) {
            // Track if we're inside an <a> tag
            if (part.startsWith('<a ') || part.startsWith('<a>')) insideLink = true;
            if (part.startsWith('</a')) insideLink = false;
            return part;
        }
        // Don't link inside existing <a> tags
        if (insideLink) return part;
        return linkBibleVerses(part);
    }).join('');
}
