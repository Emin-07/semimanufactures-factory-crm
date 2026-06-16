import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { C } from "../../theme/colors.js";
import { I } from "../../icons/Icons.jsx";

// NAV SEARCH (Topbar — search across menu sections)
const NavSearch = ({ navGroups, onGoToPage }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  const flatItems = useMemo(() => {
    const out = [];
    for (const g of navGroups) {
      for (const item of g.items) out.push({ id: item.id, label: item.label, groupLabel: g.label });
    }
    return out;
  }, [navGroups]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flatItems.filter(i => i.label.toLowerCase().includes(q) || i.groupLabel.toLowerCase().includes(q)).slice(0, 8);
  }, [flatItems, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [open]);

  useEffect(() => {
    const h = e => {
      const inWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inWrap && !inPanel) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const select = item => {
    onGoToPage(item.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = e => {
    if (e.key === "Escape") { setQuery(""); setOpen(false); inputRef.current?.blur(); return; }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); select(results[activeIndex]); }
  };

  return (
    <div ref={wrapRef} className="hide-mobile" style={{ position: "relative", width: 230 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, padding: "6px 10px" }}>
        <I.search size={14} style={{ color: C.dim, flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder="Поиск по разделам..."
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, fontFamily: "inherit" }}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", display: "flex", padding: 0 }}>
            <I.x size={13} />
          </button>
        )}
      </div>
      {open && results.length > 0 && rect && createPortal(
        <div ref={panelRef} className="nav-search-panel" style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 230), background: "#1A1510", border: "1px solid rgba(255,255,255,.16)", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,.85)", zIndex: 9999, overflow: "hidden", padding: 4 }}>
          {results.map((item, idx) => (
            <div
              key={item.id}
              className="nav-search-result"
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => select(item)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                background: idx === activeIndex ? "rgba(211,166,70,.13)" : "transparent",
                color: idx === activeIndex ? C.primary : C.text,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 10, color: C.dim }}>{item.groupLabel}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export { NavSearch };
