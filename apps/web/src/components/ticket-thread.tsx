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
        const style = message.internal
          ? 'border-l-4 border-yellow-500 bg-yellow-50'
          : message.fromStaff
            ? 'border-l-4 border-brand bg-white'
            : 'border-l-4 border-gray-400 bg-white';
        const who = message.internal
          ? `${message.authorName} · internal note`
          : message.fromStaff
            ? viewer === 'requester'
              ? `${message.authorName} · Living With Krishna support`
              : `${message.authorName} · staff`
            : message.authorName;
        return (
          <li key={message.id} className={`${style} p-4 shadow-sm`}>
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
            <RichText text={message.body} size="sm" className="mt-2 text-base text-gray-800" />
          </li>
        );
      })}
    </ol>
  );
}
