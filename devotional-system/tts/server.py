"""
Edge-TTS FastAPI Server
Cloud-based TTS using Microsoft Edge's free neural voices.
No API key required. Unlimited usage.

Endpoints:
  POST /synthesize - Generate speech from text
  GET  /voices     - List available voice profiles
  GET  /health     - Server health check
"""

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import uuid
import asyncio
import edge_tts
from datetime import datetime
from pathlib import Path

app = FastAPI(title="Edge-TTS Server", version="2.0.0")

# CORS for admin dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# ─── Recommended voices for devotional narration ───────────────

RECOMMENDED_VOICES = {
    "default": {
        "id": "default",
        "name": "Default (Guy)",
        "voice_id": "en-US-GuyNeural",
        "description": "Warm, clear male voice — great for devotionals",
    },
    "guy": {
        "id": "guy",
        "name": "Guy (Male)",
        "voice_id": "en-US-GuyNeural",
        "description": "Warm, natural male voice",
    },
    "andrew": {
        "id": "andrew",
        "name": "Andrew (Male)",
        "voice_id": "en-US-AndrewNeural",
        "description": "Professional male voice",
    },
    "aria": {
        "id": "aria",
        "name": "Aria (Female)",
        "voice_id": "en-US-AriaNeural",
        "description": "Clear, expressive female voice",
    },
    "jenny": {
        "id": "jenny",
        "name": "Jenny (Female)",
        "voice_id": "en-US-JennyNeural",
        "description": "Warm, friendly female voice",
    },
    "davis": {
        "id": "davis",
        "name": "Davis (Male)",
        "voice_id": "en-US-DavisNeural",
        "description": "Deep, authoritative male voice",
    },
    "tony": {
        "id": "tony",
        "name": "Tony (Male)",
        "voice_id": "en-US-TonyNeural",
        "description": "Calm, steady male voice",
    },
    "brian": {
        "id": "brian",
        "name": "Brian (Male)",
        "voice_id": "en-US-BrianNeural",
        "description": "Conversational male voice",
    },
}


# ─── Endpoints ──────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": True,
        "device": "cloud",
        "engine": "edge-tts (Microsoft Neural Voices)",
        "voices": list(RECOMMENDED_VOICES.keys()),
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/voices")
async def list_voices():
    return {
        "voices": [
            {"id": v["id"], "name": v["name"], "description": v["description"]}
            for v in RECOMMENDED_VOICES.values()
        ]
    }


@app.get("/voices/all")
async def list_all_voices():
    """List ALL available Edge-TTS voices (hundreds)."""
    voices = await edge_tts.list_voices()
    return {
        "count": len(voices),
        "voices": [
            {
                "id": v["ShortName"],
                "name": v["FriendlyName"],
                "locale": v["Locale"],
                "gender": v["Gender"],
            }
            for v in voices
        ],
    }


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    voice_id: str = Form("default"),
    rate: str = Form("+0%"),
    pitch: str = Form("+0Hz"),
):
    """
    Generate speech from text.
    
    Args:
        text: The text to synthesize.
        voice_id: Voice key from recommended list, or a full Edge voice ID
                  (e.g. "en-US-GuyNeural").
        rate: Speech rate adjustment (e.g. "+10%", "-20%", "+0%").
        pitch: Pitch adjustment (e.g. "+5Hz", "-10Hz", "+0Hz").
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Resolve voice ID
    if voice_id in RECOMMENDED_VOICES:
        edge_voice = RECOMMENDED_VOICES[voice_id]["voice_id"]
    else:
        # Allow passing a raw Edge voice ID (e.g. "en-US-GuyNeural")
        edge_voice = voice_id

    output_filename = f"{datetime.now().strftime('%Y-%m-%d')}_{uuid.uuid4().hex[:8]}.mp3"
    output_path = OUTPUT_DIR / output_filename

    try:
        communicate = edge_tts.Communicate(text, edge_voice, rate=rate, pitch=pitch)
        await communicate.save(str(output_path))

        # Verify file was created and has content
        if not output_path.exists() or output_path.stat().st_size == 0:
            raise HTTPException(status_code=500, detail="Audio generation produced empty file")

        return FileResponse(
            str(output_path),
            media_type="audio/mpeg",
            filename=output_filename,
        )
    except Exception as e:
        # Clean up failed file
        if output_path.exists():
            output_path.unlink()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8123))
    print(f"Starting Edge-TTS Server on port {port}...")
    print("Engine: Microsoft Neural Voices (cloud-based, free, unlimited)")
    uvicorn.run(app, host="0.0.0.0", port=port)
