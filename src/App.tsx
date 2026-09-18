import { useCallback, useState } from 'react';
import { mergePdfs, countPages, readableSize } from './merge';

interface PdfItem {
  id: string;
  file: File;
  pages: number | null;
}

export default function App() {
  const [items, setItems] = useState<PdfItem[]>([]);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outBytes, setOutBytes] = useState(0);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (list.length === 0) {
      setError('No PDF files found in that selection.');
      return;
    }
    setError('');
    const newItems: PdfItem[] = list.map((file) => ({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, pages: null }));
    setItems((prev) => [...prev, ...newItems]);
    setOutUrl(null);
    for (const item of newItems) {
      try {
        const bytes = new Uint8Array(await item.file.arrayBuffer());
        const pages = await countPages(bytes);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, pages } : i)));
      } catch {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, pages: -1 } : i)));
      }
    }
  }, []);

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function moveItem(from: number, to: number) {
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function resetAll() {
    setItems([]);
    setOutUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setOutBytes(0);
    setError('');
  }

  async function build() {
    if (items.length < 2) return;
    setBuilding(true);
    setError('');
    try {
      const buffers: Uint8Array[] = [];
      for (const item of items) buffers.push(new Uint8Array(await item.file.arrayBuffer()));
      const merged = await mergePdfs(buffers);
      const blob = new Blob([merged.slice().buffer], { type: 'application/pdf' });
      setOutUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
      setOutBytes(blob.size);
    } catch {
      setError('Could not merge these PDFs — one of them may be encrypted or corrupted.');
    }
    setBuilding(false);
  }

  const totalPages = items.reduce((sum, i) => sum + (i.pages && i.pages > 0 ? i.pages : 0), 0);

  return (
    <div className="page">
      <h1>Merge PDF</h1>
      <p className="lede">
        Combine multiple PDF files into one, in the order you choose. Drag to reorder, then
        download. Everything runs in your browser — nothing is uploaded.
      </p>

      <div
        className={`drop${dragOver ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        <p>Drag PDF files here, or</p>
        <label className="filebtn">
          Choose PDFs
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {error && <p className="err">{error}</p>}
      </div>

      {items.length > 0 && (
        <>
          <div className="list">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`row${dragIndex === i ? ' dragging' : ''}`}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== i) moveItem(dragIndex, i);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <span className="handle">☰</span>
                <span className="num">{i + 1}</span>
                <span className="fname">{item.file.name}</span>
                <span className="pages">{item.pages === null ? '…' : item.pages < 0 ? 'unreadable' : `${item.pages} pg`}</span>
                <button className="rm" onClick={() => removeItem(item.id)} aria-label="Remove">×</button>
              </div>
            ))}
          </div>

          {items.length < 2 && <p className="hint">Add at least one more PDF to merge.</p>}

          <div className="actions">
            <button className="primary" onClick={build} disabled={building || items.length < 2}>
              {building ? 'Merging…' : `Merge ${items.length} PDFs${totalPages ? ` (${totalPages} pages)` : ''}`}
            </button>
            <button className="ghost" onClick={resetAll}>Clear all</button>
          </div>

          {outUrl && (
            <div className="result">
              <p className="hint">{readableSize(outBytes)} · {totalPages} pages</p>
              <a className="primary" href={outUrl} download="merged.pdf">Download merged PDF</a>
            </div>
          )}
        </>
      )}

      <section className="explainer">
        <h2>How it works</h2>
        <p>
          Each PDF's pages are copied into a new document, in the order shown above, directly in
          your browser with a PDF library — no server, no upload.
        </p>
        <h3>Does this upload my PDFs anywhere?</h3>
        <p>No. Merging happens entirely client-side; your files never leave your device.</p>
        <h3>Does this work with password-protected PDFs?</h3>
        <p>No — encrypted PDFs can't be read without the password, so they can't be merged here.</p>
      </section>
    </div>
  );
}
