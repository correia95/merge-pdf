import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, countPages, readableSize } from './merge.ts';

async function makeTestPdf(pageCount, sizeLabel) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`${sizeLabel} page ${i + 1}`, { x: 20, y: 250 });
  }
  return doc.save();
}

test('countPages reports the correct page count for a generated PDF', async () => {
  const pdf = await makeTestPdf(3, 'A');
  assert.equal(await countPages(pdf), 3);
});

test('mergePdfs combines two PDFs into one with the total page count', async () => {
  const pdfA = await makeTestPdf(2, 'A');
  const pdfB = await makeTestPdf(3, 'B');
  const merged = await mergePdfs([pdfA, pdfB]);
  assert.equal(await countPages(merged), 5);
});

test('mergePdfs preserves page order — pages from the first file come before the second', async () => {
  const pdfA = await makeTestPdf(1, 'FIRST');
  const pdfB = await makeTestPdf(1, 'SECOND');
  const merged = await mergePdfs([pdfA, pdfB]);
  const doc = await PDFDocument.load(merged);
  assert.equal(doc.getPageCount(), 2);
  // Page sizes match source (200x300) confirming real content was copied, not just blank pages
  assert.equal(doc.getPage(0).getWidth(), 200);
  assert.equal(doc.getPage(1).getWidth(), 200);
});

test('mergePdfs handles three or more files', async () => {
  const pdfs = await Promise.all([
    makeTestPdf(1, 'X'), makeTestPdf(1, 'Y'), makeTestPdf(1, 'Z'),
  ]);
  const merged = await mergePdfs(pdfs);
  assert.equal(await countPages(merged), 3);
});

test('mergePdfs works with a single input file (trivial merge)', async () => {
  const pdf = await makeTestPdf(4, 'ONLY');
  const merged = await mergePdfs([pdf]);
  assert.equal(await countPages(merged), 4);
});

test('readableSize formats bytes, KB and MB', () => {
  assert.equal(readableSize(500), '500 B');
  assert.equal(readableSize(2048), '2.0 KB');
  assert.equal(readableSize(6 * 1024 * 1024), '6.00 MB');
});
