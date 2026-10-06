export default function Loading() {
  return (
    <main className="page-container animate-pulse pt-4 pb-16" aria-busy>
      <div className="mb-5 flex h-8 items-center">
        <div className="h-4 w-28 rounded-4 bg-strip" />
      </div>
      <div className="mb-6 flex items-center gap-4">
        <div className="size-14 rounded-full bg-strip sm:size-16" />
        <div className="grid gap-2">
          <div className="h-8 w-48 rounded-10 bg-strip" />
          <div className="h-4 w-64 rounded-4 bg-strip" />
        </div>
      </div>
      <div className="h-36 rounded-20 bg-strip" />
    </main>
  );
}
