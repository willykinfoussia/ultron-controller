/** Single shimmer bar. */
export function Skeleton({
  height = 14,
  width = "100%",
}: {
  height?: number | string;
  width?: number | string;
}) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ height, width, minWidth: 0 }}
    />
  );
}

/** Pre-composed skeleton mimicking a list-item row. */
export function SkeletonListItem({
  titleWidth = "62%",
  metaWidth = "42%",
  hasBadgeRow = false,
}: {
  titleWidth?: string;
  metaWidth?: string;
  hasBadgeRow?: boolean;
}) {
  return (
    <div className="skeleton-item" aria-hidden="true">
      <Skeleton height={13} width={titleWidth} />
      <Skeleton height={11} width={metaWidth} />
      {hasBadgeRow && (
        <div className="skeleton-row" style={{ marginTop: 2 }}>
          <Skeleton height={18} width={58} />
          <Skeleton height={18} width={50} />
          <Skeleton height={18} width={58} />
        </div>
      )}
    </div>
  );
}

/** A stack of skeleton list items — renders `count` items. */
export function SkeletonList({
  count = 6,
  hasBadgeRow = false,
}: {
  count?: number;
  hasBadgeRow?: boolean;
}) {
  return (
    <div
      className="list"
      aria-label="Loading…"
      aria-busy="true"
      style={{ gap: 4 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonListItem
          key={i}
          titleWidth={`${55 + ((i * 17) % 30)}%`}
          metaWidth={`${35 + ((i * 13) % 25)}%`}
          hasBadgeRow={hasBadgeRow}
        />
      ))}
    </div>
  );
}

/** Skeleton for a content-editor area (lines of text). */
export function SkeletonEditor({ lines = 12 }: { lines?: number }) {
  return (
    <div
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
      aria-hidden="true"
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height={13}
          width={i % 5 === 4 ? "45%" : i % 3 === 0 ? "90%" : "100%"}
        />
      ))}
    </div>
  );
}
