#!/usr/bin/env node
/**
 * Genera gli asset statici di brand (OG image, apple-touch-icon, icone PWA) in public/.
 * Uso: npm run assets
 */
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '../public');

const mark = (size) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">
    <rect width="40" height="40" rx="9" fill="#07070b"/>
    <defs><linearGradient id="g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFD166"/><stop offset="0.55" stop-color="#F5A300"/><stop offset="1" stop-color="#FF7A18"/>
    </linearGradient></defs>
    <path d="M20 5 8.5 32h5.6l2-5.2h7.8l2 5.2H31.5L20 5Zm0 10.2 2.5 6.6h-5l2.5-6.6Z" fill="url(#g)"/>
    <path d="M6 33.5h28" stroke="#38D1EC" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0c0c12"/><stop offset="1" stop-color="#07070b"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.8" cy="0.1" r="0.7">
      <stop offset="0" stop-color="#f5a300" stop-opacity="0.45"/><stop offset="1" stop-color="#f5a300" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.1" cy="0.95" r="0.6">
      <stop offset="0" stop-color="#38d1ec" stop-opacity="0.3"/><stop offset="1" stop-color="#38d1ec" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="amber" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFD166"/><stop offset="0.5" stop-color="#F5A300"/><stop offset="1" stop-color="#FF7A18"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0v48" fill="none" stroke="#ffffff" stroke-opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <g transform="translate(80 90) scale(2.2)">
    <path d="M20 3 7 34h6.4l2.3-6h8.6l2.3 6H33L20 3Zm0 11.6 2.9 7.6h-5.8l2.9-7.6Z" fill="url(#amber)"/>
    <path d="M4 34h32" stroke="#38D1EC" stroke-width="2" stroke-linecap="round"/>
  </g>
  <text x="190" y="150" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="56" fill="#f7f7fb" letter-spacing="-1">ART<tspan fill="#f5a300">CONTENT</tspan></text>
  <text x="192" y="186" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="18" fill="#8a8aa3" letter-spacing="4">AGENZIA ZALIGHT · EMILIA-ROMAGNA &amp; MARCHE</text>
  <text x="80" y="330" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="64" fill="#f7f7fb" letter-spacing="-2">La luce dei grandi brand,</text>
  <text x="80" y="405" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="64" fill="url(#amber)" letter-spacing="-2">con un partner tecnico</text>
  <text x="80" y="480" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="64" fill="#f7f7fb" letter-spacing="-2">sul tuo territorio.</text>
  <text x="80" y="560" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#b9b9cc">Chauvet Professional · Chauvet DJ · Iluminarc · 27 brand · 450+ prodotti · artcontent.it</text>
</svg>`;

await mkdir(PUBLIC, { recursive: true });
await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(resolve(PUBLIC, 'og-default.png'));
await sharp(Buffer.from(mark(180))).png().toFile(resolve(PUBLIC, 'apple-touch-icon.png'));
await sharp(Buffer.from(mark(192))).png().toFile(resolve(PUBLIC, 'icon-192.png'));
await sharp(Buffer.from(mark(512))).png().toFile(resolve(PUBLIC, 'icon-512.png'));

await writeFile(
  resolve(PUBLIC, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'ARTCONTENT – Agenzia ZAlight Emilia-Romagna e Marche',
      short_name: 'ARTCONTENT',
      start_url: '/',
      display: 'browser',
      background_color: '#07070b',
      theme_color: '#07070b',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ) + '\n',
);

console.log('✓ asset generati in public/');
