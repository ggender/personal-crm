export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl animate-pulse px-4 py-6 sm:px-6" aria-busy>
      <div className="bg-muted mb-6 h-4 w-28 rounded" />
      <div className="mb-6 flex items-center gap-4">
        <div className="bg-muted size-16 rounded-full" />
        <div className="grid gap-2">
          <div className="bg-muted h-6 w-48 rounded" />
          <div className="bg-muted h-4 w-64 rounded" />
        </div>
      </div>
      <div className="bg-muted h-36 rounded-xl" />
    </main>
  );
}
