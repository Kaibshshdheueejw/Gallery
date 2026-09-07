// Prepares the bundled sample-media library for the web prototype.
// - normalizes stock thumbnails to JPEG (max 1000px, q76, metadata stripped)
// - synthesizes blurry + near-duplicate variants so the on-device
//   "blur detection" and "duplicate detection" pipelines have real work to do
// - emits public/media/manifest.json (id, file, w, h, bytes)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'image-search');
const OUT = path.join(ROOT, 'web', 'public', 'media');
fs.mkdirSync(OUT, { recursive: true });

// source file -> semantic id (watermarked / unusable assets excluded)
const MAP = {
  'sunset-beach-ocean-photograph-free-stock-1.jpg': 'beach-1',
  'sunset-beach-ocean-photograph-free-stock-2.jpg': 'beach-2',
  'sunset-beach-ocean-photograph-free-stock-3.jpg': 'beach-3',
  'sunset-beach-ocean-photograph-free-stock-4.jpg': 'beach-4',
  'sunset-beach-ocean-photograph-free-stock-5.jpg': 'beach-5',
  'mountain-hiking-landscape-lake-reflectio-1.jpg': 'mountain-1',
  'mountain-hiking-landscape-lake-reflectio-2.jpg': 'mountain-2',
  'mountain-hiking-landscape-lake-reflectio-3.jpg': 'mountain-3',
  'mountain-hiking-landscape-lake-reflectio-4.jpg': 'mountain-4',
  'mountain-hiking-landscape-lake-reflectio-5.jpg': 'mountain-5',
  'indian-food-thali-curry-dish-photo-1.webp': 'food-1',
  'indian-food-thali-curry-dish-photo-2.webp': 'food-2',
  'indian-food-thali-curry-dish-photo-3.png': 'food-3',
  'indian-food-thali-curry-dish-photo-4.jpg': 'food-4',
  'indian-food-thali-curry-dish-photo-5.jpg': 'food-5',
  'portrait-smiling-person-face-headshot-ph-1.jpg': 'person-1',
  'portrait-smiling-person-face-headshot-ph-2.jpg': 'person-2',
  'portrait-smiling-person-face-headshot-ph-3.webp': 'person-3',
  'portrait-smiling-person-face-headshot-ph-4.jpg': 'person-4',
  'city-street-night-lights-urban-photograp-1.jpg': 'city-1',
  'city-street-night-lights-urban-photograp-2.jpg': 'city-2',
  'city-street-night-lights-urban-photograp-3.jpg': 'city-3',
  'city-street-night-lights-urban-photograp-4.jpg': 'city-4',
  'city-street-night-lights-urban-photograp-5.jpg': 'city-5',
  'receipt-invoice-document-paper-on-desk-p-1.jpg': 'doc-1',
  'receipt-invoice-document-paper-on-desk-p-2.jpg': 'doc-2',
  'receipt-invoice-document-paper-on-desk-p-3.jpg': 'doc-3',
  'receipt-invoice-document-paper-on-desk-p-4.jpg': 'doc-4',
  'receipt-invoice-document-paper-on-desk-p-5.jpg': 'doc-5',
  'dog-cat-pet-animal-cute-photo-1.jpg': 'pets-1',
  'dog-cat-pet-animal-cute-photo-2.jpg': 'pets-2',
  'dog-cat-pet-animal-cute-photo-3.jpg': 'pets-3',
  'dog-cat-pet-animal-cute-photo-4.jpg': 'pets-4',
  'dog-cat-pet-animal-cute-photo-5.jpg': 'pets-5',
  'flower-macro-close-up-nature-photography-1.jpg': 'flowers-1',
  'flower-macro-close-up-nature-photography-2.jpg': 'flowers-2',
  'flower-macro-close-up-nature-photography-3.jpg': 'flowers-3',
  'flower-macro-close-up-nature-photography-4.jpg': 'flowers-4',
  'flower-macro-close-up-nature-photography-5.jpg': 'flowers-5',
  'indian-wedding-festival-celebration-diya-1.jpg': 'festival-1',
  'indian-wedding-festival-celebration-diya-2.jpg': 'festival-2',
  'indian-wedding-festival-celebration-diya-3.jpg': 'festival-3',
  'indian-wedding-festival-celebration-diya-4.jpg': 'festival-4',
  'indian-wedding-festival-celebration-diya-5.jpg': 'festival-5',
  'forest-waterfall-greenery-nature-trip-ph-1.jpg': 'forest-1',
  'forest-waterfall-greenery-nature-trip-ph-2.jpg': 'forest-2',
  'forest-waterfall-greenery-nature-trip-ph-3.jpg': 'forest-3',
  'forest-waterfall-greenery-nature-trip-ph-4.jpg': 'forest-4',
  'forest-waterfall-greenery-nature-trip-ph-5.jpg': 'forest-5',
  'group-of-friends-selfie-together-happy-p-1.jpg': 'friends-1',
  'group-of-friends-selfie-together-happy-p-2.jpg': 'friends-2',
  'group-of-friends-selfie-together-happy-p-3.jpg': 'friends-3',
  'group-of-friends-selfie-together-happy-p-4.jpg': 'friends-4',
  'group-of-friends-selfie-together-happy-p-5.jpg': 'friends-5',
};

const im = (...args) => execFileSync('convert', args, { stdio: ['ignore', 'pipe', 'pipe'] });

const manifest = [];
const write = (id, srcFile, ops = []) => {
  const out = path.join(OUT, `${id}.jpg`);
  im(srcFile, '-auto-orient', '-strip', ...ops, '-resize', '1000x1000>', '-quality', '76', out);
  const [dims] = execFileSync('identify', ['-format', '%w %h', out]).toString().split('\n');
  const [w, h] = dims.split(' ').map(Number);
  manifest.push({ id, file: `media/${id}.jpg`, w, h, bytes: fs.statSync(out).size });
};

for (const [src, id] of Object.entries(MAP)) {
  const p = path.join(SRC, src);
  if (!fs.existsSync(p)) { console.warn('missing', src); continue; }
  write(id, p);
}

// --- synthesized variants -------------------------------------------------
// out-of-focus shots (blur-scoring pipeline should flag these)
write('blur-1', path.join(SRC, 'sunset-beach-ocean-photograph-free-stock-3.jpg'), ['-blur', '0x7']);
write('blur-2', path.join(SRC, 'city-street-night-lights-urban-photograp-4.jpg'), ['-blur', '0x6']);
write('blur-3', path.join(SRC, 'group-of-friends-selfie-together-happy-p-2.jpg'), ['-blur', '0x8']);
// near-duplicates (perceptual-hash pipeline should group these)
write('dup-1', path.join(SRC, 'sunset-beach-ocean-photograph-free-stock-2.jpg'), ['-modulate', '104,102,100']);
write('dup-2', path.join(SRC, 'indian-wedding-festival-celebration-diya-4.jpg'), ['-crop', '92%x92%+12+8', '+repage']);
write('dup-3', path.join(SRC, 'forest-waterfall-greenery-nature-trip-ph-3.jpg'), ['-modulate', '98,100,100']);

manifest.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`prepared ${manifest.length} assets, ${(manifest.reduce((s, m) => s + m.bytes, 0) / 1e6).toFixed(2)} MB`);
