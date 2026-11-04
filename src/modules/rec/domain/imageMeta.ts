/**
 * R104 / PDPL data minimisation: a phone photo usually carries the GPS position of the customer's home or parking place,
 * which the garage has no business reason to keep. Metadata is removed from the bytes when the photo is accepted, with no
 * image library: the container is walked and the metadata segments are left out; the pixel data is copied untouched.
 *  - JPEG: APPn (EXIF, XMP, IPTC, ...) except APP0 and the ICC profile (APP2), and COM, are dropped. The EXIF orientation
 *    is the only thing kept, in a minimal EXIF block, so the photo still shows the right way up (no re-encode).
 *  - PNG: eXIf, tEXt, zTXt, iTXt and tIME chunks are dropped.
 *  - WebP: EXIF and XMP chunks are dropped and the VP8X flags and RIFF size are fixed.
 * Returns null when the container is malformed (the caller refuses the file).
 */
export type StrippableType = 'image/jpeg' | 'image/png' | 'image/webp';

const u16 = (b: Uint8Array, i: number): number => (b[i]! << 8) | b[i + 1]!;
const u32le = (b: Uint8Array, i: number): number =>
  (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const u32be = (b: Uint8Array, i: number): number =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number): string =>
  String.fromCharCode(...b.subarray(i, i + n));

/** EXIF orientation (1..8) from an APP1 segment body (after the length), or 1 */
function exifOrientation(seg: Uint8Array): number {
  // seg = "Exif\0\0" + TIFF
  if (seg.length < 6 + 8 || ascii(seg, 0, 4) !== 'Exif') return 1;
  const t = seg.subarray(6);
  const le = ascii(t, 0, 2) === 'II';
  if (!le && ascii(t, 0, 2) !== 'MM') return 1;
  const r16 = (i: number) => (le ? t[i]! | (t[i + 1]! << 8) : (t[i]! << 8) | t[i + 1]!);
  const r32 = (i: number) =>
    le
      ? (t[i]! | (t[i + 1]! << 8) | (t[i + 2]! << 16) | (t[i + 3]! << 24)) >>> 0
      : ((t[i]! << 24) | (t[i + 1]! << 16) | (t[i + 2]! << 8) | t[i + 3]!) >>> 0;
  const ifd = r32(4);
  if (ifd + 2 > t.length) return 1;
  const n = r16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) return 1;
    if (r16(e) === 0x0112) {
      const v = r16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** an EXIF block holding the orientation tag only (big-endian) */
function orientationOnlyExif(o: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xe1,
    0x00,
    0x22,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // marker, length 34, "Exif\0\0"
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // TIFF header, IFD0 at 8
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    o,
    0x00,
    0x00, // one entry: orientation
    0x00,
    0x00,
    0x00,
    0x00, // no next IFD
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const head: Uint8Array[] = []; // APP0 (JFIF)
  const rest: Uint8Array[] = [];
  let orientation = 1;
  let i = 2;
  let sawScan = false;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i + 1] === 0xff) i++; // fill bytes
    const m = b[i + 1];
    if (m === undefined) return null;
    if (m === 0xda) {
      // start of scan: everything after is entropy-coded data up to EOI, copied as it is
      if (i + 4 > b.length) return null;
      rest.push(b.subarray(i));
      sawScan = true;
      break;
    }
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      rest.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 4 > b.length) return null;
    const len = u16(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    const seg = b.subarray(i, i + 2 + len);
    if (m === 0xe0) head.push(seg);
    else if (m === 0xe1 && orientation === 1) orientation = exifOrientation(seg.subarray(4));
    else if (m === 0xe2 && ascii(seg, 4, 11) === 'ICC_PROFILE') rest.push(seg);
    else if ((m >= 0xe1 && m <= 0xef) || m === 0xfe) {
      // APP1..APP15 (EXIF, XMP, IPTC, ...) and comments are left out
    } else rest.push(seg);
    i += 2 + len;
  }
  if (!sawScan) return null;
  return concat([
    Uint8Array.of(0xff, 0xd8),
    ...head,
    ...(orientation > 1 ? [orientationOnlyExif(orientation)] : []),
    ...rest,
  ]);
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(b: Uint8Array): Uint8Array | null {
  if (b.length < 8 + 12) return null;
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  let end = false;
  while (i < b.length) {
    if (i + 12 > b.length) return null;
    const len = u32be(b, i);
    const total = 12 + len;
    if (i + total > b.length) return null;
    const type = ascii(b, i + 4, 4);
    if (!PNG_DROP.has(type)) parts.push(b.subarray(i, i + total));
    i += total;
    if (type === 'IEND') {
      end = true;
      break;
    }
  }
  return end ? concat(parts) : null;
}

function stripWebp(b: Uint8Array): Uint8Array | null {
  if (b.length < 12 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const riffEnd = Math.min(b.length, 8 + u32le(b, 4));
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= riffEnd) {
    const size = u32le(b, i + 4);
    const total = 8 + size + (size % 2);
    if (i + 8 + size > riffEnd) return null;
    const type = ascii(b, i, 4);
    const raw = b.slice(i, Math.min(i + total, riffEnd));
    // the pad byte may be cut at the very end of a file: add it so the chunk stays even
    const chunk = raw.length < total ? concat([raw, new Uint8Array(total - raw.length)]) : raw;
    if (type === 'VP8X' && size >= 10) chunk[8] = chunk[8]! & ~0x0c; // no EXIF (0x08) / XMP (0x04) flag
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(chunk);
    i += total;
  }
  if (chunks.length === 0) return null;
  const body = concat(chunks);
  const out = new Uint8Array(12 + body.length);
  out.set(b.subarray(0, 12));
  out[4] = (4 + body.length) & 0xff;
  out[5] = ((4 + body.length) >>> 8) & 0xff;
  out[6] = ((4 + body.length) >>> 16) & 0xff;
  out[7] = ((4 + body.length) >>> 24) & 0xff;
  out.set(body, 12);
  return out;
}

export function stripImageMetadata(bytes: Uint8Array, type: StrippableType): Uint8Array | null {
  try {
    if (type === 'image/jpeg') return stripJpeg(bytes);
    if (type === 'image/png') return stripPng(bytes);
    return stripWebp(bytes);
  } catch {
    return null;
  }
}
