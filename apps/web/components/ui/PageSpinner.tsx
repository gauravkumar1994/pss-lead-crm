export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <div className="page-loading-spinner" />
      <p>{label}</p>
    </div>
  );
}
