"""Transcribes voice clips back to text, for the voice pack's word check (scripts/voiceBuild.ts).

Usage: python voiceTranscribe.py OUT.json FILE...

Runs faster-whisper (the "small" English-capable model, CPU, int8) with no prompt and no prior
text, so the transcript is not steered towards the script; writes {file: text} as JSON. Install
it user-level, outside the repository, for example:

    uv venv ~/.local/share/fq-stt/.venv && uv pip install --python ~/.local/share/fq-stt/.venv/bin/python faster-whisper

and point FQ_STT_PYTHON at that interpreter. FQ_STT_MODEL picks another model size.
"""

import json
import os
import subprocess
import sys

import numpy as np
from faster_whisper import WhisperModel


def load(path: str) -> np.ndarray:
    """Decodes with the system's ffmpeg to 16 kHz mono float (the model's input)."""
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def main() -> None:
    out, files = sys.argv[1], sys.argv[2:]
    model = WhisperModel(os.environ.get("FQ_STT_MODEL", "small"), device="cpu", compute_type="int8")
    result = {}
    for path in files:
        segments, _info = model.transcribe(
            load(path),
            language="en",
            beam_size=5,
            condition_on_previous_text=False,
            vad_filter=False,
            temperature=0.0,
        )
        result[path] = " ".join(s.text.strip() for s in segments).strip()
        print(f"{os.path.basename(path)}: {result[path]}", file=sys.stderr)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
