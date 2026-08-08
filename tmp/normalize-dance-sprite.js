const fs = require("fs");
const zlib = require("zlib");

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: node normalize-dance-sprite.js input.png output.png");
}

const source = fs.readFileSync(inputPath);
const signature = source.subarray(0, 8);
if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
  throw new Error("Input is not a PNG file.");
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
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error("Only non-interlaced 8-bit RGBA PNGs are supported.");
  }

  const compressed = Buffer.concat(
    chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)
  );
  const raw = zlib.inflateSync(compressed);
  const channels = 4;
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  let rawOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const rowOffset = y * stride;
    const previousRowOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = raw[rawOffset + x];
      const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
      const up = y > 0 ? pixels[previousRowOffset + x] : 0;
      const upLeft =
        y > 0 && x >= channels ? pixels[previousRowOffset + x - channels] : 0;

      let reconstructed;
      if (filter === 0) reconstructed = value;
      else if (filter === 1) reconstructed = value + left;
      else if (filter === 2) reconstructed = value + up;
      else if (filter === 3) reconstructed = value + Math.floor((left + up) / 2);
      else if (filter === 4) reconstructed = value + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter: ${filter}`);

      pixels[rowOffset + x] = reconstructed & 255;
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
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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

const input = decodePng(source);
const frameSize = 360;
const targetFrameHeight = 304;
const targetBottomPadding = 18;
const outputSize = frameSize * 4;
const output = Buffer.alloc(outputSize * outputSize * 4);
const alphaThreshold = 4;
const minComponentArea = 1200;
const visited = new Uint8Array(input.width * input.height);
const stats = [];

function pixelAlphaAt(index) {
  return input.pixels[index * 4 + 3];
}

function copyPixel(sourceIndex, destIndex) {
  output[destIndex] = input.pixels[sourceIndex];
  output[destIndex + 1] = input.pixels[sourceIndex + 1];
  output[destIndex + 2] = input.pixels[sourceIndex + 2];
  output[destIndex + 3] = input.pixels[sourceIndex + 3];
}

function sampleBilinear(sourceX, sourceY) {
  const x0 = Math.max(0, Math.min(input.width - 1, Math.floor(sourceX)));
  const y0 = Math.max(0, Math.min(input.height - 1, Math.floor(sourceY)));
  const x1 = Math.max(0, Math.min(input.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(input.height - 1, y0 + 1));
  const tx = sourceX - x0;
  const ty = sourceY - y0;
  const weights = [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x1, y0, tx * (1 - ty)],
    [x0, y1, (1 - tx) * ty],
    [x1, y1, tx * ty],
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;

  weights.forEach(([x, y, weight]) => {
    const sourceIndex = (y * input.width + x) * 4;
    const sourceAlpha = input.pixels[sourceIndex + 3] / 255;
    const weightedAlpha = sourceAlpha * weight;
    red += input.pixels[sourceIndex] * weightedAlpha;
    green += input.pixels[sourceIndex + 1] * weightedAlpha;
    blue += input.pixels[sourceIndex + 2] * weightedAlpha;
    alpha += weightedAlpha;
  });

  if (alpha <= 0.001) {
    return [0, 0, 0, 0];
  }

  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function collectComponent(startIndex) {
  const stack = [startIndex];
  const pixels = [];
  let minX = input.width;
  let minY = input.height;
  let maxX = 0;
  let maxY = 0;

  visited[startIndex] = 1;

  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % input.width;
    const y = Math.floor(index / input.width);
    pixels.push(index);

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    for (let dy = -1; dy <= 1; dy += 1) {
      const nextY = y + dy;
      if (nextY < 0 || nextY >= input.height) continue;

      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nextX = x + dx;
        if (nextX < 0 || nextX >= input.width) continue;

        const nextIndex = nextY * input.width + nextX;
        if (visited[nextIndex] || pixelAlphaAt(nextIndex) <= alphaThreshold) {
          continue;
        }

        visited[nextIndex] = 1;
        stack.push(nextIndex);
      }
    }
  }

  return {
    pixels,
    minX,
    minY,
    maxX,
    maxY,
    area: pixels.length,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: (minX + maxX + 1) / 2,
    centerY: (minY + maxY + 1) / 2,
  };
}

const components = [];
for (let index = 0; index < input.width * input.height; index += 1) {
  if (visited[index] || pixelAlphaAt(index) <= alphaThreshold) continue;
  const component = collectComponent(index);
  if (
    component.area >= minComponentArea &&
    component.width >= 80 &&
    component.height >= 120
  ) {
    components.push(component);
  }
}

components.sort((a, b) => b.area - a.area);
const frames = components.slice(0, 16);
if (frames.length !== 16) {
  throw new Error(`Expected 16 dancer frames, found ${frames.length}.`);
}

frames.sort((a, b) => a.centerY - b.centerY);
const orderedFrames = [];
for (let row = 0; row < 4; row += 1) {
  const rowFrames = frames.slice(row * 4, row * 4 + 4);
  rowFrames.sort((a, b) => a.centerX - b.centerX);
  orderedFrames.push(...rowFrames);
}

const naturalRightTurnOrder = [
  1,
  2,
  3,
  4,
  8,
  6,
  5,
  7,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
];
const animationFrames = naturalRightTurnOrder.map(
  (frameNumber) => orderedFrames[frameNumber - 1]
);

animationFrames.forEach((frame, frameIndex) => {
  const row = Math.floor(frameIndex / 4);
  const col = frameIndex % 4;
  const outFrameX = col * frameSize;
  const outFrameY = row * frameSize;
  const scale = targetFrameHeight / frame.height;
  const scaledWidth = Math.round(frame.width * scale);
  const scaledHeight = Math.round(frame.height * scale);
  const left = Math.round((frameSize - scaledWidth) / 2);
  const top = Math.round(frameSize - targetBottomPadding - scaledHeight);

  for (let y = 0; y < scaledHeight; y += 1) {
    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceX = frame.minX + (x + 0.5) / scale - 0.5;
      const sourceY = frame.minY + (y + 0.5) / scale - 0.5;
      const [red, green, blue, alpha] = sampleBilinear(sourceX, sourceY);
      if (alpha <= alphaThreshold) {
        continue;
      }

      const destX = outFrameX + left + x;
      const destY = outFrameY + top + y;
      const destIndex = (destY * outputSize + destX) * 4;
      output[destIndex] = red;
      output[destIndex + 1] = green;
      output[destIndex + 2] = blue;
      output[destIndex + 3] = alpha;
    }
  }

  stats.push({
    frame: frameIndex + 1,
    sourceFrame: naturalRightTurnOrder[frameIndex],
    source: `${frame.minX},${frame.minY}`,
    bbox: `${frame.width}x${frame.height}`,
    scaled: `${scaledWidth}x${scaledHeight}`,
    scale: scale.toFixed(3),
    area: frame.area,
    placedAt: `${left},${top}`,
  });
});

fs.writeFileSync(outputPath, encodePng(outputSize, outputSize, output));
console.table(stats);
