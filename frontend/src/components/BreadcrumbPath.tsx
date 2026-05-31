import { Fragment } from "react";

type BreadcrumbPathProps = {
  segments: Array<{
    label: string;
    icon?: string;
    onClick?: () => void;
  }>;
  maxVisible?: number;
};

export function BreadcrumbPath({ segments, maxVisible = 4 }: BreadcrumbPathProps) {
  if (segments.length === 0) return null;

  const needsCollapse = segments.length > maxVisible;
  const visibleSegments = needsCollapse
    ? [segments[0], { label: `…${segments.length - maxVisible + 1} more`, icon: "⋯" }, ...segments.slice(-(maxVisible - 2))]
    : segments;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {visibleSegments.map((seg, i) => {
          const isLast = i === visibleSegments.length - 1;
          const isClickable = seg.onClick && !isLast;
          return (
            <Fragment key={`${seg.label}-${i}`}>
              {i > 0 && (
                <li className="breadcrumb-sep" aria-hidden="true">
                  ›
                </li>
              )}
              <li className="breadcrumb-item">
                {isClickable ? (
                  <button
                    className="breadcrumb-link"
                    onClick={seg.onClick}
                    aria-label={`Navigate to ${seg.label}`}
                  >
                    {seg.icon && (
                      <span className="breadcrumb-icon" aria-hidden="true">
                        {seg.icon}
                      </span>
                    )}
                    <span className="breadcrumb-label">{seg.label}</span>
                  </button>
                ) : (
                  <span
                    className={`breadcrumb-current ${isLast ? "is-active" : ""}`}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {seg.icon && (
                      <span className="breadcrumb-icon" aria-hidden="true">
                        {seg.icon}
                      </span>
                    )}
                    <span className="breadcrumb-label">{seg.label}</span>
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
