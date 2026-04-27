'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

const NAV_ITEMS = [
  {
    href: '/',
    label: 'AI Practice Calls',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    ),
    hasPlus: true,
  },
  {
    href: '/calls',
    label: 'Call History',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/coaching',
    label: 'AI Coaching',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    href: '/scoring',
    label: 'Call Scoring',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Advisor';

  return (
    <aside className="sidebar-root fixed left-0 top-0 bottom-0 w-[250px] z-40 flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-[#FFC107] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <span className="text-[15px] font-black text-gray-900 leading-none">JJ</span>
          </div>
          <span className="text-[16px] font-bold text-white tracking-tight">
            J.J.&apos;s Motors
          </span>
        </Link>
      </div>

      {/* Login prompt for unauthenticated (like Hyperbound's "Have an account already?") */}
      {!user && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]">
          <p className="text-gray-400 text-xs mb-2">Have an account already?</p>
          <Link href="/login" className="block w-full py-2 rounded-lg bg-white text-gray-900 text-sm font-semibold text-center hover:bg-gray-100 transition-colors">
            Log In
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-1">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const isDisabled = item.href.startsWith('#');
            const Tag = isDisabled ? 'div' : Link;
            return (
              <Tag
                key={item.label}
                href={isDisabled ? undefined as unknown as string : item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-[#FFC107]/12 text-[#FFC107]'
                    : isDisabled
                    ? 'text-gray-500 cursor-default'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span className={isActive ? 'text-[#FFC107]' : 'text-gray-500'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.hasPlus && (
                  <span className="w-5 h-5 rounded-md bg-[#FFC107] flex items-center justify-center text-gray-900 text-xs font-bold">+</span>
                )}
                {isDisabled && (
                  <span className="text-[10px] text-gray-600 bg-white/[0.06] px-1.5 py-0.5 rounded font-medium">Soon</span>
                )}
              </Tag>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-4 pb-4 space-y-3">
        {/* Rating badge (like Hyperbound's G2 rating) */}
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-[#FFC107] text-sm">★</span>
          <span className="text-gray-400 text-xs">AI-Powered Auto Service Coach</span>
        </div>

        {/* CTA box */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-white text-xs font-semibold mb-0.5">Build custom AI scenarios</p>
          <p className="text-gray-500 text-[11px] leading-relaxed">
            Use the Quick Start panel to create your own customer persona.
          </p>
        </div>

        {/* User profile */}
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFC107] to-[#FF8F00] flex items-center justify-center text-[11px] font-bold text-gray-900 flex-shrink-0">
              {firstName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white truncate">{firstName}</p>
              <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/[0.06] transition-colors flex-shrink-0"
              title="Log out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
