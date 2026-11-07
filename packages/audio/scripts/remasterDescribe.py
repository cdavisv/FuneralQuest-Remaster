"""Describe the original 2001 sounds locally, for the "Original, remastered" pack's prompts.

    <venv>/bin/python -I packages/audio/scripts/remasterDescribe.py [--out assets/audio-remaster/brief.json]

Reads the locally extracted originals (`pnpm listen:originals`, ~/.cache/fq-audio-original or
FQ_AUDIO_ORIGINAL_DIR) and measures each one ON THIS MACHINE: duration, how the 2001 game looped
it, tempo and beat regularity, key or pitch centre, spectral centroid / bandwidth / roll-off,
loudness and envelope, onsets, and what a local audio tagger (PANNs Cnn14, AudioSet labels) hears
in it. Nothing is uploaded anywhere; no audio, and nothing derived from the samples except these
numbers and words, leaves the machine or enters the repository. The measurements are merged with
what is known from the repository: the picture or screen that started each sound
(docs/reference/sound-inventory.md), the source file names the 2001 author's Flash projects
recorded (legacy/dist/flash/*.fla), and the new track that does the same job.

Needs numpy, librosa, soundfile, torch (CPU) and panns-inference in a user-level virtualenv.
"""
import json
import os
import subprocess
import sys

import librosa
import numpy as np

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
ORIG = os.environ.get("FQ_AUDIO_ORIGINAL_DIR", os.path.expanduser("~/.cache/fq-audio-original"))

# Loop counts of the sounds welcome.swf starts by script (sound-inventory.md: start(0, n)).
SCRIPT_LOOPS = {"welcome/intro.mp3": 1, "welcome/Map.mp3": 9999, "welcome/paper.mp3": 1}

# What the repository knows about each original, besides its samples: the screen or picture that
# starts it, the source file name in the author's Flash project (.fla), its role, the new track
# that does the same job (as on the listening page), and the kind of delivery it needs.
KNOWN = {
    "welcome/intro.mp3": ("Title screen intro music (welcome.swf, attached by script as 'intro', played once)", "fq_theme.wav", "music", ["main"]),
    "welcome/Map.mp3": ("Town map music (welcome.swf 'Map', looped 9999 times)", "country town.wav", "music-loop", ["town"]),
    "welcome/paper.mp3": ("Button press on the front door (welcome.swf 'paper')", "paper_flipping.wav", "sfx", []),
    "welcome/46.mp3": ("Unnamed sound attached by script in welcome.swf (character 46); no source name recorded", None, "sfx", []),
    "music/music_fight/1.mp3": ("Fight music, looped 999 times", "fight loop.wav (project also lists scary.wav)", "music-loop", ["battle"]),
    "music/music_sneak/1.mp3": ("Sneaking music at a rival's parlor, looped 999 times", "scary.wav", "music-loop", ["sneak"]),
    "places/palors/5.mp3": ("Rival parlors picture, looped 999 times", "mystery tinkle loop.wav", "music-loop", ["sneak"]),
    "places/yangs/6.mp3": ("Yang's restaurant picture, looped 999 times", "yangs.wav", "music-loop", ["yangs"]),
    "places/funeral-ceremony/2.mp3": ("Funeral ceremony picture, played once", "celemony.wav", "music", ["ceremony"]),
    "places/funeral-ceremony2/6.mp3": ("Second funeral ceremony picture, played once", "celemony.wav", "music", ["ceremony"]),
    "background/background_church/2.mp3": ("Church background picture, played once", "celemony.wav", "music", ["ceremony"]),
    "places/desk/12.mp3": ("The player's desk, looped 200 times", "clock.wav", "ambience", ["amb-clock"]),
    "places/desk_enemy/8.mp3": ("A rival's desk, looped 200 times", "clock.wav", "ambience", []),
    "background/background_1/2.mp3": ("Parlor background picture 1, played once", "bell_1.wav", "sfx", []),
    "background/background_2/2.mp3": ("Parlor background picture 2, played once", "bell_2.wav", "sfx", []),
    "background/background_3/2.mp3": ("Parlor background picture 3, played once", "bell_3.wav", "sfx", []),
    "background/background_4/2.mp3": ("Parlor background picture 4, played once", "bell_4.wav", "sfx", []),
    "background/background_5/2.mp3": ("Parlor background picture 5, played once", "bell_5.wav", "sfx", []),
    "places/embalming-room/3.mp3": ("Embalming room picture, looped 100 times", "water_bubble.wav", "ambience", ["amb-bubbles"]),
    "places/fire/5.mp3": ("Crematorium fire picture, looped 100 times", "fire.wav", "ambience", ["amb-fire"]),
    "places/hospital_desk/5.mp3": ("Hospital front desk picture, looped 999 times", "hospital lobby.wav", "ambience", ["amb-hospital"]),
    "places/hospital_room/9.mp3": ("Hospital room picture, looped 999 times", "heart monitor.wav", "ambience", ["amb-monitor"]),
    "closed/5.mp3": ("The parlor closed for the night, looped 100 times", "night_2.wav", "ambience", ["amb-night"]),
    "morning_coffee/5.mp3": ("Morning coffee picture (start of a day), looped 100 times", "bird.wav", "ambience", ["amb-birds"]),
    "places/hospital_ambulance/2.mp3": ("Hospital ambulance picture, played once", "police call.wav", "sfx", ["siren"]),
    "places/psych/7.mp3": ("The psychic at Spirit University, played once", "Cinematic 12 Harp 01.wav", "sfx", ["psychic"]),
    "stuff/money_bag/7.mp3": ("Money bag picture (a sale), played once", "money_lose.wav", "sfx", ["cash-register"]),
    "stuff/money_bag_2/9.mp3": ("Second money bag picture, played once", "cash register.wav", "sfx", ["coins"]),
    "stuff/toilet/3.mp3": ("Toilet picture, played once", "toilet_flush.wav", "sfx", ["toilet-flush"]),
    "stuff/battle_lose/2.mp3": ("Losing a fight, played once", "death gong sound.wav", "sfx", ["gong"]),
    "stuff/lottery_win/19.mp3": ("Scratch ticket, each scratch (winning ticket), played three times", "scratch_shot.wav", "sfx", ["bingo-ball"]),
    "stuff/lottery_win/25.mp3": ("Scratch ticket win, played once at the end", "cash register.wav", "sfx", ["bingo-win"]),
    "stuff/lottery_lose/19.mp3": ("Scratch ticket, each scratch (losing ticket), played three times", "scratch_shot.wav", "sfx", []),
    "stuff/lottery_lose/26.mp3": ("Scratch ticket loss, played once at the end", "loser edited.wav", "sfx", ["bingo-lose"]),
    "ring/ring/4.mp3": ("A ring picture, played once", "chimes1_akiko.wav", "sfx", ["glint"]),
    "ring/ring&hand/5.mp3": ("A ring in a hand, played once", "chimes1_akiko.wav", "sfx", []),
    "animals/dog-dragging-hand/2.mp3": ("A dog dragging a hand, played once", "dog_growl.wav", "sfx", ["growl"]),
    "mother/happy/5.mp3": ("A happy mother picture (good news), played once", "happy harp.wav", "sfx", ["harp-good-news"]),
    "people/jesus_happy/13.mp3": ("A happy Jesus picture, played once", "jesus.wav", "sfx", ["angelic"]),
    "wait/5.mp3": ("Waiting for a customer (wait.swf frame 20), played once", "wind_short_3.wav", "sfx", ["doorbell"]),
}

KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def key_of(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, fmin=librosa.note_to_hz("C2"), n_octaves=5).mean(axis=1)
    best = ("?", -2.0)
    for t in range(12):
        for mode, prof in (("major", KK_MAJOR), ("minor", KK_MINOR)):
            rot = np.roll(prof, t)
            r = float(np.corrcoef(chroma, rot)[0, 1])
            if r > best[1]:
                best = (f"{NAMES[t]} {mode}", r)
    return best


def lufs(path):
    res = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True)
    tail = res.stderr[res.stderr.rfind("Integrated loudness"):]
    import re
    m = re.search(r"I:\s+(-?[\d.]+) LUFS", tail)
    p = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", tail)
    return (float(m.group(1)) if m else None, float(p.group(1)) if p and p.group(1) != "-inf" else None)


def tagger():
    from panns_inference import AudioTagging, labels
    return AudioTagging(checkpoint_path=None, device="cpu"), labels


def main():
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(REPO, "assets", "audio-remaster", "brief.json")
    index = json.load(open(os.path.join(ORIG, "index.json")))
    at, labels = tagger()
    sounds = []
    for s in index["sounds"]:
        f = s["file"]
        path = os.path.join(ORIG, f)
        y, sr = librosa.load(path, sr=22050, mono=True)
        loops = max(s["loops"]) if s["loops"] else SCRIPT_LOOPS.get(f, 1)
        role, source, kind, tracks = KNOWN[f]
        dur = len(y) / sr
        # loudness, envelope, onsets
        rms = librosa.feature.rms(y=y, frame_length=512, hop_length=128)[0]
        db = 20 * np.log10(rms + 1e-9)
        pk = float(db.max())
        peak_t = float(np.argmax(db) * 128 / sr)
        after = np.where(db[np.argmax(db):] < pk - 20)[0]
        decay20 = float(after[0] * 128 / sr) if len(after) else None
        above = np.where(db > pk - 30)[0]
        attack = float(above[0] * 128 / sr) if len(above) else 0.0
        on = librosa.onset.onset_detect(y=y, sr=sr, hop_length=128, units="time", backtrack=False)
        env = [round(float(v - pk), 1) for v in np.interp(np.linspace(0, len(db) - 1, 16), np.arange(len(db)), db)]
        # spectrum
        S = np.abs(librosa.stft(y, n_fft=1024, hop_length=256))
        cen = float(librosa.feature.spectral_centroid(S=S, sr=sr).mean())
        bw = float(librosa.feature.spectral_bandwidth(S=S, sr=sr).mean())
        roll = float(librosa.feature.spectral_rolloff(S=S, sr=sr, roll_percent=0.85).mean())
        flat = float(librosa.feature.spectral_flatness(S=S).mean())
        # spectral shape below 5 kHz in 12 log bands (the band both share), dB re total
        freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
        edges = np.geomspace(60, 5000, 13)
        p = (S ** 2).mean(axis=1)
        bands = []
        for i in range(12):
            m = (freqs >= edges[i]) & (freqs < edges[i + 1])
            bands.append(float(p[m].sum()))
        tot = sum(bands) or 1.0
        shape = [round(10 * np.log10(b / tot + 1e-12), 1) for b in bands]
        # tempo: on the sound repeated as the game repeated it (up to 4 passes), for steady pulse
        reps = min(4, loops) if loops > 1 else 1
        yy = np.tile(y, reps)
        tempo, beats = librosa.beat.beat_track(y=yy, sr=sr, hop_length=256, units="time")
        tempo = float(np.atleast_1d(tempo)[0])
        ibi = np.diff(beats) if len(beats) > 2 else np.array([])
        regularity = float(np.std(ibi) / np.mean(ibi)) if len(ibi) > 2 else None
        # a loop's length in whole beats at that tempo (the loop must hold a whole number of beats)
        implied = None
        if loops > 1 and tempo > 0:
            # the loop length is the sample count (index), not the decoded file, which carries
            # the MP3 decoder's delay and padding (about 0.14 s before and 0.1 s after)
            n = s["seconds"]
            nbeats = max(1, round(n * tempo / 60))
            implied = {"beats": nbeats, "bpm": round(60 * nbeats / n, 2)}
        key, kr = key_of(y, sr)
        f0 = None
        try:
            f0s, voiced, _ = librosa.pyin(y, fmin=60, fmax=2000, sr=sr, frame_length=1024)
            fv = f0s[voiced] if voiced is not None else []
            if len(fv) > 5:
                f0 = {"medianHz": round(float(np.median(fv)), 1), "note": librosa.hz_to_note(float(np.median(fv))), "voicedShare": round(float(np.mean(voiced)), 2)}
        except Exception:
            pass
        # tagger at 32 kHz, padded to at least 1 s
        y32 = librosa.resample(y, orig_sr=sr, target_sr=32000)
        if len(y32) < 32000:
            y32 = np.pad(y32, (0, 32000 - len(y32)))
        clip, _ = at.inference(y32[None, :])
        top = np.argsort(clip[0])[::-1][:8]
        tags = [{"label": labels[i], "p": round(float(clip[0][i]), 3)} for i in top if clip[0][i] >= 0.02]
        il, tp = lufs(path)
        sounds.append({
            "file": f,
            "swf": s["swf"],
            "name": s.get("exportName") or f"sound {s['characterId']}",
            "role": role,
            "sourceName": source,
            "kind": kind,
            "tracks": tracks,
            "decodedSeconds": round(dur, 3),
            "seconds": s["seconds"],
            "loops": loops,
            "sampleRate": s["sampleRate"],
            "measured": {
                "lufs": il, "truePeakDb": tp,
                "attackSec": round(attack, 3), "peakAtSec": round(peak_t, 3), "decay20Sec": None if decay20 is None else round(decay20, 3),
                "envelopeDb16": env,
                "onsets": len(on), "onsetTimes": [round(float(t), 2) for t in on[:24]],
                "centroidHz": round(cen), "bandwidthHz": round(bw), "rolloff85Hz": round(roll), "flatness": round(flat, 4),
                "bandsBelow5kDb": shape,
                "tempoBpm": round(tempo, 1), "beatRegularity": None if regularity is None else round(regularity, 3),
                "loopBeats": implied,
                "key": key, "keyR": round(float(kr), 2),
                "pitch": f0,
                "tags": tags,
            },
        })
        print(f, round(dur, 2), "x", loops, kind, "tempo", round(tempo, 1), "reg", regularity, "key", key, round(kr, 2), "cen", round(cen), "onsets", len(on), [t["label"] + ":" + str(t["p"]) for t in tags[:4]], flush=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({
        "note": "Times are measured on the decoded MP3, which starts with about 0.14 s of decoder delay (so attack and peak times include it); the length that matters is `seconds`, from the sample count. Measurements of the original 2001 sounds, taken locally from the extracted files (never uploaded, never used as a generation input). Numbers and words only; no audio. The 'description' and 'prompt' fields are added by packages/audio/scripts/remasterBrief.ts.",
        "tagger": "PANNs Cnn14 (AudioSet 527 labels), CPU, on the clip resampled to 32 kHz",
        "sounds": sounds,
    }, open(out, "w"), indent=1)
    print("wrote", out)


if __name__ == "__main__":
    main()
