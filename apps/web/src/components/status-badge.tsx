const styles: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'border-gray-400 text-gray-700' },
  IN_REVIEW: { label: 'In review', className: 'border-brand text-brand-ink' },
  PUBLISHED: { label: 'Published', className: 'border-green-700 text-green-800' },
  ARCHIVED: { label: 'Archived', className: 'border-gray-400 text-gray-500' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = styles[status] ?? { label: status, className: 'border-gray-400' };
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs font-bold uppercase ${style.className}`}
    >
      {style.label}
    </span>
  );
}
