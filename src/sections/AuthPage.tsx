'use client';
/**
 * Auth flow contract — pinned by audit fix R-2 (A-01).
 *
 *   | Role    | Sign-up                         | Login                            |
 *   |---------|---------------------------------|----------------------------------|
 *   | student | password + email OTP verify     | password (Google sign-in opt.)   |
 *   | teacher | password + email OTP verify     | password (Google sign-in opt.)   |
 *   | admin   | seed-only (no public sign-up)   | email OTP — no password path     |
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock, RefreshCw, User } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { getRegistrationStatusAction } from '@/server/actions/system-actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const OriMascot = dynamic(() => import('@/features/mascot/Ori2D'), { ssr: false });

interface AuthPageProps {
  userRole: 'student' | 'teacher' | 'admin' | null;
  onLogin: (email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => void;
  onLoginWithOtp?: (email: string, role?: 'student' | 'teacher' | 'admin' | null) => void;
  onRegister: (name: string, email: string, password: string, role?: 'student' | 'teacher' | 'admin' | null) => void;
  onGoogleLogin?: (credential: string, role?: 'student' | 'teacher' | 'admin' | null) => void;
  sendOtp?: (email: string, role?: 'student' | 'teacher' | 'admin' | null) => Promise<{ ok: boolean; message: string }>;
  verifyOtp?: (email: string, otp: string) => Promise<{ ok: boolean; message: string }>;
  onBack: () => void;
  isLoading: boolean;
  error?: string | null;
}

/* ── dark-card design tokens ─────────────────────────────────────── */
const D = {
  card:    '#171717',
  field:   '#171717',
  btn:     '#252525',
  btnHov:  '#000000',
  text:    '#ffffff',
  muted:   '#a0a0a0',
  border:  '#2e2e2e',
  inset:   'inset 2px 5px 10px rgb(5,5,5)',
  raised:  '6px 6px 12px #0a0a0a, -6px -6px 12px #242424',
  pressed: 'inset 4px 4px 12px #0a0a0a, inset -4px -4px 12px #242424',
} as const;

function FieldRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[25px] px-4"
      style={{ background: D.field, boxShadow: D.inset, paddingTop: '0.65em', paddingBottom: '0.65em' }}
    >
      <span className="shrink-0 text-[#888]">{icon}</span>
      {children}
    </div>
  );
}

const fieldInputCls = 'flex-1 bg-transparent border-none outline-none text-[#d3d3d3] text-sm font-medium placeholder:text-[#555] w-full';

function DarkBtn({
  type = 'button',
  onClick,
  disabled,
  children,
  accent,
  className,
}: {
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn('rounded-[5px] font-semibold text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed', className)}
      style={{
        background: accent ? 'hsl(var(--primary))' : D.btn,
        color: D.text,
        border: 'none',
        outline: 'none',
        boxShadow: D.raised,
        padding: '0.6em 1.7em',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = accent ? 'hsl(var(--primary)/0.85)' : D.btnHov; }}
      onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = accent ? 'hsl(var(--primary))' : D.btn; }}
      onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = D.pressed; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = D.raised; }}
    >
      {children}
    </button>
  );
}

export default function AuthPage({
  userRole,
  onLogin,
  onLoginWithOtp,
  onRegister,
  onGoogleLogin,
  onBack,
  isLoading,
  error,
  sendOtp,
  verifyOtp,
}: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [regStatus, setRegStatus] = useState<{ count: number; limit: number; seatsLeft: number } | null>(null);

  useEffect(() => {
    if (userRole === 'admin') setIsLogin(true);
  }, [userRole]);

  useEffect(() => {
    getRegistrationStatusAction(userRole ?? null).then(setRegStatus);
  }, [userRole]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const handleGoogleAuth = useGoogleLogin({
    onSuccess: (res) => { if (onGoogleLogin && res.access_token) onGoogleLogin(res.access_token, userRole); },
    onError: (e) => console.error('Google Login Failed:', e),
  });

  const handleSendOtp = async () => {
    if (!email || !sendOtp) return;
    const res = await sendOtp(email, userRole);
    if (res.ok) { setStep('otp'); setResendCooldown(60); }
  };

  const handleVerifyAndRegister = async () => {
    if (!otp || otp.length < 6) { toast.error('Please enter the full 6-digit code.'); return; }
    setIsVerifying(true);
    if (verifyOtp) {
      const res = await verifyOtp(email, otp);
      if (res.ok) {
        if (userRole === 'admin' && onLoginWithOtp) onLoginWithOtp(email, userRole);
        else onRegister(name, email, password, userRole);
      }
    }
    setIsVerifying(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      if (userRole === 'admin') step === 'form' ? handleSendOtp() : handleVerifyAndRegister();
      else onLogin(email, password, userRole);
    } else {
      step === 'form' ? handleSendOtp() : handleVerifyAndRegister();
    }
  };

  const headingText =
    userRole === 'teacher' ? 'Teacher Login'
    : userRole === 'admin'   ? 'Admin Portal'
    : isLogin                ? 'Welcome Back'
    : 'Create Account';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0f0f0f' }}
    >
      {/* subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 40% at 80% 20%, hsl(var(--primary)/0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 20% 80%, hsl(var(--primary)/0.06) 0%, transparent 70%)',
      }} />

      <AnimatePresence mode="wait">
        <motion.div
          key="auth-card"
          initial={{ opacity: 0, scale: 0.88, filter: 'blur(12px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Back */}
          <button
            onClick={onBack}
            className="mb-5 flex items-center gap-1.5 text-sm transition-colors duration-200"
            style={{ color: D.muted }}
            onMouseEnter={e => (e.currentTarget.style.color = D.text)}
            onMouseLeave={e => (e.currentTarget.style.color = D.muted)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </button>

          {/* Card */}
          <div
            className="group"
            style={{
              background: D.card,
              borderRadius: '25px',
              padding: '2em',
              paddingBottom: '1.5em',
              border: '1px solid transparent',
              boxShadow: '8px 8px 20px #0a0a0a, -8px -8px 20px #222',
              transition: 'transform 0.4s ease-in-out, border-color 0.4s ease-in-out',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.015)';
              (e.currentTarget as HTMLElement).style.borderColor = D.border;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
            }}
          >
            {/* Mascot / logo */}
            <div className="flex justify-center mb-3">
              {userRole === 'teacher' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/Origin-Teacher-Logo.png" alt="ORIGIN" className="h-14 w-auto rounded-2xl" />
              ) : (
                <div className="h-20 w-20">
                  <OriMascot expression={isLogin ? 'winking' : 'cheerful'} title="Origin AI" />
                </div>
              )}
            </div>

            {/* Heading */}
            <h2
              id="auth-heading"
              className="text-center text-xl font-black tracking-tight mb-1"
              style={{ color: D.text }}
            >
              {headingText}
            </h2>
            <p className="text-center text-xs mb-5" style={{ color: D.muted }}>
              {userRole === 'teacher' ? 'Access your dashboard and manage classes'
               : userRole === 'admin' ? 'System administration and platform management'
               : 'Your AI-powered JEE preparation companion'}
            </p>

            {/* Login / Sign Up toggle */}
            {userRole !== 'admin' && (
              <div
                className="flex p-1 mb-5 rounded-[14px]"
                style={{ background: '#111', boxShadow: D.inset }}
              >
                {(['Login', 'Sign Up'] as const).map((label) => {
                  const active = label === 'Login' ? isLogin : !isLogin;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { setIsLogin(label === 'Login'); setStep('form'); setOtp(''); }}
                      className="flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-[10px] transition-all duration-300"
                      style={{
                        background: active ? D.btn : 'transparent',
                        color: active ? D.text : D.muted,
                        boxShadow: active ? D.raised : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl text-center text-xs font-bold" style={{ background: '#2a1010', color: '#ff6b6b', border: '1px solid #3a1515' }}>
                {error}
              </div>
            )}

            {/* Seats banner */}
            {regStatus && (!isLogin || regStatus.seatsLeft <= 0) && (
              <div
                className="mb-4 p-3 rounded-2xl text-center text-xs font-bold"
                style={{
                  background: regStatus.seatsLeft > 0 ? '#0f1a1f' : '#1a1500',
                  color: regStatus.seatsLeft > 0 ? 'hsl(var(--primary))' : '#f59e0b',
                  border: `1px solid ${regStatus.seatsLeft > 0 ? 'hsl(var(--primary)/0.3)' : '#78350f'}`,
                }}
              >
                {regStatus.seatsLeft > 0
                  ? `🔥 Hurry! Only ${regStatus.seatsLeft} seats left`
                  : 'Beta registrations closed. Stay tuned for the next batch!'}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">

              {/* OTP step */}
              {step === 'otp' ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5 py-2"
                >
                  <div className="text-center space-y-2">
                    <div
                      className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3"
                      style={{ background: '#1a1a2e', boxShadow: D.inset }}
                    >
                      <Mail className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
                    </div>
                    <p className="text-sm font-bold" style={{ color: D.text }}>Check your email</p>
                    <p className="text-xs" style={{ color: D.muted }}>
                      Code sent to <span style={{ color: D.text, fontWeight: 700 }}>{email}</span>
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="group">
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="flex justify-center items-center gap-2 text-xs" style={{ color: D.muted }}>
                    <span>Didn't get it?</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0}
                      onClick={handleSendOtp}
                      className="font-bold disabled:opacity-40 flex items-center gap-1"
                      style={{ color: 'hsl(var(--primary))' }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : <><RefreshCw className="w-3 h-3" />Resend</>}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setStep('form'); setOtp(''); }}
                    className="w-full text-center text-xs flex items-center justify-center gap-1 transition-colors"
                    style={{ color: D.muted }}
                  >
                    <ArrowLeft className="w-3 h-3" />Change email
                  </button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {/* Name (sign-up only) */}
                  {!isLogin && (
                    <FieldRow icon={<User className="w-4 h-4" />}>
                      <input
                        type="text"
                        placeholder="Full name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className={fieldInputCls}
                        required
                      />
                    </FieldRow>
                  )}

                  {/* Email */}
                  <FieldRow icon={<Mail className="w-4 h-4" />}>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={fieldInputCls}
                      required
                    />
                  </FieldRow>

                  {/* Password */}
                  {userRole !== 'admin' && (
                    <FieldRow icon={<Lock className="w-4 h-4" />}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isLogin ? 'Password' : 'Create a password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className={fieldInputCls}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="shrink-0 transition-colors"
                        style={{ color: '#666' }}
                        onMouseEnter={e => (e.currentTarget.style.color = D.text)}
                        onMouseLeave={e => (e.currentTarget.style.color = '#666')}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </FieldRow>
                  )}

                  {/* Forgot password */}
                  {isLogin && userRole !== 'admin' && (
                    <div className="flex justify-end">
                      <button type="button" className="text-xs font-bold" style={{ color: 'hsl(var(--primary))' }}>
                        Forgot password?
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Submit */}
              <div className="flex justify-center mt-6">
                <DarkBtn
                  type="submit"
                  disabled={isLoading || isVerifying || (!isLogin && regStatus?.seatsLeft === 0)}
                  accent
                  className="w-full h-11 flex items-center justify-center gap-2 text-sm font-bold"
                >
                  {isLoading || isVerifying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{step === 'otp' ? 'Verifying…' : isLogin ? 'Logging in…' : 'Sending code…'}</>
                  ) : userRole === 'admin' ? (
                    step === 'form' ? 'Send OTP' : 'Verify & Login'
                  ) : isLogin ? 'Login' : (
                    step === 'form' ? 'Create Account' : 'Verify & Complete'
                  )}
                </DarkBtn>
              </div>
            </form>

            {/* OAuth */}
            {userRole !== 'admin' && (
              <div className="mt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px" style={{ background: D.border }} />
                  <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: D.muted }}>or</span>
                  <div className="flex-1 h-px" style={{ background: D.border }} />
                </div>

                <div className="flex flex-col gap-2.5">
                  {/* Google */}
                  <button
                    type="button"
                    onClick={() => handleGoogleAuth()}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-3 w-full h-11 rounded-[10px] text-sm font-semibold transition-all duration-300 disabled:opacity-50"
                    style={{ background: D.btn, color: D.text, border: 'none', outline: 'none', boxShadow: D.raised }}
                    onMouseEnter={e => (e.currentTarget.style.background = D.btnHov)}
                    onMouseLeave={e => (e.currentTarget.style.background = D.btn)}
                    onMouseDown={e => (e.currentTarget.style.boxShadow = D.pressed)}
                    onMouseUp={e => (e.currentTarget.style.boxShadow = D.raised)}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#FBBC05" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>
              </div>
            )}

            {/* Legal */}
            <p className="mt-5 text-center text-[10px] leading-relaxed" style={{ color: '#444' }}>
              By continuing you agree to our{' '}
              <a href="/terms-and-conditions" className="underline hover:text-[#888] transition-colors">Terms</a>,{' '}
              <a href="/privacy-policy" className="underline hover:text-[#888] transition-colors">Privacy Policy</a> &amp;{' '}
              <a href="/childrens-policy" className="underline hover:text-[#888] transition-colors">Children's Policy</a>.
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
