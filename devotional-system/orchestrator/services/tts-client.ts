/**
 * Chatterbox TTS Client
 * Communicates with the local FastAPI TTS server.
 */

const TTS_SERVER_URL = process.env.TTS_SERVER_URL || 'http://localhost:8123';
const TTS_VOICE_ID = process.env.TTS_VOICE_ID || 'default';

export async function synthesizeAudio(
    text: string,
    voiceId: string = TTS_VOICE_ID,
    rate: string = '+0%',
    pitch: string = '+0Hz',
): Promise<Buffer> {
    const formData = new URLSearchParams();
    formData.append('text', text);
    formData.append('voice_id', voiceId);
    formData.append('rate', rate);
    formData.append('pitch', pitch);

    const response = await fetch(`${TTS_SERVER_URL}/synthesize`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`TTS synthesis failed: ${response.status} - ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

export async function checkTtsHealth(): Promise<{
    status: string;
    model_loaded: boolean;
    voices: string[];
}> {
    const response = await fetch(`${TTS_SERVER_URL}/health`);
    if (!response.ok) {
        throw new Error(`TTS server health check failed: ${response.status}`);
    }
    return response.json();
}

export async function listVoices(): Promise<{ id: string; name: string }[]> {
    const response = await fetch(`${TTS_SERVER_URL}/voices`);
    if (!response.ok) {
        throw new Error(`Failed to list voices: ${response.status}`);
    }
    const data = await response.json();
    return data.voices;
}
