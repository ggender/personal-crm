export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <p className="sr-only">Загрузка…</p>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
