const fs = require("fs");
const zlib = require("zlib");

const [, , outputPath, ...inputPaths] = process.argv;
if (!outputPath || inputPaths.length !== 8) {
  throw new Error(
    "Usage: node make-dance-eight-sprite.js output.png frame1.png ... frame8.png"
  );
}

function readChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer) {
  const chunks = readChunks(buffer);
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR").data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const colorType = ihdr[9];
  if (ihdr[8] !== 8 || colorType !== 6 || ihdr[12] !== 0) {
    throw new Error("Only non-interlaced 8-bit RGBA PNGs are supported.");
  }

  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)
  );
  const raw = zlib.inflateSync(compressed);
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const rowOffset = y * stride;
    const previousRowOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawOffset + x];
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0;
      const up = y > 0 ? pixels[previousRowOffset + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[previousRowOffset + x - 4] : 0;
      let channelValue;
      if (filter === 0) channelValue = value;
      else if (filter === 1) channelValue = value + left;
      else if (filter === 2) channelValue = value + up;
      else if (filter === 3) channelValue = value + Math.floor((left + up) / 2);
      else if (filter === 4) channelValue = value + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter: ${filter}`);
      pixels[rowOffset + x] = channelValue & 255;
    }
    rawOffset += stride;
  }

  return { width, height, pixels };
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = crcTable[(crc ^ buffer[i]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (stride + 1);
    raw[rawOffset] = 0;
    pixels.copy(raw, rawOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const frames = inputPaths.map((inputPath) => decodePng(fs.readFileSync(inputPath)));
const frameWidth = frames[0].width;
const frameHeight = frames[0].height;
for (const frame of frames) {
  if (frame.width !== frameWidth || frame.height !== frameHeight) {
    throw new Error("All frames must have the same canvas size.");
  }
}

const columns = 4;
const rows = 2;
const outputWidth = frameWidth * columns;
const outputHeight = frameHeight * rows;
const output = Buffer.alloc(outputWidth * outputHeight * 4);

for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
  const frame = frames[frameIndex];
  const col = frameIndex % columns;
  const row = Math.floor(frameIndex / columns);

  for (let y = 0; y < frameHeight; y += 1) {
    const sourceStart = y * frameWidth * 4;
    const sourceEnd = sourceStart + frameWidth * 4;
    const destStart =
      ((row * frameHeight + y) * outputWidth + col * frameWidth) * 4;
    frame.pixels.copy(output, destStart, sourceStart, sourceEnd);
  }
}

fs.writeFileSync(outputPath, encodePng(outputWidth, outputHeight, output));
console.log(
  JSON.stringify(
    {
      outputPath,
      frameWidth,
      frameHeight,
      columns,
      rows,
      frameCount: frames.length,
      outputWidth,
      outputHeight,
    },
    null,
    2
  )
);
