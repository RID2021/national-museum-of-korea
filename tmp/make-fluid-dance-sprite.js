const fs = require("fs");
const zlib = require("zlib");

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: node make-fluid-dance-sprite.js input.png output.png");
}

const source = fs.readFileSync(inputPath);

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

const input = decodePng(source);
const outputFrameSize = 360;
const outputColumns = 4;
const tweenSteps = 1;

function findCharacterComponents() {
  const visited = new Uint8Array(input.width * input.height);
  const components = [];
  const stack = [];

  for (let startY = 0; startY < input.height; startY += 1) {
    for (let startX = 0; startX < input.width; startX += 1) {
      const startIndex = startY * input.width + startX;
      if (visited[startIndex]) continue;
      if (input.pixels[startIndex * 4 + 3] <= 8) continue;

      visited[startIndex] = 1;
      stack.push(startIndex);
      let area = 0;
      let minX = startX;
      let maxX = startX;
      let minY = startY;
      let maxY = startY;

      while (stack.length > 0) {
        const index = stack.pop();
        const x = index % input.width;
        const y = Math.floor(index / input.width);
        area += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        const neighbors = [
          x > 0 ? index - 1 : -1,
          x < input.width - 1 ? index + 1 : -1,
          y > 0 ? index - input.width : -1,
          y < input.height - 1 ? index + input.width : -1,
        ];

        for (const nextIndex of neighbors) {
          if (nextIndex < 0 || visited[nextIndex]) continue;
          if (input.pixels[nextIndex * 4 + 3] <= 8) continue;
          visited[nextIndex] = 1;
          stack.push(nextIndex);
        }
      }

      if (area < 900) continue;
      components.push({
        left: minX,
        right: maxX + 1,
        top: minY,
        bottom: maxY + 1,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        area,
      });
    }
  }

  return components
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .reduce((rows, component) => {
      const existingRow = rows.find(
        (row) => Math.abs(row.centerY - (component.top + component.bottom) / 2) < 90
      );
      if (existingRow) {
        existingRow.items.push(component);
        existingRow.centerY =
          existingRow.items.reduce(
            (sum, item) => sum + (item.top + item.bottom) / 2,
            0
          ) / existingRow.items.length;
      } else {
        rows.push({
          centerY: (component.top + component.bottom) / 2,
          items: [component],
        });
      }
      return rows;
    }, [])
    .sort((a, b) => a.centerY - b.centerY)
    .flatMap((row) => row.items.sort((a, b) => a.left - b.left));
}

const frameBoxes = findCharacterComponents();
const sourceFrameCount = frameBoxes.length;
if (sourceFrameCount !== 16) {
  throw new Error(`Expected 16 character components, found ${sourceFrameCount}`);
}
const spinSequence = Array.from({ length: sourceFrameCount }, (_, index) => index);
const outputFrameCount = (spinSequence.length - 1) * tweenSteps + 1;
const outputRows = Math.ceil(outputFrameCount / outputColumns);
const outputWidth = outputColumns * outputFrameSize;
const outputHeight = outputRows * outputFrameSize;
const output = Buffer.alloc(outputWidth * outputHeight * 4);
const sequenceBoxes = spinSequence.map((frameIndex) => frameBoxes[frameIndex]);
const maxBoxWidth = Math.max(...sequenceBoxes.map((box) => box.width));
const maxBoxHeight = Math.max(...sequenceBoxes.map((box) => box.height));
const frameScale = Math.min(
  (outputFrameSize - 36) / maxBoxWidth,
  (outputFrameSize - 22) / maxBoxHeight
);

function samplePixel(x, y) {
  const clampedX = Math.max(0, Math.min(input.width - 1, x));
  const clampedY = Math.max(0, Math.min(input.height - 1, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(input.width - 1, x0 + 1);
  const y1 = Math.min(input.height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const samples = [
    { index: (y0 * input.width + x0) * 4, weight: (1 - tx) * (1 - ty) },
    { index: (y0 * input.width + x1) * 4, weight: tx * (1 - ty) },
    { index: (y1 * input.width + x0) * 4, weight: (1 - tx) * ty },
    { index: (y1 * input.width + x1) * 4, weight: tx * ty },
  ];

  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  for (const sample of samples) {
    const sampleAlpha = (input.pixels[sample.index + 3] / 255) * sample.weight;
    alpha += sampleAlpha;
    red += input.pixels[sample.index] * sampleAlpha;
    green += input.pixels[sample.index + 1] * sampleAlpha;
    blue += input.pixels[sample.index + 2] * sampleAlpha;
  }

  if (alpha <= 0.001) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function renderNormalizedFrame(frameIndex) {
  const box = frameBoxes[frameIndex];
  const frame = Buffer.alloc(outputFrameSize * outputFrameSize * 4);
  const scaledWidth = Math.round(box.width * frameScale);
  const scaledHeight = Math.round(box.height * frameScale);
  const left = Math.round((outputFrameSize - scaledWidth) / 2);
  const top = Math.round(outputFrameSize - scaledHeight - 8);

  for (let y = 0; y < scaledHeight; y += 1) {
    const sourceY = box.top + (y + 0.5) / frameScale;
    const destY = top + y;
    if (destY < 0 || destY >= outputFrameSize) continue;

    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceX = box.left + (x + 0.5) / frameScale;
      const destX = left + x;
      if (destX < 0 || destX >= outputFrameSize) continue;

      const [red, green, blue, alpha] = samplePixel(sourceX, sourceY);
      if (alpha === 0) continue;

      const destIndex = (destY * outputFrameSize + destX) * 4;
      frame[destIndex] = red;
      frame[destIndex + 1] = green;
      frame[destIndex + 2] = blue;
      frame[destIndex + 3] = alpha;
    }
  }

  return frame;
}

function blendNormalizedFrames(fromFrame, toFrame, amount) {
  const blended = Buffer.alloc(outputFrameSize * outputFrameSize * 4);

  for (let i = 0; i < blended.length; i += 4) {
    const fromAlpha = fromFrame[i + 3] / 255;
    const toAlpha = toFrame[i + 3] / 255;
    const alpha = fromAlpha * (1 - amount) + toAlpha * amount;

    if (alpha <= 0.001) continue;

    blended[i] = Math.round(
      (fromFrame[i] * fromAlpha * (1 - amount) + toFrame[i] * toAlpha * amount) /
        alpha
    );
    blended[i + 1] = Math.round(
      (fromFrame[i + 1] * fromAlpha * (1 - amount) +
        toFrame[i + 1] * toAlpha * amount) /
        alpha
    );
    blended[i + 2] = Math.round(
      (fromFrame[i + 2] * fromAlpha * (1 - amount) +
        toFrame[i + 2] * toAlpha * amount) /
        alpha
    );
    blended[i + 3] = Math.round(alpha * 255);
  }

  return blended;
}

function writeFrame(outputFrameIndex, frame) {
  const col = outputFrameIndex % outputColumns;
  const row = Math.floor(outputFrameIndex / outputColumns);

  for (let y = 0; y < outputFrameSize; y += 1) {
    const sourceStart = y * outputFrameSize * 4;
    const sourceEnd = sourceStart + outputFrameSize * 4;
    const destStart =
      ((row * outputFrameSize + y) * outputWidth + col * outputFrameSize) * 4;
    frame.copy(output, destStart, sourceStart, sourceEnd);
  }
}

const normalizedFrames = Array.from({ length: sourceFrameCount }, (_, frameIndex) =>
  renderNormalizedFrame(frameIndex)
);

let outputFrameIndex = 0;
for (let index = 0; index < spinSequence.length - 1; index += 1) {
  const fromFrame = normalizedFrames[spinSequence[index]];
  const toFrame = normalizedFrames[spinSequence[index + 1]];
  for (let step = 0; step < tweenSteps; step += 1) {
    const amount = step / tweenSteps;
    writeFrame(
      outputFrameIndex,
      amount === 0 ? fromFrame : blendNormalizedFrames(fromFrame, toFrame, amount)
    );
    outputFrameIndex += 1;
  }
}
writeFrame(outputFrameIndex, normalizedFrames[spinSequence[spinSequence.length - 1]]);
outputFrameIndex += 1;

if (outputFrameIndex !== outputFrameCount) {
  throw new Error(`Unexpected frame count: ${outputFrameIndex}`);
}

fs.writeFileSync(outputPath, encodePng(outputWidth, outputHeight, output));
console.log(
  JSON.stringify(
    {
      outputPath,
      outputWidth,
      outputHeight,
      outputFrameSize,
      outputFrameCount,
      frameScale: Number(frameScale.toFixed(4)),
    },
    null,
    2
  )
);
