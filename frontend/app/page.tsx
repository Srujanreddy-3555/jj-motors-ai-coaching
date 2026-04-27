'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/lib/auth-store';
import { Dashboard } from '@/components/Dashboard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { auth } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [showDashboard, setShowDashboard] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      useAuthStore.getState().logout();
      setChecking(false);
      router.replace('/login');
      return;
    }
    auth.me()
      .then((user) => {
        setUser(user);
        setShowDashboard(true);
      })
      .catch(() => {
        useAuthStore.getState().logout();
        router.replace('/login');
      })
      .finally(() => setChecking(false));
  }, [setUser, router]);

  if (checking || !showDashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fc]">
        <LoadingScreen message="Loading…" className="min-h-[60vh]" />
      </div>
    );
  }

  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}
