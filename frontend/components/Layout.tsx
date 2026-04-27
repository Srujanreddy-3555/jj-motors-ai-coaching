'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { useRouter } from 'next/navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthPage = pathname === '/login';
  if (isAuthPage) return <>{children}</>;

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    router.replace('/login');
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/80">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFC107] flex items-center justify-center">
              <span className="text-sm font-black text-gray-900">JJ</span>
            </div>
            <span className="font-bold text-gray-900 text-[15px]">J.J.&apos;s Motors</span>
          </Link>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-4 space-y-2">
            <Link href="/" onClick={() => setMobileOpen(false)} className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${pathname === '/' ? 'bg-[#FFC107]/10 text-[#F57F17]' : 'text-gray-700 hover:bg-gray-50'}`}>AI Practice Calls</Link>
            <Link href="/calls" onClick={() => setMobileOpen(false)} className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${pathname.startsWith('/calls') ? 'bg-[#FFC107]/10 text-[#F57F17]' : 'text-gray-700 hover:bg-gray-50'}`}>Call History</Link>
            <Link href="/scoring" onClick={() => setMobileOpen(false)} className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${pathname === '/scoring' ? 'bg-[#FFC107]/10 text-[#F57F17]' : 'text-gray-700 hover:bg-gray-50'}`}>Call Scoring</Link>
            <Link href="/analytics" onClick={() => setMobileOpen(false)} className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${pathname === '/analytics' ? 'bg-[#FFC107]/10 text-[#F57F17]' : 'text-gray-700 hover:bg-gray-50'}`}>Analytics</Link>
            <Link href="/coaching" onClick={() => setMobileOpen(false)} className={`block px-4 py-2.5 rounded-xl text-sm font-medium ${pathname === '/coaching' ? 'bg-[#FFC107]/10 text-[#F57F17]' : 'text-gray-700 hover:bg-gray-50'}`}>AI Coaching</Link>
            <div className="h-px bg-gray-200 my-2" />
            {user && (
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="w-8 h-8 rounded-lg bg-[#FFC107] flex items-center justify-center text-xs font-bold text-gray-900">
                  {user.full_name?.[0]?.toUpperCase() || 'A'}
                </div>
                <span className="text-sm text-gray-700 font-medium flex-1">{user.full_name || 'Advisor'}</span>
                <button onClick={handleLogout} className="text-sm text-red-500 font-medium">Log out</button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main content — wider to support the 2-column dashboard */}
      <main className="lg:ml-[250px] min-h-screen">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
