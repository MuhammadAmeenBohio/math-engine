'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
  ArrowLeft,
  CheckCircle,
  Mail,
  Cpu,
  ShieldCheck,
  CheckSquare,
  ArrowRight,
  Loader2,
  KeyRound,
} from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();

  // Mode: 'signin' | 'otp'
  const [mode, setMode] = useState<'signin' | 'otp'>('signin');
  const [email, setEmail] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);

  // Loading & Feedback states (separated to prevent cross-button spinner triggering)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Google OAuth Login
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMsg(null);
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/solve/capture',
      });
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Failed to initiate Google authentication. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  // Cooldown timer trigger
  const startCooldown = () => {
    setCooldown(45);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Email OTP Request
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    try {
      setIsOtpLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await authClient.emailOtp.sendVerificationOtp({
        email: cleanEmail,
        type: 'sign-in',
      });

      if (res.error) {
        setErrorMsg(res.error.message || 'Failed to send verification code.');
        setIsOtpLoading(false);
        return;
      }

      setSuccessMsg(`Verification code sent to ${cleanEmail}`);
      setMode('otp');
      startCooldown();
      setIsOtpLoading(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('An unexpected error occurred while sending the code.');
      setIsOtpLoading(false);
    }
  };

  // Verify 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpCode.join('');
    if (code.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit code.');
      return;
    }

    try {
      setIsOtpLoading(true);
      setErrorMsg(null);

      const res = await authClient.signIn.emailOtp({
        email: email.trim().toLowerCase(),
        otp: code,
      });

      if (res.error) {
        setErrorMsg(res.error.message || 'Invalid or expired verification code.');
        setIsOtpLoading(false);
        return;
      }

      router.push('/solve/capture');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Verification failed. Please check the code and try again.');
      setIsOtpLoading(false);
    }
  };

  // OTP Input keydown auto-advance
  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otpCode];
    newOtp[index] = val.slice(-1);
    setOtpCode(newOtp);

    // Auto advance
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-box-${index + 1}`);
      nextInput?.focus();
    }
  };

  // OTP Input paste support for entire 6-digit code
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpCode(digits);
      const lastInput = document.getElementById('otp-box-5');
      lastInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-box-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className="bg-[#F3F7F5] text-[#0F2E22] min-h-screen flex flex-col justify-between antialiased selection:bg-[#1A8F6B]/30">
      {/* Top Header */}
      <header className="w-full bg-[#F3F7F5]/95 backdrop-blur-md border-b border-[#0F2E22]/10 sticky top-0 z-50">
        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs border border-[#0F2E22]/10">
              <svg className="w-5 h-5 text-[#0F2E22]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4.5 4.5" />
                <path d="m7 12 2-3 2.5 4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="13.5" cy="9.5" fill="#1A8F6B" r="1.5" stroke="none" />
              </svg>
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-[#0F2E22]">
              Math <span className="text-[#1A8F6B]">Engine</span>
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-1.5 rounded-full bg-white hover:bg-[#EAF4F0] active:scale-[0.98] text-[#0F2E22]/80 hover:text-[#0F2E22] text-xs sm:text-sm font-medium border border-[#0F2E22]/10 shadow-xs transition-all shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Back to home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1 flex items-center justify-center px-4 sm:px-6 py-8 md:py-12">
        <div className="w-full max-w-7xl mx-auto">

          {/* 2-Column Academic Workstation Frame */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-stretch">
            {/* COLUMN 1 (On mobile: Appears FIRST via order-1 | On desktop: Left side via lg:order-1) */}
            <div className="order-1 lg:order-1 lg:col-span-6 flex flex-col h-full">
              <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-[#0F2E22]/10 flex flex-col justify-between h-full relative overflow-hidden">

                {/* Central Visual Composition: Golden Ratio Compass */}
                <div className="my-2 sm:my-6 flex flex-col items-center justify-center relative w-full">
                  <div className="relative w-full max-w-[480px] aspect-[340/190] flex items-center justify-center">
                    <svg className="w-full h-full text-[#0F2E22] overflow-visible" fill="none" viewBox="50 15 240 160">
                      <rect height="140" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" width="200" x="70" y="25" />
                      <rect height="140" stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.12" strokeWidth="1" width="124" x="70" y="25" />
                      <rect height="76" stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.12" strokeWidth="1" width="76" x="194" y="25" />
                      <rect height="64" stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.12" strokeWidth="1" width="48" x="194" y="101" />
                      <path d="M70 165 C 70 87, 134 25, 212 25" stroke="#4C8068" strokeLinecap="round" strokeWidth="1.75" />
                      <path d="M212 25 C 246 25, 270 51, 270 85" stroke="#1A8F6B" strokeLinecap="round" strokeWidth="1.75" />
                      <path d="M270 85 C 270 110, 250 128, 226 128" stroke="#0F2E22" strokeLinecap="round" strokeWidth="1.5" />
                      <path d="M226 128 C 210 128, 198 116, 198 102" stroke="#4C8068" strokeLinecap="round" strokeWidth="1.25" />
                      <circle cx="170" cy="95" r="54" stroke="#0F2E22" strokeOpacity="0.25" strokeWidth="1" />
                      <circle cx="170" cy="95" fill="#1A8F6B" r="4" />
                      <line stroke="#0F2E22" strokeOpacity="0.2" strokeWidth="0.75" x1="106" x2="234" y1="95" y2="95" />
                      <line stroke="#0F2E22" strokeOpacity="0.2" strokeWidth="0.75" x1="170" x2="170" y1="31" y2="159" />
                      <text fill="#0F2E22" fillOpacity="0.5" fontFamily="monospace" fontSize="9" x="76" y="40">φ = 1.618</text>
                      <text fill="#0F2E22" fillOpacity="0.5" fontFamily="monospace" fontSize="9" x="216" y="152">∇ × B = 0</text>
                    </svg>
                  </div>

                  {/* Transformation Card: Handwritten -> LaTeX Engine (Hidden on mobile) */}
                  <div className="hidden lg:flex w-full bg-[#F3F7F5] rounded-xl p-4 border border-[#0F2E22]/10 shadow-sm mt-2 flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex-1 w-full bg-white rounded-lg p-3 border border-[#0F2E22]/10">
                      <span className="text-[11px] font-medium text-[#0F2E22]/60 block mb-1">OCR Handwrite Track</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[#0F2E22]/60 text-sm">✎</span>
                        <span className="text-base text-[#0F2E22] italic font-serif select-none">
                          x² − 5x + 6 = 0
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center px-2 py-1">
                      <ArrowRight className="w-5 h-5 text-[#1A8F6B]" />
                      <span className="font-mono text-[10px] text-[#0F2E22]/60">1.4ms</span>
                    </div>

                    <div className="flex-1 w-full bg-white rounded-lg p-3 border border-[#0F2E22]/10 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium text-[#0F2E22]/60">Rigorous CAS Output</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#4C8068]/20 text-[#0F2E22] text-[10px] font-semibold">
                          <CheckCircle className="w-3 h-3 text-[#4C8068]" />
                          Validated
                        </span>
                      </div>
                      <div className="font-mono text-sm text-[#0F2E22] font-bold">
                        x ∈ &#123; 2 , 3 &#125;
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feature Triad Badges (Hidden on mobile) */}
                <div className="hidden lg:grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 bg-[#F3F7F5]/50 rounded-xl p-3 border border-[#0F2E22]/5">
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-[#0F2E22]/5 shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-[#F3F7F5] flex items-center justify-center shrink-0 text-[#0F2E22]">
                      <Cpu className="w-4 h-4 text-[#0B3D2E]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold leading-tight block text-[#0F2E22]">Local CAS</span>
                      <span className="text-[10px] text-[#0F2E22]/60 block mt-0.5">Deterministic AST</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-[#0F2E22]/5 shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-[#F3F7F5] flex items-center justify-center shrink-0 text-[#0F2E22]">
                      <ShieldCheck className="w-4 h-4 text-[#4C8068]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold leading-tight block text-[#0F2E22]">Local History</span>
                      <span className="text-[10px] text-[#0F2E22]/60 block mt-0.5">Stored on this device</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-[#0F2E22]/5 shadow-sm">
                    <div className="w-7 h-7 rounded-full bg-[#F3F7F5] flex items-center justify-center shrink-0 text-[#0F2E22]">
                      <CheckSquare className="w-4 h-4 text-[#1A8F6B]" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold leading-tight block text-[#0F2E22]">Step-by-Step</span>
                      <span className="text-[10px] text-[#0F2E22]/60 block mt-0.5">Verified Steps</span>
                    </div>
                  </div>
                </div>
              </div>


            </div>

            {/* COLUMN 2: Unified Auth Card (On mobile: Appears below Column 1 via order-2 | On desktop: Right side via lg:order-2) */}
            <div className="order-2 lg:order-2 lg:col-span-6 flex flex-col h-full">
              <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-[#0F2E22]/10 relative flex flex-col justify-between h-full">
                {/* Dynamic Header Description */}
                <div className="mb-5 sm:mb-6">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0F2E22] tracking-tight">
                    {mode === 'otp' ? 'Enter Verification Code' : 'Access Mathematical Workspace'}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#0F2E22]/70 mt-1">
                    {mode === 'otp'
                      ? `We sent a 6-digit cryptographic code to ${email}.`
                      : 'Authenticate to keep your derivation notebook, or proceed locally as a guest.'}
                  </p>
                </div>

                {/* Quick Google OAuth Button */}
                {mode !== 'otp' && (
                  <div className="flex flex-col gap-3 mb-6">
                    <button
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading || isOtpLoading}
                      className="w-full h-12 px-4 rounded-full bg-[#EAF4F0] hover:bg-[#DCEEE5] active:scale-[0.99] transition-all flex items-center justify-center gap-3 text-[#0F2E22] text-sm font-medium border border-[#0F2E22]/5 disabled:opacity-50"
                      type="button"
                    >
                      {isGoogleLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-[#1A8F6B]" />
                      ) : (
                        <>
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              fill="#EA4335"
                            />
                          </svg>
                          <span>Continue with Google</span>
                        </>
                      )}
                    </button>

                    {/* Subtle Divider */}
                    <div className="relative flex items-center justify-center my-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#0F2E22]/10"></div>
                      </div>
                      <span className="relative px-3 bg-white text-[#0F2E22]/60 text-[11px] tracking-wider uppercase font-medium">
                        or continue with email
                      </span>
                    </div>
                  </div>
                )}

                {/* Error & Success Messages */}
                {errorMsg && (
                  <div className="mb-4 p-3 rounded-lg bg-[#FFDAD6] border border-[#B5472F]/20 text-[#B5472F] text-xs font-medium">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="mb-4 p-3 rounded-lg bg-[#4C8068]/20 border border-[#4C8068]/30 text-[#0F2E22] text-xs font-medium">
                    {successMsg}
                  </div>
                )}

                {/* VIEW 1: SIGN IN (Fast OTP) */}
                {mode === 'signin' && (
                  <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F2E22] mb-1.5" htmlFor="signin-email">
                        Email Address
                      </label>
                      <div className="relative flex items-center">
                        <Mail className="absolute left-3.5 text-[#0F2E22]/40 w-4 h-4" />
                        <input
                          id="signin-email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          type="email"
                          className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#EAF4F0] text-[#0F2E22] text-sm placeholder:text-[#0F2E22]/40 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1A8F6B] transition-all border border-transparent focus:border-[#1A8F6B]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <input
                        id="remember-device"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        type="checkbox"
                        className="w-4 h-4 rounded text-[#4C8068] accent-[#4C8068] cursor-pointer"
                      />
                      <label className="text-xs text-[#0F2E22] cursor-pointer select-none" htmlFor="remember-device">
                        Remember this workstation for 30 days
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isOtpLoading || isGoogleLoading}
                      className="w-full h-12 rounded-full bg-[#1A8F6B] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-[#0F2E22] text-sm font-semibold mt-2 shadow-sm disabled:opacity-50"
                    >
                      {isOtpLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span>Send 6-Digit OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* VIEW 2: OTP VERIFICATION CODE */}
                {mode === 'otp' && (
                  <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F2E22] mb-2 text-center">
                        Enter 6-digit code
                      </label>
                      <div className="flex items-center justify-between gap-1.5 sm:gap-3 max-w-[340px] mx-auto">
                        {otpCode.map((digit, index) => (
                          <input
                            key={index}
                            id={`otp-box-${index}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={handleOtpPaste}
                            className="w-10 h-12 sm:w-12 sm:h-14 text-center font-mono text-lg sm:text-2xl font-bold bg-[#EAF4F0] border border-[#0F2E22]/15 rounded-xl focus:bg-white focus:border-[#1A8F6B] focus:ring-2 focus:ring-[#1A8F6B] focus:outline-none transition-all text-[#0F2E22]"
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isOtpLoading || isGoogleLoading}
                      className="w-full h-12 rounded-full bg-[#1A8F6B] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-[#0F2E22] text-sm font-semibold shadow-sm disabled:opacity-50"
                    >
                      {isOtpLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Verify & Access Workspace</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('signin');
                          setErrorMsg(null);
                        }}
                        className="text-[#0F2E22]/60 hover:text-[#0F2E22] underline"
                      >
                        Wrong email?
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        disabled={isOtpLoading || cooldown > 0}
                        className="text-[#0B3D2E] font-medium hover:underline disabled:opacity-50 disabled:no-underline"
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Card Base: Guest Sandbox Mode & Telemetry Guarantee */}
                <div className="mt-3 pt-4 border-t border-[#0F2E22]/5 flex flex-col gap-3">
                  <Link
                    href="/solve/capture"
                    className="w-full p-4 rounded-full bg-[#DCEEE5] hover:bg-[#CFE6DA] transition-colors flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[#0F2E22] text-center"
                  >
                    <span className="text-xs font-semibold">Continue as Guest (Local Sandbox Mode)</span>
                  </Link>

                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 bg-[#F3F7F5] border-t border-[#0F2E22]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-[#0F2E22]/50 text-xs font-medium">
          Math Engine | Local history | AI-assisted OCR
        </div>
      </footer>
    </div>
  );
}
