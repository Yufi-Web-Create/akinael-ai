import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  const require = createRequire(import.meta.url);
  sharp = require('/private/tmp/akinael-image-tools/node_modules/sharp');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const mastersDir = path.join(scriptDir, 'masters');
const qaDir = path.join(scriptDir, 'qa');
const outRoot = path.join(repoRoot, 'public/assets/v2');
const photoDir = path.join(outRoot, 'photos');
const illustrationDir = path.join(outRoot, 'illustrations');
const avatarDir = path.join(outRoot, 'avatars');

await Promise.all([
  fs.mkdir(photoDir, { recursive: true }),
  fs.mkdir(illustrationDir, { recursive: true }),
  fs.mkdir(avatarDir, { recursive: true }),
  fs.mkdir(qaDir, { recursive: true }),
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function cropGeometry(input, targetWidth, targetHeight, focalX = 0.5, focalY = 0.5) {
  const { width: sourceWidth, height: sourceHeight } = await sharp(input).metadata();
  if (!sourceWidth || !sourceHeight) throw new Error(`Missing dimensions: ${input}`);
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  if (sourceRatio > targetRatio) cropWidth = Math.round(sourceHeight * targetRatio);
  else if (sourceRatio < targetRatio) cropHeight = Math.round(sourceWidth / targetRatio);
  const left = clamp(Math.round(sourceWidth * focalX - cropWidth / 2), 0, sourceWidth - cropWidth);
  const top = clamp(Math.round(sourceHeight * focalY - cropHeight / 2), 0, sourceHeight - cropHeight);
  return { left, top, width: cropWidth, height: cropHeight };
}

async function resizedBuffer(input, width, height, focalX, focalY) {
  const extract = await cropGeometry(input, width, height, focalX, focalY);
  return sharp(input)
    .extract(extract)
    .resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .toColorspace('srgb')
    .toBuffer();
}

async function exportPair({ input, dir, name, width, height, focalX, focalY, avifQuality, webpQuality }) {
  const pixels = await resizedBuffer(input, width, height, focalX, focalY);
  const avifPath = path.join(dir, `${name}.avif`);
  const webpPath = path.join(dir, `${name}.webp`);
  await Promise.all([
    sharp(pixels).avif({ quality: avifQuality, effort: 7, chromaSubsampling: '4:2:0' }).toFile(avifPath),
    sharp(pixels).webp({ quality: webpQuality, effort: 6, smartSubsample: true }).toFile(webpPath),
  ]);
}

const master = (name) => path.join(mastersDir, name);

const photoJobs = [
  { input: master('akinael-hero-desktop-v2-master.png'), name: 'akinael-hero-desktop-v2', width: 2400, height: 1350, focalX: 0.70, focalY: 0.45, avifQuality: 51, webpQuality: 68 },
  { input: master('akinael-hero-desktop-v2-master.png'), name: 'akinael-hero-desktop-v2-1920w', width: 1920, height: 1080, focalX: 0.70, focalY: 0.45, avifQuality: 51, webpQuality: 69 },
  { input: master('akinael-hero-desktop-v2-master.png'), name: 'akinael-hero-desktop-v2-1200w', width: 1200, height: 675, focalX: 0.70, focalY: 0.45, avifQuality: 52, webpQuality: 70 },
  { input: master('akinael-hero-mobile-v2-master.png'), name: 'akinael-hero-mobile-v2', width: 1080, height: 1440, focalX: 0.55, focalY: 0.44, avifQuality: 50, webpQuality: 69 },
  { input: master('akinael-hero-mobile-v2-master.png'), name: 'akinael-hero-mobile-v2-540w', width: 540, height: 720, focalX: 0.55, focalY: 0.44, avifQuality: 52, webpQuality: 72 },
];

const industries = [
  { stem: 'industry-beauty-v2', focalX: 0.45, focalY: 0.43 },
  { stem: 'industry-restaurant-v2', focalX: 0.50, focalY: 0.42 },
  { stem: 'industry-school-v2', focalX: 0.50, focalY: 0.43 },
  { stem: 'industry-local-service-v2', focalX: 0.54, focalY: 0.44 },
];

for (const industry of industries) {
  const input = master(`${industry.stem}-master.png`);
  photoJobs.push(
    { input, name: industry.stem, width: 1600, height: 1200, ...industry, avifQuality: 48, webpQuality: 65 },
    { input, name: `${industry.stem}-800w`, width: 800, height: 600, ...industry, avifQuality: 50, webpQuality: 69 },
    { input, name: `${industry.stem}-mobile`, width: 1080, height: 1350, ...industry, avifQuality: 49, webpQuality: 66 },
    { input, name: `${industry.stem}-mobile-540w`, width: 540, height: 675, ...industry, avifQuality: 52, webpQuality: 71 },
  );
}

for (const job of photoJobs) await exportPair({ ...job, dir: photoDir });

const illustrationInput = master('ai-create-review-process-v2-master.png');
for (const job of [
  { name: 'ai-create-review-process-v2', width: 1600, height: 1000, avifQuality: 53, webpQuality: 76 },
  { name: 'ai-create-review-process-v2-800w', width: 800, height: 500, avifQuality: 55, webpQuality: 78 },
]) {
  await exportPair({ input: illustrationInput, dir: illustrationDir, focalX: 0.5, focalY: 0.5, ...job });
}

const avatarSource = path.join(repoRoot, 'public/assets/illustrations/ai-assistant-avatar.png');
for (const size of [96, 192]) {
  await sharp(avatarSource)
    .resize(size, size, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
    .webp({ quality: 80, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(path.join(avatarDir, `ai-assistant-avatar-${size}-v2.webp`));
}

const svgText = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function labelCard(input, label, width, height, background = '#ffffff') {
  const imageHeight = height - 50;
  const pixels = await sharp(input)
    .resize(width, imageHeight, { fit: 'contain', background })
    .toBuffer();
  const labelSvg = Buffer.from(`<svg width="${width}" height="50" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><text x="16" y="31" font-family="Arial, sans-serif" font-size="18" fill="#17302e">${svgText(label)}</text></svg>`);
  return sharp({ create: { width, height, channels: 3, background } })
    .composite([{ input: pixels, top: 0, left: 0 }, { input: labelSvg, top: imageHeight, left: 0 }])
    .webp({ quality: 78, effort: 5 })
    .toBuffer();
}

const heroDesktopWebp = path.join(photoDir, 'akinael-hero-desktop-v2-1200w.webp');
const heroMobileWebp = path.join(photoDir, 'akinael-hero-mobile-v2-540w.webp');
const contactCanvas = sharp({ create: { width: 1800, height: 1630, channels: 3, background: '#f7f3ea' } });
const contactItems = [
  { input: await labelCard(heroDesktopWebp, 'Hero desktop', 1120, 680), left: 30, top: 30 },
  { input: await labelCard(heroMobileWebp, 'Hero mobile', 500, 680), left: 1270, top: 30 },
];
for (let index = 0; index < industries.length; index += 1) {
  const item = industries[index];
  const input = path.join(photoDir, `${item.stem}-800w.webp`);
  contactItems.push({ input: await labelCard(input, item.stem, 420, 365), left: 30 + index * 440, top: 740 });
}
contactItems.push({ input: await labelCard(path.join(illustrationDir, 'ai-create-review-process-v2-800w.webp'), 'Create / review process', 1120, 500), left: 30, top: 1120 });
contactItems.push({ input: await labelCard(path.join(avatarDir, 'ai-assistant-avatar-192-v2.webp'), 'Assistant avatar 192px', 500, 500, '#f7f3ea'), left: 1270, top: 1120 });
await contactCanvas.composite(contactItems).webp({ quality: 80, effort: 6 }).toFile(path.join(qaDir, 'assets-contact-sheet.webp'));

function coverCrop(input, targetWidth, targetHeight, focalX, focalY) {
  return resizedBuffer(input, targetWidth, targetHeight, focalX, focalY);
}

async function viewportSheet(viewportWidth, viewportHeight) {
  const mobile = viewportWidth <= 720;
  const header = mobile ? 68 : 86;
  const heroHeight = viewportHeight - header;
  const cardWidth = mobile ? viewportWidth : Math.round(viewportWidth / 2);
  const cardHeight = mobile ? 430 : 560;
  const heroInput = mobile ? path.join(photoDir, 'akinael-hero-mobile-v2.webp') : path.join(photoDir, 'akinael-hero-desktop-v2.webp');
  const heroFocal = mobile ? { x: 0.55, y: 0.44 } : { x: 0.70, y: 0.45 };
  const heroCrop = await coverCrop(heroInput, viewportWidth, heroHeight, heroFocal.x, heroFocal.y);
  const maxHeroW = 1500;
  const maxHeroH = 520;
  const heroScale = Math.min(maxHeroW / viewportWidth, maxHeroH / heroHeight);
  const renderedHeroW = Math.max(1, Math.round(viewportWidth * heroScale));
  const renderedHeroH = Math.max(1, Math.round(heroHeight * heroScale));
  const sheetWidth = 1600;
  const industryThumbW = mobile ? 350 : 365;
  const industryThumbH = Math.max(180, Math.round(industryThumbW * cardHeight / cardWidth));
  const sheetHeight = 110 + renderedHeroH + 80 + industryThumbH + 70;
  const composites = [];
  const heroThumb = await sharp(heroCrop).resize(renderedHeroW, renderedHeroH).toBuffer();
  composites.push({ input: heroThumb, left: Math.round((sheetWidth - renderedHeroW) / 2), top: 70 });
  const titleSvg = Buffer.from(`<svg width="${sheetWidth}" height="60" xmlns="http://www.w3.org/2000/svg"><text x="30" y="40" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#17302e">Crop preview ${viewportWidth}×${viewportHeight}</text></svg>`);
  composites.push({ input: titleSvg, left: 0, top: 0 });
  const gridTop = 70 + renderedHeroH + 70;
  for (let index = 0; index < industries.length; index += 1) {
    const item = industries[index];
    const input = mobile ? path.join(photoDir, `${item.stem}-mobile.webp`) : path.join(photoDir, `${item.stem}.webp`);
    const cropped = await coverCrop(input, cardWidth, cardHeight, item.focalX, item.focalY);
    const thumb = await sharp(cropped).resize(industryThumbW, industryThumbH).toBuffer();
    composites.push({ input: thumb, left: 30 + index * 390, top: gridTop });
    const labelSvg = Buffer.from(`<svg width="365" height="40" xmlns="http://www.w3.org/2000/svg"><text x="0" y="27" font-family="Arial, sans-serif" font-size="17" fill="#17302e">${svgText(item.stem.replace('industry-', '').replace('-v2', ''))}</text></svg>`);
    composites.push({ input: labelSvg, left: 30 + index * 390, top: gridTop + industryThumbH + 6 });
  }
  const output = path.join(qaDir, `crop-preview-${viewportWidth}x${viewportHeight}.webp`);
  await sharp({ create: { width: sheetWidth, height: sheetHeight, channels: 3, background: '#ffffff' } })
    .composite(composites)
    .webp({ quality: 78, effort: 6 })
    .toFile(output);
  return output;
}

const viewports = [[1366, 768], [1440, 900], [1920, 1080], [320, 568], [375, 667], [390, 844], [430, 932]];
const viewportOutputs = [];
for (const [width, height] of viewports) viewportOutputs.push(await viewportSheet(width, height));

const cropSheetWidth = 2400;
const cropTileWidth = 1120;
const cropTileHeight = 900;
const cropSheetHeight = 4 * 940 + 40;
const cropComposites = [];
for (let index = 0; index < viewportOutputs.length; index += 1) {
  const tile = await sharp(viewportOutputs[index]).resize(cropTileWidth, cropTileHeight, { fit: 'contain', background: '#ffffff' }).toBuffer();
  const row = Math.floor(index / 2);
  const col = index % 2;
  cropComposites.push({ input: tile, left: 40 + col * 1160, top: 40 + row * 940 });
}
await sharp({ create: { width: cropSheetWidth, height: cropSheetHeight, channels: 3, background: '#eeeeea' } })
  .composite(cropComposites)
  .webp({ quality: 76, effort: 6 })
  .toFile(path.join(qaDir, 'crop-previews-contact-sheet.webp'));

console.log(JSON.stringify({ photoJobs: photoJobs.length, qaViewports: viewports.length, outputRoot: outRoot }, null, 2));
