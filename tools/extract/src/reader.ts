/** Bit and byte reader for SWF data (little-endian bytes, MSB-first bit fields). */
export class Reader {
  /** Absolute bit offset from the start of `buf`. */
  bit: number;

  constructor(
    readonly buf: Uint8Array,
    bytePos = 0,
    readonly end: number = buf.length,
  ) {
    this.bit = bytePos * 8;
  }

  get pos(): number {
    return (this.bit + 7) >> 3;
  }

  set pos(p: number) {
    this.bit = p * 8;
  }

  get eof(): boolean {
    return this.pos >= this.end;
  }

  align(): void {
    this.bit = (this.bit + 7) & ~7;
  }

  /** Unsigned bit field of n bits (n up to 32). */
  ub(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.buf[this.bit >> 3] ?? 0;
      v = v * 2 + ((byte >> (7 - (this.bit & 7))) & 1);
      this.bit++;
    }
    return v;
  }

  /** Signed bit field of n bits. */
  sb(n: number): number {
    if (n === 0) return 0;
    const v = this.ub(n);
    return v >= 2 ** (n - 1) ? v - 2 ** n : v;
  }

  /** 16.16 fixed point stored in n bits. */
  fb(n: number): number {
    return this.sb(n) / 65536;
  }

  u8(): number {
    this.align();
    const v = this.buf[this.bit >> 3] ?? 0;
    this.bit += 8;
    return v;
  }

  u16(): number {
    const lo = this.u8();
    return lo | (this.u8() << 8);
  }

  s16(): number {
    const v = this.u16();
    return v >= 0x8000 ? v - 0x10000 : v;
  }

  u32(): number {
    const lo = this.u16();
    return lo + this.u16() * 0x10000;
  }

  s32(): number {
    const v = this.u32();
    return v >= 0x80000000 ? v - 0x100000000 : v;
  }

  f32(): number {
    this.align();
    const dv = new DataView(this.buf.buffer, this.buf.byteOffset + (this.bit >> 3), 4);
    this.bit += 32;
    return dv.getFloat32(0, true);
  }

  bytes(n: number): Uint8Array {
    this.align();
    const p = this.bit >> 3;
    this.bit += n * 8;
    return this.buf.subarray(p, p + n);
  }

  rest(): Uint8Array {
    this.align();
    return this.buf.subarray(this.bit >> 3, this.end);
  }

  /** Null-terminated string, decoded as latin1. */
  cstring(): string {
    this.align();
    let p = this.bit >> 3;
    const start = p;
    while (p < this.end && this.buf[p] !== 0) p++;
    this.bit = (p + 1) * 8;
    return latin1(this.buf.subarray(start, p));
  }
}

export function latin1(b: Uint8Array): string {
  let s = "";
  for (const c of b) s += String.fromCharCode(c);
  return s;
}
