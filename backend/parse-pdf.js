const fs = require('fs');
const path = require('path');

async function parse() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const pdfPath = path.join(__dirname, '..', 'temp', '压实度（道路）（灌砂法）检测原始记录单.pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Pages:', doc.numPages);

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    console.log(`\n=== Page ${i} ===`);
    // Print items with their coordinates
    for (const item of content.items) {
      if (item.str && item.str.trim()) {
        const x = Math.round(item.transform[4]);
        const y = Math.round(item.transform[5]);
        const w = Math.round(item.width);
        const h = Math.round(item.height || 0);
        console.log(`  [x:${x}, y:${y}, w:${w}, h:${h}] "${item.str}"`);
      }
    }
  }
}

parse().catch(e => console.error(e));
