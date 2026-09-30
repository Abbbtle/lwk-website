export const site = {
  name: 'Living With Krishna',
  tagline: 'Learn devotional skills in the comfort of your home.',
  description:
    'Your one-stop platform for learning and mastering skills from the comfort of your home.',
  supportEmail: 'support@livingwithkrishna.org',
  officeHours: ['Monday – Friday,', '08:00 – 18:00', '(UTC + 2)'],
};

/**
 * Social profiles. Icons without a URL are shown but not linked until the profile exists.
 * TODO: add the real profile URLs.
 */
export const socialLinks = [
  { id: 'facebook', label: 'Facebook', href: null },
  { id: 'x', label: 'X (Twitter)', href: null },
  { id: 'instagram', label: 'Instagram', href: null },
  { id: 'linkedin', label: 'LinkedIn', href: null },
  { id: 'whatsapp', label: 'WhatsApp', href: null },
] as const satisfies readonly { id: string; label: string; href: string | null }[];

export const mainNav = [
  { href: '/categories', label: 'Categories' },
  { href: '/plans-and-pricing', label: 'Plans & Pricing' },
  { href: '/become-an-instructor', label: 'Become an Instructor' },
  { href: '/contact', label: 'Contact' },
] as const;

export const footerNav = [
  {
    title: 'Explore',
    links: [
      { href: '/', label: 'Home' },
      { href: '/our-mission', label: 'Our Mission' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/explore', label: 'Explore' },
      { href: '/plans-and-pricing', label: 'Plans & Pricing' },
      { href: '/become-an-instructor', label: 'Become an Instructor' },
    ],
  },
] as const;
