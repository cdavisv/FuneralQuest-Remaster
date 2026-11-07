"""Measure how alike each "Original, remastered" remake is to the original 2001 sound it remakes.

    <venv>/bin/python -I packages/audio/scripts/remasterCompare.py takes   # every downloaded take
    <venv>/bin/python -I packages/audio/scripts/remasterCompare.py pack    # the delivered pack

Runs only on this machine, on the locally extracted originals (`pnpm listen:originals`) and the
remakes; nothing is uploaded. For each pair it compares: length, tempo (loops), key, spectral
centroid, the spectral shape below 5 kHz (12 log bands, the band both share), onset count, the
loudness envelope (16 points), what a local tagger (PANNs, AudioSet) hears, and for remakes also
whether a speech screen (faster-whisper with voice-activity detection) finds words. Writes
`assets/audio-remaster/similarity.json` (pack) or prints a table (takes).
"""
import json
import os
import sys

import librosa
import numpy as np

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ORIG = os.environ.get("FQ_AUDIO_ORIGINAL_DIR", os.path.expanduser("~/.cache/fq-audio-original"))
SRC = os.path.expanduser("~/.cache/fq-audio-remaster/source")
PACK = os.path.join(REPO, "assets", "audio-remaster")
GENERIC = {"Music", "Musical instrument", "Sound effect", "Speech", "Inside, small room", "Silence", "Noise", "Animal", "Vehicle"}

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from remasterDescribe import key_of  # noqa: E402

_at = None


def tagger():
    global _at
    if _at is None:
        from panns_inference import AudioTagging, labels
        _at = (AudioTagging(checkpoint_path=None, device="cpu"), labels)
    return _at


def tags(y, sr):
    at, labels = tagger()
    y32 = librosa.resample(y, orig_sr=sr, target_sr=32000)
    if len(y32) < 32000:
        y32 = np.pad(y32, (0, 32000 - len(y32)))
    clip, _ = at.inference(y32[None, :])
    return clip[0], labels


def features(y, sr, loops):
    S = np.abs(librosa.stft(y, n_fft=512, hop_length=128))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=512)
    edges = np.geomspace(60, 5000, 13)
    p = (S ** 2).mean(axis=1)
    bands = np.array([p[(freqs >= edges[i]) & (freqs < edges[i + 1])].sum() for i in range(12)])
    shape = 10 * np.log10(bands / (bands.sum() or 1) + 1e-12)
    m = freqs < 5000
    cen = float((freqs[m][:, None] * S[m]).sum() / (S[m].sum() + 1e-12))
    rms = librosa.feature.rms(y=y, frame_length=256, hop_length=64)[0]
    db = 20 * np.log10(rms + 1e-9)
    env = np.interp(np.linspace(0, len(db) - 1, 16), np.arange(len(db)), db)
    on = librosa.onset.onset_detect(y=y, sr=sr, hop_length=64, units="time", delta=0.2)
    tempo = None
    if loops > 1:
        t, _ = librosa.beat.beat_track(y=np.tile(y, 4), sr=sr, hop_length=128)
        tempo = float(np.atleast_1d(t)[0])
    key, kr = key_of(y, sr)
    return {"shape": shape, "cen": cen, "env": env - env.max(), "onsets": len(on), "tempo": tempo, "key": key, "keyR": kr}


def trim_decoder(y, sr, seconds):
    """The original MP3s decode with about 0.14 s of decoder delay: skip it, keep the sample length."""
    nz = np.where(np.abs(y) > 1e-4)[0]
    start = max(0, min(int(0.14 * sr), int(nz[0]) if len(nz) else 0))
    return y[start:start + int(round(seconds * sr))]


def compare(orig_path, seconds, loops, remake_path, remake_seconds=None, speech=None):
    # both at the original's 11 kHz, so features see the band they share (below 5.5 kHz)
    sr = 11025
    yo, _ = librosa.load(orig_path, sr=sr, mono=True)
    yo = trim_decoder(yo, sr, seconds)
    yr, _ = librosa.load(remake_path, sr=sr, mono=True)
    if remake_seconds is not None:
        yr = yr[: int(round(remake_seconds * sr))]
    fo, fr = features(yo, sr, loops), features(yr, sr, loops)
    to, labels = tags(yo, sr)
    # the tagger hears the remake at full bandwidth
    yr_full, srf = librosa.load(remake_path, sr=32000, mono=True)
    if remake_seconds is not None:
        yr_full = yr_full[: int(round(remake_seconds * srf))]
    tr, _ = tags(yr_full, srf)
    top_o = [labels[i] for i in np.argsort(to)[::-1][:5]]
    top_r = [labels[i] for i in np.argsort(tr)[::-1][:5]]
    spec_o = [l for l in top_o if l not in GENERIC][:3]
    shared = [l for l in spec_o if tr[labels.index(l)] >= 0.05 or l in top_r]
    tag_cos = float(np.dot(to, tr) / (np.linalg.norm(to) * np.linalg.norm(tr) + 1e-12))
    shape_corr = float(np.corrcoef(fo["shape"], fr["shape"])[0, 1])
    env_corr = float(np.corrcoef(fo["env"], fr["env"])[0, 1]) if np.std(fo["env"]) > 0 and np.std(fr["env"]) > 0 else 0.0
    dur_r = len(yr) / max(1, len(yo))
    cen_r = fr["cen"] / max(1.0, fo["cen"])
    out = {
        "lengthOriginal": round(len(yo) / sr, 3), "lengthRemake": round(len(yr) / sr, 3), "lengthRatio": round(dur_r, 3),
        "centroidHz": [round(fo["cen"]), round(fr["cen"])],
        "bandShapeCorr": round(shape_corr, 3),
        "envelopeCorr": round(env_corr, 3),
        "onsets": [fo["onsets"], fr["onsets"]],
        "key": [f'{fo["key"]} ({fo["keyR"]:.2f})', f'{fr["key"]} ({fr["keyR"]:.2f})'],
        "tempo": [None if fo["tempo"] is None else round(fo["tempo"], 1), None if fr["tempo"] is None else round(fr["tempo"], 1)],
        "tagsOriginal": top_o, "tagsRemake": top_r, "tagCosine": round(tag_cos, 3),
        "sharedSpecificTags": shared,
    }
    if speech is not None:
        out["speech"] = speech
    # one number for ranking: the mean of the agreement scores, each in [0, 1]
    parts = [
        max(0.0, 1 - abs(np.log(dur_r)) / np.log(1.5)),
        max(0.0, shape_corr),
        (env_corr + 1) / 2,
        max(0.0, 1 - abs(np.log(max(cen_r, 1e-3))) / np.log(3)),
        max(0.0, tag_cos),
        max(0.0, 1 - abs(fo["onsets"] - fr["onsets"]) / max(4, fo["onsets"], fr["onsets"])),
    ]
    out["similarity"] = round(float(np.mean(parts)), 3)
    return out


_whisper = None


def speech_screen(path):
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=8)
    y, _ = librosa.load(path, sr=16000, mono=True)
    segs, _ = _whisper.transcribe(y, beam_size=1, temperature=0.0, vad_filter=True, condition_on_previous_text=False)
    hits = [s.text.strip() for s in segs if s.no_speech_prob < 0.5 and s.avg_logprob > -0.8 and len(s.text.strip()) > 3]
    return "no speech found" if not hits else "POSSIBLE SPEECH: " + " / ".join(hits)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "pack"
    brief = json.load(open(os.path.join(PACK, "brief.json")))
    by_id = {}
    for s in brief["sounds"]:
        r = s["remake"]
        by_id.setdefault(r["id"], s)
    if mode == "takes":
        only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
        rows = {}
        for f in sorted(os.listdir(SRC)):
            rid, gen = f[:-4].split("__")
            if only and rid not in only:
                continue
            s = by_id[rid]
            c = compare(os.path.join(ORIG, s["file"]), s["seconds"], s["loops"], os.path.join(SRC, f))
            rows.setdefault(rid, {})[gen] = c
            print(rid, gen, "sim", c["similarity"], "len", c["lengthRatio"], "shape", c["bandShapeCorr"], "env", c["envelopeCorr"], "cen", c["centroidHz"], "on", c["onsets"], "tags", c["tagsRemake"][:3], "shared", c["sharedSpecificTags"], "key", c["key"], "tempo", c["tempo"], flush=True)
        out = os.path.join(SRC, "..", "takes-similarity.json")
        prev = json.load(open(out)) if os.path.exists(out) else {}
        prev.update(rows)
        json.dump(prev, open(out, "w"), indent=1)
        return
    m = json.load(open(os.path.join(PACK, "manifest.json")))
    res = {}
    for ofile, t in sorted((m.get("originals") or {}).items()):
        s = next(x for x in brief["sounds"] if x["file"] == ofile)
        path = os.path.join(PACK, t["files"][0]["ogg"])
        a = t.get("loopStart") or 0
        length = (t["loopEnd"] - t["loopStart"]) if t.get("loop") and t.get("loopEnd") else None
        # decode the loop period only
        sr = 22050
        y, _ = librosa.load(path, sr=sr, mono=True, offset=a, duration=length)
        tmp = os.path.join(SRC, "..", "cmp.wav")
        import soundfile as sf
        sf.write(tmp, y, sr)
        c = compare(os.path.join(ORIG, ofile), s["seconds"], s["loops"], tmp, speech=speech_screen(tmp) if s["remake"]["id"] not in res else None)
        c["clippedSamples"] = int(np.sum(np.abs(y) >= 0.999))
        c["loopCheck"] = t.get("loopCheck")
        res[ofile] = c
        print(ofile, c["similarity"], c.get("speech"), flush=True)
    json.dump({"note": "Remake against original, measured locally (scripts/remasterCompare.py). similarity: mean of length, band shape, envelope, centroid, tagger and onset agreement, each 0..1.", "sounds": res}, open(os.path.join(PACK, "similarity.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
