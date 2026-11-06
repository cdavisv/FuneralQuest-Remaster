import { readFileSync, writeFileSync } from "node:fs";
import type { Stereo } from "../src/dsp/core.js";

/** 32-bit float WAV, so nothing is lost between the render and the encoder. */
export function writeWav(path: string, buf: Stereo, sr: number, mono = false): void {
  const ch = mono ? 1 : 2;
  const n = buf.l.length;
  const data = Buffer.alloc(n * ch * 4);
  let o = 0;
  for (let i = 0; i < n; i++) {
    if (mono) {
      data.writeFloatLE(((buf.l[i] as number) + (buf.r[i] as number)) * 0.5, o);
      o += 4;
    } else {
      data.writeFloatLE(buf.l[i] as number, o);
      data.writeFloatLE(buf.r[i] as number, o + 4);
      o += 8;
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20); // IEEE float
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * ch * 4, 28);
  h.writeUInt16LE(ch * 4, 32);
  h.writeUInt16LE(32, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}

/** Reads raw little-endian f32 PCM (as ffmpeg -f f32le writes it) into channels. */
export function readF32(path: string, channels: number): Float32Array[] {
  const b = readFileSync(path);
  const n = Math.floor(b.length / 4 / channels);
  const out = Array.from({ length: channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels; c++)
      (out[c] as Float32Array)[i] = b.readFloatLE((i * channels + c) * 4);
  }
  return out;
}
