import { useState, useEffect, useCallback } from 'react';
import { Loader2, Eye, EyeOff, Leaf, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      navigate('/redirect', { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleNetworkCheck = async () => {
    setIsCheckingNetwork(true);
    try {
      const restUrl = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let restReachable = false;
      try {
        const r = await fetch(restUrl, { method: 'HEAD', headers: { apikey: apiKey } });
        restReachable = r.ok || r.status === 400;
      } catch { restReachable = false; }

      if (!restReachable) {
        toast.error('Connection blocked. Try switching to mobile hotspot or change DNS to 8.8.8.8', { duration: 6000 });
      } else {
        toast.success('Connection is working! Try signing in again.');
        setHasNetworkError(false);
      }
    } catch {
      toast.error('Network check failed. Your ISP may be blocking the connection.');
    } finally {
      setIsCheckingNetwork(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    setHasNetworkError(false);

    const enteredIdentifier = email.trim().toLowerCase();
    let loginEmail = enteredIdentifier;

    // Allow login by employee ID or username
    if (!EMAIL_REGEX.test(enteredIdentifier)) {
      const { data: matchedProfile } = await (supabase.from('profiles') as any)
        .select('email, login_enabled')
        .or(`username.eq.${enteredIdentifier},office_number.eq.${enteredIdentifier}`)
        .maybeSingle();

      if (!matchedProfile?.email) {
        toast.error('Use your registered email or employee ID');
        setIsLoading(false);
        return;
      }
      if (matchedProfile.login_enabled === false) {
        toast.error('Your login is disabled. Please contact HR.');
        setIsLoading(false);
        return;
      }
      loginEmail = String(matchedProfile.email).toLowerCase();
    }

    // Auth with retry
    let authData = null;
    let authError = null;
    for (let i = 0; i <= 2; i++) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      authData = data; authError = error;
      if (!error || !error.message.toLowerCase().includes('fetch')) break;
      if (i < 2) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }

    if (authError) {
      const msg = (authError.message || '').toLowerCase();
      if (msg.includes('invalid login credentials')) {
        toast.error('Invalid email or password');
      } else if (msg.includes('fetch') || msg.includes('network')) {
        toast.error('Network error. Connection to server is unavailable.');
        setHasNetworkError(true);
      } else {
        toast.error(authError.message);
      }
      setIsLoading(false);
      return;
    }

    // Background: audit log
    if (authData?.user) {
      const userId = authData.user.id;
      (async () => {
        try {
          const { data: profile } = await supabase.from('profiles').select('name,role').eq('id', userId).maybeSingle();
          await supabase.from('audit_logs').insert({
            action: 'USER_LOGIN',
            performed_by: userId,
            performed_by_name: (profile as any)?.name || 'Unknown',
            performed_by_role: (profile as any)?.role || 'employee',
            record_type: 'auth', record_id: userId,
            after_state: { login_time: new Date().toISOString() },
            remarks: 'User logged in',
          });
        } catch { /* non-critical */ }
      })();
    }

    toast.success('Welcome back!');
    navigate('/redirect', { replace: true });
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Left panel (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f1f2e] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background circles */}
        <div className="absolute top-[-80px] left-[-80px] w-96 h-96 rounded-full bg-green-500/5" />
        <div className="absolute bottom-[-60px] right-[-60px] w-72 h-72 rounded-full bg-green-500/8" />

        <div className="relative z-10 text-center max-w-sm">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-green-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-900/50">
            <Leaf className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Farmers Factory</h1>
          <p className="text-green-400 text-sm font-semibold tracking-widest uppercase mb-8">ERP v2.0</p>

          <div className="border-t border-[#1e3a5f] pt-8 space-y-4">
            {[
              { label: 'Purchase', desc: 'Vendor & procurement management' },
              { label: 'Warehouse', desc: 'Inventory, QC & stock control' },
              { label: 'Sales', desc: 'Orders, customers & collections' },
              { label: 'Logistics', desc: 'Trips, drivers & delivery' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3 text-left">
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-white">{m.label}</p>
                  <p className="text-[11px] text-[#4a6fa5]">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="absolute bottom-6 text-[11px] text-[#2a4a6a] tracking-widest uppercase">
          Farmers Factory © 2025
        </p>
      </div>

      {/* ── Right panel — Login form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-gray-900">Farmers Factory</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">ERP v2.0</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
            <p className="text-gray-500 text-sm mt-1">Enter your credentials to access the ERP</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700 font-medium">Email or Employee ID</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@farmersfactory.com"
                className="h-11 border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 border-gray-300 focus:border-green-500 focus:ring-green-500 bg-white pr-11"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {hasNetworkError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <WifiOff className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">Connection issue detected</p>
                </div>
                <p className="text-xs text-red-600 mb-3">Try switching to mobile hotspot or change DNS to 8.8.8.8</p>
                <Button
                  type="button" variant="outline" size="sm"
                  className="w-full h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleNetworkCheck}
                  disabled={isCheckingNetwork}
                >
                  {isCheckingNetwork ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Diagnose Connection
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold text-base mt-2 shadow-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</>
              ) : 'Sign In'}
            </Button>
          </form>

          <p className="mt-10 text-center text-[11px] text-gray-400 uppercase tracking-widest">
            Farmers Factory ERP v2.0 · Secure Access
          </p>
        </div>
      </div>
    </div>
  );
}
