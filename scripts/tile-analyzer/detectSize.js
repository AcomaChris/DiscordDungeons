// --- detectSize.js ---
// Step 1: Detect tile size from a tileset image.
// Renders the top row at multiple zoom levels for visual inspection.
// Runs automated grid-line variance analysis to score candidate sizes.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ZOOM_LEVELS = [8, 12, 16, 24, 32];
const CANDIDATE_SIZES = [8, 12, 16, 24, 32];

export async function detectSize(ctx) {
  const outDir = join(ctx.outputBase, 'step1');
  mkdirSync(outDir, { recursive: true });

  const img = await loadImage(ctx.imagePath);
  const { width, height } = img;
  console.log(`Image: ${width}x${height}px`);

  // --- Render top row at multiple zoom levels ---
  // AGENT: Top row = first N pixels tall, where N = candidate size.
  // We render a strip showing the first row of tiles for each zoom.

  for (const zoom of ZOOM_LEVELS) {
    // Use the zoom as the assumed tile size for this preview
    const rowHeight = zoom; // one tile row at this assumed size
    const stripH = Math.min(rowHeight, height);
    const canvas = createCanvas(width * zoom, stripH * zoom);
    const c = canvas.getContext('2d');

    // Disable image smoothing for crisp pixel art
    c.imageSmoothingEnabled = false;
    c.drawImage(img, 0, 0, width, stripH, 0, 0, width * zoom, stripH * zoom);

    // Draw grid lines to show tile boundaries
    c.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    c.lineWidth = 1;
    for (let x = 0; x <= width; x += zoom) {
      c.beginPath();
      c.moveTo(x * zoom, 0);
      c.lineTo(x * zoom, stripH * zoom);
      c.stroke();
    }

    const path = join(outDir, `zoom-${zoom}x.png`);
    writeFileSync(path, canvas.toBuffer('image/png'));
    console.log(`  Saved ${path}`);
  }

  // --- Automated grid-line variance analysis ---
  // For each candidate tile size, measure how much pixel color changes
  // at grid boundaries vs within tiles. The correct size has the highest
  // boundary-to-interior contrast ratio.

  const fullCanvas = createCanvas(width, height);
  const fc = fullCanvas.getContext('2d');
  fc.drawImage(img, 0, 0);
  const imageData = fc.getImageData(0, 0, width, height);
  const pixels = imageData.data; // RGBA flat array

  const scores = {};
  let bestSize = CANDIDATE_SIZES[0];
  let bestScore = -Infinity;

  for (const size of CANDIDATE_SIZES) {
    // Skip sizes that don't divide evenly
    if (width % size !== 0 && height % size !== 0) {
      scores[size] = 0;
      continue;
    }

    let boundaryDiff = 0;
    let boundaryCount = 0;
    let interiorDiff = 0;
    let interiorCount = 0;

    // Scan vertical grid lines (x-axis boundaries)
    for (let gx = size; gx < width; gx += size) {
      for (let y = 0; y < height; y++) {
        const diff = pixelDiff(pixels, width, gx - 1, y, gx, y);
        boundaryDiff += diff;
        boundaryCount++;
      }
    }

    // Scan horizontal grid lines (y-axis boundaries)
    for (let gy = size; gy < height; gy += size) {
      for (let x = 0; x < width; x++) {
        const diff = pixelDiff(pixels, width, x, gy - 1, x, gy);
        boundaryDiff += diff;
        boundaryCount++;
      }
    }

    // Sample interior pixel differences (within tiles)
    for (let gx = 0; gx < width - 1; gx++) {
      if ((gx + 1) % size === 0) continue; // skip boundary columns
      for (let y = 0; y < height; y += 3) { // sample every 3rd row for speed
        const diff = pixelDiff(pixels, width, gx, y, gx + 1, y);
        interiorDiff += diff;
        interiorCount++;
      }
    }

    const avgBoundary = boundaryCount > 0 ? boundaryDiff / boundaryCount : 0;
    const avgInterior = interiorCount > 0 ? interiorDiff / interiorCount : 1;
    const score = avgInterior > 0 ? avgBoundary / avgInterior : 0;

    scores[size] = Math.round(score * 100) / 100;

    if (score > bestScore) {
      bestScore = score;
      bestSize = size;
    }
  }

  const result = {
    detectedSize: ctx.forcedSize || bestSize,
    scores,
    imageWidth: width,
    imageHeight: height,
  };

  const resultPath = join(outDir, 'result.json');
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\nDetected tile size: ${result.detectedSize}px`);
  console.log('Scores:', scores);
  console.log(`Saved ${resultPath}`);
}

// --- Helpers ---

function pixelDiff(pixels, width, x1, y1, x2, y2) {
  const i1 = (y1 * width + x1) * 4;
  const i2 = (y2 * width + x2) * 4;
  const dr = pixels[i1] - pixels[i2];
  const dg = pixels[i1 + 1] - pixels[i2 + 1];
  const db = pixels[i1 + 2] - pixels[i2 + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
