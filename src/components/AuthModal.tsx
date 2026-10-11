import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../data/initialData';

interface AuthModalProps {
  initialMode?: 'login' | 'signup';
  onBackToLanding?: () => void;
  onModeChange?: (mode: 'login' | 'signup') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ initialMode = 'login', onBackToLanding, onModeChange }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const { login, signup, promptConfig } = useAuth();

  // Keep internal mode in sync if initialMode prop changes from route
  React.useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const switchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    setError(null);
    if (onModeChange) {
      onModeChange(newMode);
    }
  };

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign up form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupWhatsApp, setSignupWhatsApp] = useState('');
  const [signupTelegram, setSignupTelegram] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupReferral, setSignupReferral] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Feedback state
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent, force = false) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(loginEmail, loginPassword, force);
      if (!res.success) {
        setError(res.error || 'Failed to login');
        setIsLocked(Boolean(res.isDeviceLocked));
      } else {
        setIsLocked(false);
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signup({
        name: signupName,
        email: signupEmail,
        whatsapp: signupWhatsApp,
        telegram: signupTelegram,
        password: signupPassword,
        referralCode: signupReferral,
      });
      if (!res.success) {
        setError(res.error || 'Failed to create account');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#08090b] text-white flex flex-col items-center justify-center p-4 relative select-none">
      {/* Back button */}
      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md flex flex-col items-center text-center my-auto pt-10 pb-12"
      >
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display mb-2">
          {mode === 'login' ? 'Sign in to Flow' : 'Create an Account'}
        </h1>
        {/* Subtitle */}
        <p className="text-sm sm:text-base text-neutral-400 mb-8">
          {mode === 'login'
            ? 'Where the next wave of storytelling happens'
            : 'Join FlowMaker and create stories with AI'}
        </p>

        {/* Main Card */}
        <div className="w-full bg-[#121318] border border-neutral-800/80 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          {/* Segmented Switch */}
          <div className="w-full bg-[#0b0c0f] p-1 rounded-xl flex items-center mb-6 border border-neutral-800/60">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#1e1f26] text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Login
            </button>
            <button
              id="auth-tab-signup"
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#1e1f26] text-white shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mb-5 p-3 rounded-lg bg-red-950/70 border border-red-800/60 text-red-300 text-xs text-left flex flex-col gap-2"
              >
                <div>{error}</div>
                {isLocked && mode === 'login' && (
                  <div className="pt-2 border-t border-red-800/60">
                    <button
                      type="button"
                      onClick={(e) => handleLoginSubmit(e, true)}
                      disabled={loading}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        '⚡ Purane Device Se Logout Karein & Yaha Login Karein (Force Login)'
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 pr-10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-[#7928ca] hover:bg-[#6b21b8] active:bg-[#5b19a1] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-purple-900/30 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-xs text-neutral-400">
                  New to Flow?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="text-purple-400 hover:underline font-medium cursor-pointer"
                  >
                    Sign up for free (100 credits)
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            promptConfig?.signupEnabled === false ? (
              <div className="py-8 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <div className="py-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl">
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight px-4">Signups Currently Closed</h3>
                  </div>
                  
                  <div className="px-5 py-2">
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      To register now, please contact a <span className="text-blue-400 font-bold underline underline-offset-4 cursor-pointer">Reseller</span> for Ultra access.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => switchMode('login')}
                    className="w-full py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-lg active:scale-95 border border-neutral-700"
                  >
                    Back to login
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignupSubmit} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>

                {/* WhatsApp and Telegram side-by-side matching screenshot 3 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      WhatsApp
                    </label>
                    <input
                      id="signup-whatsapp"
                      type="tel"
                      value={signupWhatsApp}
                      onChange={e => setSignupWhatsApp(e.target.value)}
                      placeholder="+1234..."
                      className="w-full px-3 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Telegram
                    </label>
                    <input
                      id="signup-telegram"
                      type="text"
                      value={signupTelegram}
                      onChange={e => setSignupTelegram(e.target.value)}
                      placeholder="@user"
                      className="w-full px-3 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 pr-10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Referral code <span className="text-neutral-500">(optional)</span>
                  </label>
                  <input
                    id="signup-referral"
                    type="text"
                    value={signupReferral}
                    onChange={e => setSignupReferral(e.target.value)}
                    placeholder="Enter referral code"
                    className="w-full px-3.5 py-2.5 bg-[#0b0c0f] border border-neutral-800 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                  />
                </div>

                {/* Free Plan Note */}
                <div className="p-2.5 rounded-lg bg-purple-950/30 border border-purple-900/40 text-purple-300 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>New accounts automatically get <strong>Basic Plan</strong> with <strong>100 Free Credits</strong>!</span>
                </div>

                <button
                  id="signup-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-[#7928ca] hover:bg-[#6b21b8] active:bg-[#5b19a1] text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-purple-900/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Create Account'
                  )}
                </button>

                <div className="pt-1 text-center">
                  <p className="text-xs text-neutral-400">
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-purple-400 hover:underline font-medium cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            )
          )}
        </div>
      </motion.div>

      {/* Floating Telegram Support Icon for Sign Up page exclusively (Nichhe Right Side me - Pure Telegram Logo) */}
      <AnimatePresence>
        {mode === 'signup' && promptConfig?.signupTelegramEnabled !== false && (
          <motion.div
            key="signup-telegram-floating"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 right-6 z-50 flex items-center"
          >
            <a
              href={(() => {
                const raw = promptConfig?.signupTelegramUrl?.trim() || 'https://t.me/google_ultra_veo3_bot';
                if (!raw) return 'https://t.me/google_ultra_veo3_bot';
                if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
                if (raw.startsWith('@')) return `https://t.me/${raw.replace(/^@/, '')}`;
                if (raw.startsWith('t.me/')) return `https://${raw}`;
                return `https://t.me/${raw}`;
              })()}
              target="_blank"
              rel="noopener noreferrer"
              id="signup-floating-telegram-btn"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-2xl shadow-sky-500/50 hover:shadow-sky-500/80 hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center focus:outline-none"
              title="Telegram"
              aria-label="Telegram"
            >
              <svg className="w-full h-full drop-shadow-md select-none pointer-events-none" viewBox="0 0 240 240" fill="none">
                <defs>
                  <linearGradient id="tg-grad-fab" x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2AABEE"/>
                    <stop offset="1" stopColor="#229ED9"/>
                  </linearGradient>
                </defs>
                <circle cx="120" cy="120" r="120" fill="url(#tg-grad-fab)"/>
                <path d="M98 175c-3.887 0-3.227-1.468-4.568-5.17L82 132.206 172 75.8" fill="#c8daea"/>
                <path d="M98 175c3 0 4.333-1.374 6-3l26-25.263-32.417-19.531" fill="#a9c9dd"/>
                <path d="M97.583 127.206l57.777 42.688c5.523 3.045 9.516 1.469 10.892-5.125l23.5-110.744c2.016-8.086-3.08-11.746-8.36-9.348L42.5 102.32c-7.89 3.165-7.844 7.568-1.442 9.534l35.632 11.12 82.52-52.06c3.896-2.364 7.466-1.094 4.536 1.503" fill="#ffffff"/>
              </svg>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
