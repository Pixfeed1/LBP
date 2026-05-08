"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText, X } from "lucide-react";

import { api } from "@/lib/api";
import type { SearchResult, SearchResponse } from "@/types/search";

const DEBOUNCE_MS = 300;

const STATUS_BADGE: Record<string, { label: string; classes: string }> = {
  pending:   { label: "En attente",  classes: "bg-amber-50 text-amber-700 border-amber-200" },
  sent:      { label: "Envoyé",      classes: "bg-blue-50 text-blue-700 border-blue-200" },
  signed:    { label: "Signé",       classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partial:   { label: "Partiel",     classes: "bg-orange-50 text-orange-700 border-orange-200" },
  expired:   { label: "Expiré",      classes: "bg-red-50 text-red-700 border-red-200" },
  cancelled: { label: "Annulé",      classes: "bg-slate-50 text-slate-700 border-slate-200" },
};

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
      setResults(res.data.results);
      setTotal(res.data.total);
      setHighlightedIndex(-1);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Raccourci Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.link);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(-1, i - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && results[highlightedIndex]) {
      e.preventDefault();
      handleSelect(results[highlightedIndex]);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const showDropdown = open && (query.length >= 2 || loading);

  return (
    <div ref={containerRef} className="relative hidden md:flex">
      <div
        className={`flex items-center gap-2 bg-muted/50 hover:bg-muted/70 transition-colors px-3 py-1.5 rounded-md w-72 ${open ? "ring-1 ring-primary/40" : ""}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        ) : (
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher (⌘K)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button onClick={handleClear} className="text-muted-foreground hover:text-foreground" aria-label="Effacer">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {!query && (
          <kbd className="hidden lg:inline-flex h-5 px-1.5 text-[10px] font-medium bg-background border border-border rounded text-muted-foreground items-center">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 w-[420px] max-h-[450px] bg-white border border-border rounded-lg shadow-lg z-50 flex flex-col overflow-hidden">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : query.length < 2 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Tapez au moins 2 caractères...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun résultat pour <strong>"{query}"</strong></p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Interventions ({total})
                </p>
              </div>
              <ul className="overflow-y-auto">
                {results.map((r, i) => {
                  const badge = r.status ? STATUS_BADGE[r.status] : null;
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => handleSelect(r)}
                        onMouseEnter={() => setHighlightedIndex(i)}
                        className={`w-full text-left px-3 py-2.5 transition-colors flex items-start gap-2.5 ${
                          highlightedIndex === i ? "bg-muted/60" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center mt-0.5">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                            {badge && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.classes} flex-shrink-0`}>
                                {badge.label}
                              </span>
                            )}
                          </div>
                          {r.subtitle && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{r.subtitle}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
