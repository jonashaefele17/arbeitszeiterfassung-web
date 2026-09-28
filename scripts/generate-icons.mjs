// Erzeugt die PNG-App-Icons aus einem SVG. Einmalig ausführen: node scripts/generate-icons.mjs
import sharp from 'sharp';

const glyph = (scale) => {
  const r = 148 * scale;
  const sw = 32 * scale;
  return `
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="#fff" stroke-width="${sw}"/>
  <path d="M256 ${256 - 86 * scale}v${92 * scale}l${58 * scale} ${40 * scale}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#980C3B"/>${glyph(1)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#980C3B"/>${glyph(0.75)}</svg>`;

await sharp(Buffer.from(full)).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(Buffer.from(full)).resize(512, 512).png().toFile('public/pwa-512.png');
await sharp(Buffer.from(maskable)).resize(512, 512).png().toFile('public/pwa-maskable-512.png');
await sharp(Buffer.from(full)).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Icons erzeugt.');
