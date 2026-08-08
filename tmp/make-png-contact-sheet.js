const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const [, , inputDir, outputPath] = process.argv;
if (!inputDir || !outputPath) {
  throw new Error("Usage: node make-png-contact-sheet.js input-dir output.png");
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
  if (ihdr[8] !== 8 || (colorType !== 2 && colorType !== 6) || ihdr[12] !== 0) {
    throw new Error("Only non-interlaced 8-bit RGB/RGBA PNGs are supported.");
  }

  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)
  );
  const raw = zlib.inflateSync(compressed);
  const inputChannels = colorType === 6 ? 4 : 3;
  const inputStride = width * inputChannels;
  const reconstructed = Buffer.alloc(width * height * inputChannels);
  const pixels = Buffer.alloc(width * height * 4);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const rowOffset = y * inputStride;
    const previousRowOffset = (y - 1) * inputStride;

    for (let x = 0; x < inputStride; x += 1) {
      const value = raw[rawOffset + x];
      const left = x >= inputChannels ? reconstructed[rowOffset + x - inputChannels] : 0;
      const up = y > 0 ? reconstructed[previousRowOffset + x] : 0;
      const upLeft =
        y > 0 && x >= inputChannels
          ? reconstructed[previousRowOffset + x - inputChannels]
          : 0;
      let channelValue;
      if (filter === 0) channelValue = value;
      else if (filter === 1) channelValue = value + left;
      else if (filter === 2) channelValue = value + up;
      else if (filter === 3) channelValue = value + Math.floor((left + up) / 2);
      else if (filter === 4) channelValue = value + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter: ${filter}`);
      reconstructed[rowOffset + x] = channelValue & 255;
    }
    rawOffset += inputStride;
  }

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const inputIndex = pixelIndex * inputChannels;
    const outputIndex = pixelIndex * 4;
    pixels[outputIndex] = reconstructed[inputIndex];
    pixels[outputIndex + 1] = reconstructed[inputIndex + 1];
    pixels[outputIndex + 2] = reconstructed[inputIndex + 2];
    pixels[outputIndex + 3] =
      inputChannels === 4 ? reconstructed[inputIndex + 3] : 255;
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

const files = fs
  .readdirSync(inputDir)
  .filter((file) => file.endsWith(".png"))
  .sort()
  .slice(0, 16);
const images = files.map((file) => decodePng(fs.readFileSync(path.join(inputDir, file))));
const tileWidth = images[0].width;
const tileHeight = images[0].height;
const gap = 8;
const columns = 4;
const rows = Math.ceil(images.length / columns);
const outputWidth = columns * tileWidth + (columns + 1) * gap;
const outputHeight = rows * tileHeight + (rows + 1) * gap;
const output = Buffer.alloc(outputWidth * outputHeight * 4, 245);

for (let index = 0; index < images.length; index += 1) {
  const image = images[index];
  const col = index % columns;
  const row = Math.floor(index / columns);
  const offsetX = gap + col * (tileWidth + gap);
  const offsetY = gap + row * (tileHeight + gap);

  for (let y = 0; y < tileHeight; y += 1) {
    for (let x = 0; x < tileWidth; x += 1) {
      const sourceIndex = (y * tileWidth + x) * 4;
      const destIndex = ((offsetY + y) * outputWidth + offsetX + x) * 4;
      output[destIndex] = image.pixels[sourceIndex];
      output[destIndex + 1] = image.pixels[sourceIndex + 1];
      output[destIndex + 2] = image.pixels[sourceIndex + 2];
      output[destIndex + 3] = image.pixels[sourceIndex + 3];
    }
  }
}

fs.writeFileSync(outputPath, encodePng(outputWidth, outputHeight, output));
