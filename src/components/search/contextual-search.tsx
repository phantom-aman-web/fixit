"use client";

import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/use-debounce";

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  metadata?: React.ReactNode;
  icon?: React.ReactNode;
  score?: number;
}

interface ContextualSearchProps {
  placeholder?: string;
  queryKey: string;
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onSelect: (item: SearchResultItem) => void;
  emptyStateText?: string;
  className?: string;
  autoFocus?: boolean;
}

export function ContextualSearch({
  placeholder = "Search...",
  queryKey,
  onSearch,
  onSelect,
  emptyStateText = "No results found.",
  className = "",
  autoFocus = false,
}: ContextualSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 250);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", queryKey, debouncedQuery],
    queryFn: () => onSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60, // 1 minute cache
  });

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          onSelect(results[selectedIndex]);
          setIsOpen(false);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const showSuggestions = isOpen && (debouncedQuery.length >= 2 || isFetching);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="pl-9 pr-9 bg-background/50 backdrop-blur-sm border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-primary"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls="search-suggestions"
          aria-activedescendant={selectedIndex >= 0 ? `search-item-${selectedIndex}` : undefined}
        />
        {query && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div
          id="search-suggestions"
          className="absolute top-full left-0 right-0 mt-2 z-50 rounded-md border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2"
          role="listbox"
        >
          {isFetching ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-center text-muted-foreground">
              {emptyStateText}
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {results.map((result, idx) => (
                <li
                  key={result.id}
                  id={`search-item-${idx}`}
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`flex flex-col gap-0.5 px-3 py-2 cursor-pointer ${
                    idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => {
                    onSelect(result);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {result.icon && <span className="flex-shrink-0 text-muted-foreground">{result.icon}</span>}
                    <span className="font-medium text-sm truncate">{result.title}</span>
                  </div>
                  {(result.subtitle || result.metadata) && (
                    <div className="flex items-center gap-2 pl-[calc(1rem+8px)]">
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground truncate">{result.subtitle}</span>
                      )}
                      {result.metadata && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {result.subtitle && <span>&middot;</span>}
                          {result.metadata}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
