import type { IconType } from 'react-icons';
import { FaInstagram, FaLinkedin, FaSquareFacebook, FaWhatsapp, FaXTwitter } from 'react-icons/fa6';
import { socialLinks } from '@/lib/site';

const icons: Record<(typeof socialLinks)[number]['id'], IconType> = {
  facebook: FaSquareFacebook,
  x: FaXTwitter,
  instagram: FaInstagram,
  linkedin: FaLinkedin,
  whatsapp: FaWhatsapp,
};

/** Footer icons; the POC shows Facebook, X, Instagram and LinkedIn there. */
export function SocialIcons({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex items-center gap-4 ${className}`}>
      {socialLinks
        .filter((s) => s.id !== 'whatsapp')
        .map(({ id, label, href }) => {
          const Icon = icons[id];
          const icon = <Icon className="size-6" aria-hidden />;
          return (
            <li key={id}>
              {href ? (
                <a
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand"
                >
                  {icon}
                </a>
              ) : (
                <span title={`${label} (coming soon)`}>{icon}</span>
              )}
            </li>
          );
        })}
    </ul>
  );
}
