export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const merged = await PDFDocument.create();
  for (const fileBytes of files) {
    const src = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

export async function countPages(fileBytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
