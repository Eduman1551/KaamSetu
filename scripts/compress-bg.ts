// Resize/compress public/bg.jpg in place (max 1920px wide) if it is over ~500 KB.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'public', 'bg.jpg');

async function main() {
  const size = fs.statSync(file).size;
  if (size <= 500 * 1024) {
    console.log(`bg.jpg is ${Math.round(size / 1024)} KB — no change needed.`);
    return;
  }
  // Read into memory first so sharp doesn't hold a file lock on Windows.
  sharp.cache(false);
  const out = await sharp(fs.readFileSync(file))
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 72, progressive: true, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(file, out);
  console.log(`bg.jpg: ${Math.round(size / 1024)} KB -> ${Math.round(out.length / 1024)} KB`);
}
main();
