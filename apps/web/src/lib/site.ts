export const site = {
  name: 'Living With Krishna',
  tagline: 'Learn devotional skills in the comfort of your home.',
  description:
    'Your one-stop platform for learning and mastering skills from the comfort of your home.',
  supportEmail: 'support@livingwithkrishna.org',
};

export const mainNav = [
  { href: '/explore', label: 'Explore' },
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
      { href: '/explore', label: 'Courses' },
      { href: '/plans-and-pricing', label: 'Plans & Pricing' },
      { href: '/become-an-instructor', label: 'Become an Instructor' },
    ],
  },
] as const;
