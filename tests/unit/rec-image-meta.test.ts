import { describe, expect, it } from 'vitest';
import { stripImageMetadata } from '@/modules/rec/domain/imageMeta';

const seg = (marker: number, body: number[]) => [
  0xff,
  marker,
  (body.length + 2) >> 8,
  (body.length + 2) & 0xff,
  ...body,
];
const text = (s: string) => [...Buffer.from(s, 'latin1')];
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s, 'latin1'));

/** EXIF (big endian) with orientation 6 and a marker string standing for the GPS block */
const exif = (orientation: number) =>
  seg(0xe1, [
    ...text('Exif\0\0'),
    ...[0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08],
    ...[0x00, 0x02],
    ...[0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00],
    ...[0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x30],
    ...[0, 0, 0, 0],
    ...text('GPSLatitude=10.77N GPSLongitude=106.70E'),
  ]);

const jpeg = (orientation: number) =>
  Uint8Array.from([
    0xff,
    0xd8,
    ...seg(0xe0, text('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
    ...exif(orientation),
    ...seg(0xfe, text('camera comment with owner name')),
    ...seg(0xdb, [0, 1, 2, 3]),
    ...seg(0xda, [1, 1, 0, 0, 63, 0]),
    ...[0x12, 0x34, 0x56],
    0xff,
    0xd9,
  ]);

describe('R104: metadata is removed when a photo is accepted', () => {
  it('JPEG: GPS, comment and other APPn go; pixel data and the orientation stay', () => {
    const out = stripImageMetadata(jpeg(6), 'image/jpeg')!;
    expect(has(out, 'GPSLatitude')).toBe(false);
    expect(has(out, 'owner name')).toBe(false);
    expect(has(out, 'GPS')).toBe(false);
    expect(has(out, 'JFIF')).toBe(true);
    expect([...out.slice(-5)]).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9]);
    // orientation 6 survives in a minimal EXIF block
    const i = Buffer.from(out).indexOf(Buffer.from('Exif\0\0', 'latin1'));
    expect(i).toBeGreaterThan(0);
    expect(out[i + 6 + 8 + 2 + 8]).toBe(0); // value high byte
    expect(out[i + 6 + 8 + 2 + 8 + 1]).toBe(6);
    expect(out.length).toBeLessThan(jpeg(6).length);
  });

  it('JPEG: bytes after EOI are dropped and the Adobe APP14 marker is kept', () => {
    const base = [...jpeg(1)];
    const adobe = seg(0xee, text('Adobe\0\x64\0\0\0\0\x01'));
    const withAdobe = [...base.slice(0, 2), ...adobe, ...base.slice(2)];
    const trailing = Uint8Array.from([...withAdobe, ...text('TRAILING-SECRET-DATA')]);
    const out = stripImageMetadata(trailing, 'image/jpeg')!;
    expect(has(out, 'TRAILING')).toBe(false);
    expect(has(out, 'Adobe')).toBe(true);
    expect([...out.slice(-2)]).toEqual([0xff, 0xd9]);
  });

  it('JPEG with no rotation gets no EXIF block at all; a broken file is refused', () => {
    expect(has(stripImageMetadata(jpeg(1), 'image/jpeg')!, 'Exif')).toBe(false);
    expect(
      stripImageMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40, 1]), 'image/jpeg'),
    ).toBeNull();
    expect(
      stripImageMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02]), 'image/jpeg'),
    ).toBeNull();
  });

  const chunk = (type: string, data: number[]) => [
    0,
    0,
    0,
    data.length,
    ...text(type),
    ...data,
    0,
    0,
    0,
    0, // CRC is copied, not checked
  ];
  it('PNG: text and EXIF chunks go, image chunks stay', () => {
    const png = Uint8Array.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
      ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
      ...chunk('eXIf', text('GPSLatitude')),
      ...chunk('tEXt', text('Comment\0home address')),
      ...chunk('IDAT', [1, 2, 3]),
      ...chunk('IEND', []),
    ]);
    const out = stripImageMetadata(png, 'image/png')!;
    expect(has(out, 'GPS')).toBe(false);
    expect(has(out, 'home address')).toBe(false);
    expect(has(out, 'IDAT')).toBe(true);
    expect(has(out, 'IEND')).toBe(true);
    expect(stripImageMetadata(png.slice(0, png.length - 12), 'image/png')).toBeNull();
  });

  it('WebP: EXIF and XMP chunks go, the RIFF size and VP8X flags are fixed', () => {
    const wchunk = (type: string, data: number[]) => [
      ...text(type),
      data.length & 0xff,
      0,
      0,
      0,
      ...data,
      ...(data.length % 2 ? [0] : []),
    ];
    const body = [
      ...text('WEBP'),
      ...wchunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...wchunk('EXIF', text('GPSLatitude')),
      ...wchunk('XMP ', text('xmp owner')),
      ...wchunk('VP8 ', [9, 8, 7]),
    ];
    const webp = Uint8Array.from([
      ...text('RIFF'),
      body.length & 0xff,
      body.length >> 8,
      0,
      0,
      ...body,
    ]);
    const out = stripImageMetadata(webp, 'image/webp')!;
    expect(has(out, 'GPS')).toBe(false);
    expect(has(out, 'xmp owner')).toBe(false);
    expect(has(out, 'VP8 ')).toBe(true);
    expect(out[12 + 8]! & 0x0c).toBe(0);
    expect(out[4]! | (out[5]! << 8)).toBe(out.length - 8);
  });
});
