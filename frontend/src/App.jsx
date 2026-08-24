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
    if (documents.length === 0) {
      showToast('Upload a document first');
      return;
    }
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
    'What was the revenue growth this year?',
    'Summarise the operating and net margins.',
    'What is the operating cash flow and cash conversion?',
    'What are the main risks disclosed?',
  ];

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brand}>Equity Research</div>

        <button style={S.newChat} onClick={() => setMessages([])}>New conversation</button>

        <div style={S.sectionLabel}>Documents</div>
        <div style={S.docList}>
          {documents.length === 0 && <div style={S.empty}>Nothing indexed yet</div>}
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
          {uploading ? 'Indexing…' : 'Upload PDF'}
        </button>
      </aside>

      <main style={S.main}>
        {messages.length === 0 ? (
          <div style={S.welcome}>
            <h1 style={S.h1}>Equity Research Assistant</h1>
            <p style={S.sub}>
              {documents.length === 0
                ? 'Upload an annual report to begin.'
                : `Ask anything across ${documents.length} indexed document${documents.length > 1 ? 's' : ''}.`}
            </p>
            <div style={S.cards}>
              {suggestions.map((s) => (
                <button key={s} style={S.card} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={S.chat}>
            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} style={S.userRow}>
                  <div style={S.userBubble}>{m.text}</div>
                </div>
              ) : (
                <div key={i} style={S.botRow}>
                  <div style={{ ...S.botText, color: m.error ? '#b4483c' : '#2c2925' }}>{m.text}</div>
                  {m.sources?.length > 0 && (
                    <div style={S.sources}>
                      {m.sources.map((s) => <span key={s} style={S.sourceTag}>{s}</span>)}
                    </div>
                  )}
                </div>
              )
            ))}
            {loading && <div style={S.botRow}><div style={S.thinking}>Searching documents…</div></div>}
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
          <div style={S.disclaimer}>Answers are grounded in your uploaded documents. Verify figures against the source.</div>
        </div>
      </main>

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const ACCENT = '#c15f3c';
const INK = '#2c2925';
const MUTED = '#6b665f';

const S = {
  app: { display: 'flex', height: '100vh', background: '#faf9f7', color: INK,
         fontFamily: SANS, overflow: 'hidden' },
  sidebar: { width: 250, background: '#f3f1ed', borderRight: '1px solid #e5e1da',
             display: 'flex', flexDirection: 'column', padding: 18, gap: 14 },
  brand: { fontFamily: SERIF, fontSize: 17, fontWeight: 500, letterSpacing: -0.2 },
  newChat: { background: '#fff', border: '1px solid #e0dcd4', color: INK, padding: '9px 12px',
             borderRadius: 8, cursor: 'pointer', fontSize: 13, textAlign: 'left' },
  sectionLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7,
                  color: '#8b857c', marginTop: 6 },
  docList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
  empty: { fontSize: 12.5, color: '#a39d93', padding: '6px 2px' },
  docItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
             borderRadius: 7, background: '#fff', border: '1px solid #eae6df' },
  docInfo: { flex: 1, minWidth: 0 },
  docName: { fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  docMeta: { fontSize: 10.5, color: '#a39d93', marginTop: 2 },
  removeBtn: { background: 'none', border: 'none', color: '#b3ada3', cursor: 'pointer',
               fontSize: 16, padding: 0, lineHeight: 1 },
  uploadBtn: { background: ACCENT, border: 'none', color: '#fff', padding: '10px',
               borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  welcome: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
             justifyContent: 'center', padding: 24 },
  h1: { fontFamily: SERIF, fontSize: 34, fontWeight: 400, margin: 0, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: MUTED, marginTop: 10, marginBottom: 36 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
           gap: 10, maxWidth: 700, width: '100%' },
  card: { background: '#fff', border: '1px solid #e8e4dd', borderRadius: 10, padding: '14px 16px',
          textAlign: 'left', cursor: 'pointer', color: INK, fontSize: 13.5, lineHeight: 1.45 },
  chat: { flex: 1, overflowY: 'auto', padding: '36px 24px', display: 'flex',
          flexDirection: 'column', gap: 26 },
  userRow: { maxWidth: 720, width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'flex-end' },
  userBubble: { background: '#f0ece5', padding: '11px 16px', borderRadius: 14,
                fontSize: 15, lineHeight: 1.55, maxWidth: '80%' },
  botRow: { maxWidth: 720, width: '100%', margin: '0 auto' },
  botText: { fontSize: 15.5, lineHeight: 1.72, whiteSpace: 'pre-wrap' },
  sources: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  sourceTag: { fontSize: 11, background: '#f3f1ed', border: '1px solid #e5e1da',
               padding: '3px 9px', borderRadius: 4, color: MUTED },
  thinking: { fontSize: 14.5, color: '#a39d93' },
  composerWrap: { padding: '0 24px 22px' },
  composer: { display: 'flex', alignItems: 'center', gap: 8, maxWidth: 720, margin: '0 auto',
              background: '#fff', border: '1px solid #e0dcd4', borderRadius: 26,
              padding: '5px 5px 5px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  input: { flex: 1, background: 'transparent', border: 'none', outline: 'none',
           color: INK, fontSize: 15, padding: '11px 0' },
  sendBtn: { width: 34, height: 34, borderRadius: '50%', border: 'none', background: ACCENT,
             color: '#fff', cursor: 'pointer', fontSize: 15, flexShrink: 0 },
  disclaimer: { textAlign: 'center', fontSize: 11.5, color: '#a39d93', marginTop: 11 },
  toast: { position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
           background: INK, color: '#faf9f7', padding: '10px 18px', borderRadius: 8, fontSize: 13 },
};