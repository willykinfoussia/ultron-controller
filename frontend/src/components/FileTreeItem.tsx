import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useState } from "react";

type FileTreeItemProps = {
  name: string;
  icon?: string;
  iconOpen?: string;
  isActive?: boolean;
  isDirectory?: boolean;
  isOpen?: boolean;
  depth?: number;
  meta?: string;
  badge?: number;
  badgeKind?: "default" | "warning" | "danger";
  hasChildren?: boolean;
  onClick?: () => void;
  onToggle?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export function FileTreeItem({
  name,
  icon = "📄",
  iconOpen,
  isActive = false,
  isDirectory = false,
  isOpen = false,
  depth = 0,
  meta,
  badge,
  badgeKind = "default",
  hasChildren = false,
  onClick,
  onToggle,
  actions,
  children,
}: FileTreeItemProps) {
  const prefersReduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (isDirectory && onToggle) {
          onToggle();
        } else if (onClick) {
          onClick();
        }
      }
      if (e.key === "ArrowRight" && isDirectory && !isOpen && onToggle) {
        onToggle();
      }
      if (e.key === "ArrowLeft" && isDirectory && isOpen && onToggle) {
        onToggle();
      }
    },
    [isDirectory, isOpen, onClick, onToggle],
  );

  const displayIcon = isDirectory && isOpen && iconOpen ? iconOpen : icon;

  return (
    <>
      <motion.div
        className={`file-tree-item ${isActive ? "active" : ""} ${isDirectory ? "is-dir" : "is-file"} ${hovered ? "is-hovered" : ""}`}
        role="treeitem"
        aria-expanded={isDirectory ? isOpen : undefined}
        aria-selected={isActive}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        tabIndex={0}
        initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15 }}
        whileHover={prefersReduced ? {} : { x: 2 }}
      >
        {/* Chevron */}
        {isDirectory ? (
          <button
            className={`file-tree-chevron ${isOpen ? "is-open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
            tabIndex={-1}
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            ▶
          </button>
        ) : (
          <span className="file-tree-chevron file-tree-chevron--placeholder" aria-hidden="true" />
        )}

        {/* Icon */}
        <span className="file-tree-icon" aria-hidden="true">
          {displayIcon}
        </span>

        {/* Name */}
        <span className="file-tree-name">{name}</span>

        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <span className={`file-tree-badge ${badgeKind}`}>{badge}</span>
        )}

        {/* Meta */}
        {meta && <span className="file-tree-meta">{meta}</span>}

        {/* Actions (visible on hover) */}
        {actions && (
          <div
            className={`file-tree-actions ${hovered ? "is-visible" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </motion.div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isDirectory && isOpen && hasChildren && children && (
          <motion.div
            role="group"
            initial={prefersReduced ? {} : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
