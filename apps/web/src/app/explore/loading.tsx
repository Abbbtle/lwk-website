export default function ExploreLoading() {
  return (
    <div className="page-width py-12" aria-busy="true">
      <span className="sr-only">Loading free content</span>
      <div className="h-10 w-64 animate-pulse bg-gray-100" />
      <div className="mt-4 h-6 w-96 max-w-full animate-pulse bg-gray-100" />
      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
