import { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import NexLogo from './NexLogo';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('already registered') ||
      message.includes('already exists') ||
      message.includes('user already')
    ) {
      return 'An account already exists with this email. Please sign in instead.';
    }

    if (message.includes('invalid login credentials')) {
      return 'The email or password is incorrect.';
    }

    return error.message;
  }

  return 'Authentication failed';
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { first_name: firstName.trim() },
          },
        });
        if (signUpError) throw signUpError;

        if (data.user && data.user.identities?.length === 0) {
          throw new Error('User already registered');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
      }
      onAuthSuccess();
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0d0d0f]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0a0a0c] to-[#0d1117] items-center justify-center">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/[0.04] rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/[0.04] rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12">
          <NexLogo size={80} className="shadow-2xl shadow-cyan-500/30 mx-auto mb-8" strokeWidth={2} />
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Nex</h1>
          <p className="text-white/40 text-base leading-relaxed max-w-sm mx-auto">
            Your intelligent AI assistant. Conversations that remember, tasks that get done.
          </p>
          <div className="mt-10 flex items-center justify-center gap-6 text-white/20 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-cyan-500/40" />Memory</span>
            <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-cyan-500/40" />Tasks</span>
            <span className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-cyan-500/40" />Real-time</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <NexLogo size={36} className="shadow-lg shadow-cyan-500/20" />
            <span className="text-white font-semibold text-lg tracking-tight">Nex</span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight mb-1">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="text-white/35 text-sm mb-8">
            {isSignUp ? 'Start chatting with Nex in seconds' : 'Sign in to continue your conversations'}
          </p>

          {error && (
            <div className="mb-5 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pl-10 py-3 text-white/85 text-sm placeholder-white/20 outline-none focus:border-cyan-500/40 focus:bg-white/[0.06] transition-all duration-150"
                />
              </div>
            )}

            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pl-10 py-3 text-white/85 text-sm placeholder-white/20 outline-none focus:border-cyan-500/40 focus:bg-white/[0.06] transition-all duration-150"
              />
            </div>

            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pl-10 py-3 text-white/85 text-sm placeholder-white/20 outline-none focus:border-cyan-500/40 focus:bg-white/[0.06] transition-all duration-150"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-medium text-sm py-3 rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-white/35 text-sm hover:text-white/60 transition-colors"
            >
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <span className="text-cyan-400/80 hover:text-cyan-400 font-medium">
                {isSignUp ? 'Sign in' : 'Sign up'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
