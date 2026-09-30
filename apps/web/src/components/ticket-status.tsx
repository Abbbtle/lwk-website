const styles: Record<string, string> = {
  OPEN: 'border-brand text-brand-ink',
  PENDING: 'border-blue-700 text-blue-800',
  RESOLVED: 'border-green-700 text-green-800',
  CLOSED: 'border-gray-400 text-gray-600',
  URGENT: 'border-red-700 bg-red-700 text-white',
  HIGH: 'border-red-700 text-red-700',
  NORMAL: 'border-gray-400 text-gray-700',
  LOW: 'border-gray-300 text-gray-500',
};

/** Status or priority of a support request. */
export function TicketBadge({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-xs font-bold whitespace-nowrap uppercase ${styles[value] ?? 'border-gray-400'}`}
    >
      {label}
    </span>
  );
}
