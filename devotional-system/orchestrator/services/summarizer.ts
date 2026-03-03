/**
 * Summarizer Service
 * Generates a 2-3 sentence summary from devotional text.
 * Uses a simple extractive approach (no external API needed).
 */

// Fallback rule-based summarizer
function ruleBasedSummary(text: string): string {
    if (!text || text.trim().length === 0) return 'No content available.';

    // Split into sentences
    const sentences = text
        .replace(/([.!?])\s+/g, '$1|')
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 20 && s.length < 300);

    if (sentences.length === 0) return text.substring(0, 200).trim() + '...';

    // Score sentences
    const scored = sentences.map((sentence, index) => {
        let score = 0;
        if (index === 0) score += 3;
        if (index === sentences.length - 1) score += 2;
        if (sentence.length > 50 && sentence.length < 200) score += 2;
        return { sentence, score, index };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
        .slice(0, Math.min(3, sentences.length))
        .sort((a, b) => a.index - b.index)
        .map((s) => s.sentence)
        .join(' ');
}

export async function generateSummary(text: string): Promise<string> {
    const apiKey = process.env.LLAMA_API_KEY;

    if (!apiKey) {
        console.log('No Llama API key found, using rule-based summarizer.');
        return ruleBasedSummary(text);
    }

    try {
        const response = await fetch('https://api.llama.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'Meta-Llama-3.1-70B-Instruct',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that summarizes daily devotionals. Keep the summary concise (2-3 sentences), uplifting, and accurate.'
                    },
                    {
                        role: 'user',
                        content: `Please summarize the following devotional text:\n\n${text}`
                    }
                ],
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Llama API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as any;
        const summary = data.choices[0]?.message?.content?.trim();

        if (!summary) throw new Error('Empty summary from Llama API');

        return summary;
    } catch (error) {
        console.error('Failed to generate summary with Llama API:', error);
        console.log('Falling back to rule-based summarizer.');
        return ruleBasedSummary(text);
    }
}
