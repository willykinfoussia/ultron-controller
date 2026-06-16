interface PageHeaderProps {
  title: string;
  meta?: string;
}

export default function PageHeader({ title, meta }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 'var(--sp-4)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0 }}>{title}</h1>
      {meta && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', marginTop: 'var(--sp-1)' }}>{meta}</p>
      )}
    </div>
  );
}
