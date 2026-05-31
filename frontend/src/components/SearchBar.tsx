import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  resultCount?: number;
  disabled?: boolean;
};

export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = "Search files…",
  resultCount,
  disabled = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && onSearch) {
        onSearch(value);
      }
      if (e.key === "Escape") {
        onChange("");
        inputRef.current?.blur();
      }
    },
    [value, onSearch, onChange],
  );

  const handleClear = useCallback(() => {
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div
      className={`search-bar ${focused ? "search-bar--focused" : ""} ${value ? "search-bar--has-value" : ""}`}
      role="search"
      aria-label="Search memory files"
    >
      <span className="search-bar-icon" aria-hidden="true">
        🔍
      </span>
      <input
        ref={inputRef}
        className="search-bar-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <AnimatePresence mode="wait">
        {value && (
          <motion.button
            key="clear"
            className="search-bar-clear"
            onClick={handleClear}
            aria-label="Clear search"
            title="Clear search (Esc)"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
          >
            ✕
          </motion.button>
        )}
      </AnimatePresence>
      {resultCount !== undefined && value && (
        <span className="search-bar-count" aria-live="polite">
          {resultCount} found
        </span>
      )}
      <kbd className="search-bar-kbd" aria-hidden="true">
        /
      </kbd>
    </div>
  );
}
