import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WikiPageMeta {
  path: string;
  title: string;
  description: string;
  tags: string[];
  confidence?: number;
  tokenCount: number;
  generatedBy: string;
  updatedAt: string;
  icon: string;
}

interface WikiPageFull extends WikiPageMeta {
  content: string;
}

interface SearchResult {
  path: string;
  snippet: string;
  score: number;
  icon: string;
}

// ── Markdown renderer — lightweight, no library ────────────────────────────────
// Handles: h1-h3, bold, italic, inline code, code blocks, bullet lists, hr

function renderMarkdown(md: string): string {
  let html = md
    // Code blocks first (before inline rules)
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre class="md-pre"><code>$1</code></pre>')
    // HR
    .replace(/^---$/gm, '<hr class="md-hr">')
    // H1
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // H2
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    // H3
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    // Bullet list items
    .replace(/^[-•] (.+)$/gm, '<li class="md-li">$1</li>')
    // Numbered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li md-oli">$1</li>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>')
    // Double newline → paragraph break
    .replace(/\n\n/g, '<br><br>')
    // Single newline → <br>
    .replace(/\n/g, '<br>');

  return html;
}

// ── Component ─────────────────────────────────────────────────────────────────

const WikiBrowserPage: React.FC = () => {
  const [pages, setPages] = useState<WikiPageMeta[]>([]);
  const [activePage, setActivePage] = useState<WikiPageFull | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Fetch page list on mount
  useEffect(() => {
    api.get('/wiki/pages')
      .then(r => setPages(Array.isArray(r.data?.pages) ? r.data.pages : []))
      .catch(() => setPages([]))
      .finally(() => setLoadingList(false));
  }, []);

  // Open a page
  const openPage = useCallback(async (path: string) => {
    setSearchResults(null);
    setSearchQuery('');
    setLoadingPage(true);
    try {
      const r = await api.get(`/wiki/pages/${encodeURIComponent(path)}`);
      setActivePage(r.data);
    } catch {
      setActivePage(null);
    } finally {
      setLoadingPage(false);
    }
  }, []);

  // Debounced search
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!q.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get('/wiki/search', { params: { q, limit: 5 } });
        setSearchResults(Array.isArray(r.data?.results) ? r.data.results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    setSearchDebounce(t);
  };

  // Relative date
  const relativeDate = (iso: string) => {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return '1d ago';
    return `${d}d ago`;
  };

  return (
    <div className="min-h-screen bg-bg text-fg font-mono flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <span className="text-sm font-black tracking-widest text-amber">WIKI</span>
          <input
            type="text"
            placeholder="search your knowledge base…"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 bg-raised border border-border rounded px-3 py-1.5 text-xs text-fg placeholder-dim focus:outline-none focus:border-amber/40"
          />
          {searching && <span className="text-xs text-dim animate-pulse">searching…</span>}
        </div>
      </div>

      <div className="flex flex-1 max-w-3xl mx-auto w-full gap-0">

        {/* Sidebar — page list */}
        <div className="w-40 shrink-0 border-r border-border pt-4 pr-2">
          {loadingList ? (
            <div className="px-2 text-xs text-dim animate-pulse">loading…</div>
          ) : pages.length === 0 ? (
            <div className="px-2 text-xs text-dim">No pages yet. Axiom writes these nightly.</div>
          ) : (
            <nav className="flex flex-col gap-1">
              {pages.map(p => (
                <button
                  key={p.path}
                  onClick={() => openPage(p.path)}
                  className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                    activePage?.path === p.path
                      ? 'bg-amber/10 text-amber border-l-2 border-amber pl-1.5'
                      : 'text-dim hover:text-fg hover:bg-raised'
                  }`}
                >
                  <span className="mr-1">{p.icon}</span>
                  <span className="font-bold">{p.title}</span>
                  <div className="text-2xs text-dim/60 mt-0.5">{relativeDate(p.updatedAt)}</div>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 pt-4 pl-4 pr-2 pb-8 min-w-0">

          {/* Search results */}
          <AnimatePresence>
            {searchResults !== null && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4"
              >
                <div className="text-2xs text-dim mb-2 tracking-widest font-bold">
                  SEARCH RESULTS — {searchResults.length} found
                </div>
                {searchResults.length === 0 ? (
                  <div className="text-xs text-dim">No results for "{searchQuery}".</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {searchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => openPage(r.path.replace(/^\[community\]\//, ''))}
                        className="text-left px-3 py-2 bg-raised border border-border rounded hover:border-amber/30 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs">{r.icon}</span>
                          <span className="text-2xs font-bold text-amber tracking-widest">
                            {r.path}
                          </span>
                          <span className="text-2xs text-dim ml-auto">
                            {Math.round(r.score * 100)}% match
                          </span>
                        </div>
                        <p className="text-xs text-dim leading-relaxed line-clamp-3">{r.snippet}</p>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Page content */}
          {loadingPage ? (
            <div className="text-xs text-dim animate-pulse">loading page…</div>
          ) : activePage ? (
            <motion.div
              key={activePage.path}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Page header */}
              <div className="mb-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{activePage.icon}</span>
                  <h1 className="text-sm font-black tracking-wide text-fg">{activePage.title}</h1>
                </div>
                <div className="flex items-center gap-3 text-2xs text-dim">
                  <span>{relativeDate(activePage.updatedAt)}</span>
                  <span>{activePage.tokenCount} tokens</span>
                  <span className={activePage.generatedBy === 'llm' ? 'text-amber' : 'text-dim'}>
                    {activePage.generatedBy === 'llm' ? '✦ LLM' : 'algorithmic'}
                  </span>
                  {activePage.confidence && (
                    <span>confidence {Math.round(activePage.confidence * 100)}%</span>
                  )}
                </div>
                {activePage.description && (
                  <p className="text-xs text-dim/80 mt-1.5 italic">{activePage.description}</p>
                )}
                {activePage.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activePage.tags.map(t => (
                      <span key={t} className="text-2xs bg-raised border border-border px-1.5 py-0.5 rounded text-dim">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Rendered markdown */}
              <div
                className="wiki-content text-xs leading-relaxed text-fg/90"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(activePage.content) }}
              />
            </motion.div>
          ) : searchResults === null ? (
            <div className="text-center pt-16 text-dim">
              <div className="text-3xl mb-3">📚</div>
              <div className="text-xs font-bold text-dim/70 tracking-widest mb-1">YOUR KNOWLEDGE BASE</div>
              <div className="text-xs text-dim/50 max-w-xs mx-auto">
                Axiom synthesizes 5 wiki pages nightly from your goals, mood, and journal.
                Select a page or search to browse.
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Inline markdown styles */}
      <style>{`
        .wiki-content .md-h1 { font-size: 0.9rem; font-weight: 900; margin: 1rem 0 0.4rem; color: var(--color-fg); }
        .wiki-content .md-h2 { font-size: 0.8rem; font-weight: 800; margin: 0.8rem 0 0.3rem; color: var(--color-amber); letter-spacing: 0.05em; }
        .wiki-content .md-h3 { font-size: 0.75rem; font-weight: 700; margin: 0.6rem 0 0.25rem; color: var(--color-fg); opacity: 0.8; }
        .wiki-content .md-bold { font-weight: 800; }
        .wiki-content .md-italic { font-style: italic; opacity: 0.85; }
        .wiki-content .md-code { font-family: monospace; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 0 4px; font-size: 0.7rem; }
        .wiki-content .md-pre { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.75rem; margin: 0.5rem 0; overflow-x: auto; font-size: 0.7rem; line-height: 1.5; }
        .wiki-content .md-li { margin-left: 1rem; margin-bottom: 0.15rem; list-style: disc; display: list-item; }
        .wiki-content .md-oli { list-style: decimal; }
        .wiki-content .md-blockquote { border-left: 2px solid var(--color-amber); padding-left: 0.75rem; opacity: 0.75; margin: 0.4rem 0; font-style: italic; }
        .wiki-content .md-hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 0.8rem 0; }
      `}</style>
    </div>
  );
};

export default WikiBrowserPage;
