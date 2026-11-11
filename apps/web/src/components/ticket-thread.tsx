import { RichText } from '@/components/rich-text';

type Message = {
  id: string;
  authorName: string;
  fromStaff: boolean;
  internal?: boolean;
  body: string;
  createdAt: Date;
};

/** The conversation of a support request: the person's messages, staff replies, staff notes. */
export function TicketThread({
  messages,
  viewer,
}: {
  messages: Message[];
  viewer: 'requester' | 'staff';
}) {
  return (
    <ol className="space-y-4">
      {messages.map((message) => {
        // Who wrote it shows in the whole card's tint, not a bar down one side: staff notes in
        // yellow, our replies on a saffron wash, the requester's messages in white.
        const style = message.internal
          ? 'border-yellow-500/40 bg-yellow-50'
          : message.fromStaff
            ? 'border-brand/30 bg-orange-50'
            : 'border-gray-200 bg-white';
        const who = message.internal
          ? `${message.authorName} · internal note`
          : message.fromStaff
            ? viewer === 'requester'
              ? `${message.authorName} · Living With Krishna support`
              : `${message.authorName} · staff`
            : message.authorName;
        return (
          <li key={message.id} className={`${style} rounded-card border p-4 shadow-soft`}>
            <p className="text-sm">
              <span className="font-semibold">{who}</span>{' '}
              <time dateTime={message.createdAt.toISOString()} className="text-gray-500">
                ·{' '}
                {message.createdAt.toLocaleString('en-GB', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </p>
            <RichText text={message.body} size="md" className="mt-2" />
          </li>
        );
      })}
    </ol>
  );
}
