'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { clearHistory } from '@/lib/history';

export default function SolveHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/account', { method: 'DELETE' });
      if (res.ok) {
        // Also erase local browser IndexedDB storage completely
        try {
          await clearHistory();
        } catch (e) {
          console.warn('Failed to clear local history:', e);
        }
        await authClient.signOut();
        router.push('/');
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // User display name from Better Auth session or fallback
  const userDisplayName = session?.user?.name || (session?.user?.email ? session.user.email.split('@')[0] : 'user');
  const userInitial = userDisplayName ? userDisplayName[0].toUpperCase() : 'U';

  const navLinks = [
    {
      name: 'Capture & Solve',
      href: '/solve/capture',
      icon: 'photo_camera',
      isActive: pathname === '/solve' || pathname === '/solve/capture',
    },
    {
      name: 'Upload & Solve',
      href: '/solve/upload',
      icon: 'upload_file',
      isActive: pathname === '/solve/upload',
    },
    {
      name: 'Write & Solve',
      href: '/solve/write',
      icon: 'draw',
      isActive: pathname === '/solve/write',
    },
    {
      name: 'Type & Solve',
      href: '/solve/type',
      icon: 'keyboard',
      isActive: pathname === '/solve/type',
    },
    {
      name: 'Notebook',
      href: '/solve/notebook',
      icon: 'menu_book',
      isActive: pathname === '/solve/notebook',
    },
  ];

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push('/auth');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-hairline">
      <div className="h-16 w-full px-3 sm:px-margin flex items-center justify-between gap-2 sm:gap-space-md max-w-[1520px] mx-auto">
        {/* Logo & Version telemetry */}
        <div className="flex items-center gap-2 sm:gap-space-md shrink-0">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center relative transition-transform group-hover:scale-105 shrink-0">
              <div className="w-4 h-4 rounded-full bg-surface flex items-center justify-center shadow-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-amber"></div>
              </div>
            </div>
            <span className="font-headline-sm text-base sm:text-headline-sm tracking-tight text-ink font-semibold">
              Math <span className="text-amber">Engine</span>
            </span>
          </Link>
          
        </div>



        {/* Desktop Navigation Pill Switcher */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-surface-container-low border border-hairline">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3.5 py-1 rounded-full font-body-sm text-body-sm transition-all whitespace-nowrap cursor-pointer ${
                link.isActive
                  ? 'bg-amber text-ink font-semibold shadow-sm'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-container'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Right Actions: Session User & Sign Out */}
        <div className="flex items-center gap-1.5 sm:gap-2 relative shrink-0">
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1.5 p-0 sm:pl-2.5 sm:pr-1.5 sm:py-1 rounded-full sm:bg-surface-container sm:hover:bg-surface-container-high transition-colors cursor-pointer sm:border sm:border-hairline overflow-hidden"
              type="button"
              aria-expanded={userMenuOpen}
              aria-label="User profile menu"
            >
              <span className="hidden sm:inline font-code-sm text-code-sm text-ink max-w-[100px] md:max-w-[120px] truncate">
                {isPending ? '...' : userDisplayName}
              </span>
              <div className="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-amber flex items-center justify-center text-ink font-bold text-xs shadow-xs shrink-0 ring-1 ring-hairline sm:ring-0">
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={userDisplayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
            </button>

            {/* Profile Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface border border-hairline shadow-lg py-1.5 z-50">
                <div className="px-3 py-2 border-b border-hairline">
                  <p className="text-xs font-semibold text-ink truncate">{session?.user?.name || userDisplayName}</p>
                  <p className="text-[11px] text-ink-muted truncate">{session?.user?.email || 'Authenticated'}</p>
                </div>
                <Link
                  href="/"
                  className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-surface-container flex items-center gap-2"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <span className="material-symbols-outlined text-[15px]">home</span>
                  Back to Home
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-surface-container flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">logout</span>
                  Sign Out
                </button>
                <div className="my-1 border-t border-hairline"></div>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-error hover:bg-error-container/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                  Delete Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Sub-bar */}
      <div className="md:hidden w-full border-t border-hairline bg-surface/95 backdrop-blur-md px-3 py-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]">
        <nav className="flex items-center gap-1.5 min-w-max mx-auto justify-start">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 rounded-full font-body-sm text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                link.isActive
                  ? 'bg-amber text-ink font-semibold shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-container bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{link.icon}</span>
              <span>{link.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* In-app custom account deletion confirmation modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface p-space-md shadow-card flex flex-col gap-space-sm">
            <div className="flex items-center gap-2 text-error font-medium">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span className="font-body-sm font-semibold">Delete Account?</span>
            </div>
            <p className="font-body-sm text-xs text-ink-muted leading-relaxed">
              Are you sure you want to delete your account? All saved solutions, history, and notebook entries will be permanently erased.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingAccount}
                className="px-3 py-1.5 rounded-lg border border-hairline bg-surface font-body-sm text-xs font-medium text-ink hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                className="px-3.5 py-1.5 rounded-lg bg-error font-body-sm text-xs font-semibold text-white shadow-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingAccount && (
                  <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                )}
                <span>{isDeletingAccount ? 'Deleting...' : 'Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
