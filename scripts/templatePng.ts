/* eslint-disable no-bitwise */
import {deflateSync, inflateSync} from 'node:zlib';
import {
  buildTemplateLayout,
  PAGE_SIZES,
  type TemplateId,
} from '../src/domain/pageLayout';

// Original 5x7 lettering for the three static labels; no external font or image assets.
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
};

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer): Buffer => {
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  output.write(type, 4, 'ascii');
  data.copy(output, 8);
  output.writeUInt32BE(crc32(output.subarray(4, -4)), output.length - 4);
  return output;
};

export const templatePixels = (id: TemplateId): Buffer => {
  const {width, height} = PAGE_SIZES[id];
  const model = buildTemplateLayout(PAGE_SIZES[id]);
  if (!model.ok) {
    throw new Error(`Invalid template size: ${id}`);
  }
  const pixels = Buffer.alloc(width * height, 255);
  const fill = (
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): void => {
    for (let y = top; y < bottom; y += 1) {
      pixels.fill(0, y * width + left, y * width + right);
    }
  };
  for (const rectangle of model.value.ink) {
    fill(rectangle.left, rectangle.top, rectangle.right, rectangle.bottom);
  }
  for (const label of model.value.labels) {
    [...label.text].forEach((letter, index) => {
      const glyph = GLYPHS[letter];
      if (!glyph) {
        throw new Error(`Missing original template glyph: ${letter}`);
      }
      glyph.forEach((row, y) => {
        [...row].forEach((pixel, x) => {
          if (pixel === '1') {
            const left = label.left + (index * 6 + x) * label.pixelSize;
            const top = label.top + y * label.pixelSize;
            fill(left, top, left + label.pixelSize, top + label.pixelSize);
          }
        });
      });
    });
  }
  return pixels;
};

export const renderTemplatePng = (id: TemplateId): Buffer => {
  const {width, height} = PAGE_SIZES[id];
  const pixels = templatePixels(id);
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    pixels.copy(rows, y * (width + 1) + 1, y * width, (y + 1) * width);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const verifyTemplatePng = (data: Buffer, id: TemplateId): void => {
  const {width, height} = PAGE_SIZES[id];
  if (
    !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error(`${id}: invalid PNG signature`);
  }
  const imageData: Buffer[] = [];
  let headerFound = false;
  let endFound = false;
  for (let offset = 8; offset < data.length; ) {
    const length = data.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > data.length) {
      throw new Error(`${id}: truncated PNG`);
    }
    const type = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, end - 4);
    if (
      crc32(data.subarray(offset + 4, end - 4)) !== data.readUInt32BE(end - 4)
    ) {
      throw new Error(`${id}: invalid PNG checksum`);
    }
    if (type === 'IHDR') {
      headerFound =
        body.length === 13 &&
        body.readUInt32BE(0) === width &&
        body.readUInt32BE(4) === height &&
        body[8] === 8 &&
        body.subarray(9).equals(Buffer.alloc(4));
    } else if (type === 'IDAT') {
      imageData.push(body);
    } else if (type === 'IEND') {
      endFound = end === data.length;
    }
    offset = end;
  }
  if (!headerFound || !endFound) {
    throw new Error(`${id}: expected ${width}x${height} opaque grayscale PNG`);
  }
  const rows = inflateSync(Buffer.concat(imageData), {
    maxOutputLength: (width + 1) * height,
  });
  const expected = templatePixels(id);
  if (rows.length !== (width + 1) * height) {
    throw new Error(`${id}: incorrect pixel count`);
  }
  for (let y = 0; y < height; y += 1) {
    const start = y * (width + 1);
    if (
      rows[start] !== 0 ||
      !rows
        .subarray(start + 1, start + 1 + width)
        .equals(expected.subarray(y * width, (y + 1) * width))
    ) {
      throw new Error(
        `${id}: PNG pixels differ from shared layout; run npm run templates:generate`,
      );
    }
  }
};
