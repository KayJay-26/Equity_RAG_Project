import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:8000';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);
  const endRef = useRef(null);

  const loadDocuments = async () => {
    try {
      const res = await fetch(`${API}/documents`);
      const data = await res.json();
      setDocuments(data.documents);
    } catch {
      setToast('Cannot reach backend. Is uvicorn running?');
    }
  };

  useEffect(() => { loadDocuments(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) showToast(data.detail || 'Upload failed');
      else {
        showToast(`Indexed ${file.name} — ${data.chunks_indexed} chunks`);
        loadDocuments();
      }
    } catch {
      showToast('Upload failed — backend unreachable');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeDoc = async (filename) => {
    await fetch(`${API}/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    showToast(`Removed ${filename}`);
    loadDocuments();
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', text: data.answer, sources: data.sources }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Could not reach the backend.', error: true }]);
    }
    setLoading(false);
  };

  const suggestions = [
    { title: 'Revenue growth', sub: 'year-over-year and constant currency' },
    { title: 'Operating margin', sub: 'EBIT and net profit margins' },
    { title: 'Cash position', sub: 'operating cash flow and conversion' },
    { title: 'Compare documents', sub: 'revenue across uploaded reports' },
  ];

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.logo}>ER</div>
          <span style={S.brandText}>Equity Research</span>
        </div>

        <button style={S.newChat} onClick={() => setMessages([])}>+ New chat</button>

        <div style={S.sectionLabel}>Documents ({documents.length})</div>
        <div style={S.docList}>
          {documents.length === 0 && <div style={S.empty}>No documents indexed</div>}
          {documents.map((d) => (
            <div key={d.filename} style={S.docItem}>
              <div style={S.docInfo}>
                <div style={S.docName} title={d.filename}>{d.filename}</div>
                <div style={S.docMeta}>{d.chunks} chunks</div>
              </div>
              <button style={S.removeBtn} onClick={() => removeDoc(d.filename)} title="Remove">×</button>
            </div>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => uploadFile(e.target.files[0])}
        />
        <button style={S.uploadBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Indexing…' : '＋ Upload PDF'}
        </button>
      </aside>

      <main style={S.main}>
        {messages.length === 0 ? (
          <div style={S.welcome}>
            <div style={S.logoLarge}>ER</div>
            <h1 style={S.h1}>Equity Research Assistant</h1>
            <p style={S.sub}>
              {documents.length === 0
                ? 'Upload an annual report to get started.'
                : `Ask anything across ${documents.length} indexed document${documents.length > 1 ? 's' : ''}.`}
            </p>
            <div style={S.cards}>
              {suggestions.map((s) => (
                <button key={s.title} style={S.card} onClick={() => send(`What was the ${s.title.toLowerCase()}?`)}>
                  <div style={S.cardTitle}>{s.title}</div>
                  <div style={S.cardSub}>{s.sub}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={S.chat}>
            {messages.map((m, i) => (
              <div key={i} style={S.msgRow}>
                <div style={m.role === 'user' ? S.avatarUser : S.avatarBot}>
                  {m.role === 'user' ? 'You' : 'ER'}
                </div>
                <div style={S.msgBody}>
                  <div style={{ ...S.msgText, color: m.error ? '#f87171' : '#e8e8e8' }}>{m.text}</div>
                  {m.sources?.length > 0 && (
                    <div style={S.sources}>
                      {m.sources.map((s) => <span key={s} style={S.sourceTag}>{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={S.msgRow}>
                <div style={S.avatarBot}>ER</div>
                <div style={S.thinking}>Searching documents…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        <div style={S.composerWrap}>
          <div style={S.composer}>
            <input
              style={S.input}
              value={input}
              placeholder="Ask about the financials…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button style={S.sendBtn} onClick={() => send()} disabled={loading || !input.trim()}>↑</button>
          </div>
          <div style={S.disclaimer}>Answers are grounded in uploaded documents. Verify figures against the source.</div>
        </div>
      </main>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

const S = {
  app: { display: 'flex', height: '100vh', background: '#0d0d0d', color: '#e8e8e8',
         fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' },
  sidebar: { width: 260, background: '#111', borderRight: '1px solid #222', display: 'flex',
             flexDirection: 'column', padding: 16, gap: 12 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  logo: { width: 30, height: 30, borderRadius: '50%', background: '#e8a33d', color: '#111',
          display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 },
  brandText: { fontSize: 14, fontWeight: 600 },
  newChat: { background: 'transparent', border: '1px solid #2a2a2a', color: '#e8e8e8',
             padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, textAlign: 'left' },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, color: '#666', marginTop: 8 },
  docList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  empty: { fontSize: 12, color: '#555', padding: '8px 4px' },
  docItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
             borderRadius: 6, background: '#171717' },
  docInfo: { flex: 1, minWidth: 0 },
  docName: { fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  docMeta: { fontSize: 10, color: '#666', marginTop: 2 },
  removeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16, padding: 0 },
  uploadBtn: { background: '#e8a33d', border: 'none', color: '#111', padding: '10px',
               borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  welcome: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
             justifyContent: 'center', padding: 24 },
  logoLarge: { width: 44, height: 44, borderRadius: '50%', background: '#e8a33d', color: '#111',
               display: 'grid', placeItems: 'center', fontWeight: 700, marginBottom: 20 },
  h1: { fontSize: 30, fontWeight: 600, margin: 0 },
  sub: { fontSize: 15, color: '#888', marginTop: 8, marginBottom: 32 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
           gap: 12, maxWidth: 780, width: '100%' },
  card: { background: '#161616', border: '1px solid #242424', borderRadius: 10, padding: 16,
          textAlign: 'left', cursor: 'pointer', color: '#e8e8e8' },
  cardTitle: { fontSize: 14, fontWeight: 500 },
  cardSub: { fontSize: 12, color: '#777', marginTop: 4 },
  chat: { flex: 1, overflowY: 'auto', padding: '32px 24px', display: 'flex',
          flexDirection: 'column', gap: 28 },
  msgRow: { display: 'flex', gap: 14, maxWidth: 760, width: '100%', margin: '0 auto' },
  avatarUser: { width: 28, height: 28, borderRadius: '50%', background: '#2a2a2a', flexShrink: 0,
                display: 'grid', placeItems: 'center', fontSize: 10, color: '#aaa' },
  avatarBot: { width: 28, height: 28, borderRadius: '50%', background: '#e8a33d', color: '#111',
               flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 },
  msgBody: { flex: 1, minWidth: 0 },
  msgText: { fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap' },
  sources: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  sourceTag: { fontSize: 11, background: '#1c1c1c', border: '1px solid #2a2a2a',
               padding: '3px 8px', borderRadius: 4, color: '#999' },
  thinking: { fontSize: 14, color: '#666', paddingTop: 4 },
  composerWrap: { padding: '0 24px 20px' },
  composer: { display: 'flex', alignItems: 'center', gap: 8, maxWidth: 760, margin: '0 auto',
              background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 24, padding: '6px 6px 6px 18px' },
  input: { flex: 1, background: 'transparent', border: 'none', outline: 'none',
           color: '#e8e8e8', fontSize: 15, padding: '10px 0' },
  sendBtn: { width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#e8a33d',
             color: '#111', cursor: 'pointer', fontSize: 16, flexShrink: 0 },
  disclaimer: { textAlign: 'center', fontSize: 11, color: '#555', marginTop: 10 },
  toast: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
           background: '#1c1c1c', border: '1px solid #333', padding: '10px 18px',
           borderRadius: 8, fontSize: 13 },
};