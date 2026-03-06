import Link from 'next/link';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/assets', label: 'Assets' },
  { href: '/liabilities', label: 'Liabilities' },
  { href: '/pricing', label: 'Pricing' }
];

export function SidebarNav() {
  return (
    <aside className="w-56 border-r border-slate-200 bg-white p-4">
      <h2 className="mb-6 text-lg font-bold">Mi Patrimonio Pro</h2>
      <nav className="space-y-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="block rounded-md px-3 py-2 text-sm hover:bg-slate-100">
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
