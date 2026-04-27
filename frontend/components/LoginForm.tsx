'use client';

import { useState } from 'react';
import { auth } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { LoadingSpinnerInline } from '@/components/LoadingScreen';

export function LoginForm() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const loginAndRedirect = async (token: string) => {
    localStorage.setItem('token', token);
    const me = await auth.me();
    setUser(me);
    window.location.href = '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const name = fullName || email.split('@')[0].replace(/[._]/g, ' ');

    try {
      if (isNewUser) {
        await auth.signup(email, password, name);
        const { access_token } = await auth.login(email, password);
        await loginAndRedirect(access_token);
      } else {
        try {
          const { access_token } = await auth.login(email, password);
          await loginAndRedirect(access_token);
        } catch {
          try {
            await auth.signup(email, password, name);
            const { access_token } = await auth.login(email, password);
            await loginAndRedirect(access_token);
          } catch (signupErr: unknown) {
            const msg = signupErr instanceof Error ? signupErr.message : '';
            if (msg.includes('already registered')) {
              setError('Incorrect password. Please try again.');
            } else {
              setError(msg || 'Could not connect to server. Is the backend running?');
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fc] p-4">
      <div className="w-full max-w-[440px] animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFC107] to-[#FF8F00] shadow-yellow mb-5">
            <span className="text-2xl font-black text-gray-900 tracking-tight">JJ</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            J.J.&apos;S MOTORS
          </h1>
          <p className="text-gray-500 mt-2 text-[15px]">
            AI-Powered Sales Coaching Platform
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-card border border-gray-200/80">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {isNewUser ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isNewUser ? 'Sign up to start practicing' : 'Sign in to access your dashboard'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isNewUser && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input py-3.5"
                  placeholder="John Smith"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="block text-[13px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input py-3.5"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input py-3.5"
                placeholder="Enter your password"
                required
                autoComplete={isNewUser ? 'new-password' : 'current-password'}
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 text-[15px] font-bold rounded-xl text-gray-900 bg-gradient-to-r from-[#FFC107] to-[#FFD54F] hover:from-[#FFB300] hover:to-[#FFC107] active:scale-[0.98] transition-all disabled:opacity-50 shadow-yellow hover:shadow-yellow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinnerInline className="!border-gray-600/30 !border-t-gray-800" />
                  <span>{isNewUser ? 'Creating account…' : 'Logging in…'}</span>
                </>
              ) : (
                isNewUser ? 'Create Account' : 'Login'
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => { setIsNewUser(!isNewUser); setError(''); }}
              className="text-sm text-gray-500 hover:text-[#FFC107] transition-colors"
            >
              {isNewUser ? 'Already have an account? Log in' : "New here? Create an account"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          AI-powered auto service coaching &middot; J.J.&apos;s Auto Service Center
        </p>
      </div>
    </div>
  );
}
