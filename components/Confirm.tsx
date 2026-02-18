import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const Confirm: React.FC = () => {
  const [message, setMessage] = useState('Verifying your sign-in link...');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const params = new URLSearchParams(url.search);

        // PKCE flow: Supabase sends ?code=...  which must be exchanged
        const code = params.get('code');
        // Legacy / implicit flow: hash fragment with access_token
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (code) {
          // Exchange the PKCE code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setError(true);
            setMessage('Sign-in link expired or already used. Please request a new one.');
            return;
          }
          if (data.session) {
            setSuccess(true);
            setMessage('✅ Signed in successfully!');
            // Allow user to click manually or wait
            setTimeout(() => window.location.replace('/'), 2500);
            return;
          }
        } else if (accessToken && refreshToken) {
          // Set session from hash tokens (implicit flow fallback)
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            console.error('Set session error:', sessionError);
            setError(true);
            setMessage('Failed to complete sign-in. Please request a new link.');
            return;
          }
          setSuccess(true);
          setMessage('✅ Signed in successfully! Redirecting...');
          setTimeout(() => window.location.replace('/'), 1000);
          return;
        }

        // Fallback: check if Supabase already detected the session from the URL
        // (detectSessionInUrl: true in the client config may have handled it)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSuccess(true);
          setMessage('✅ Signed in successfully!');
          // Allow user to click manually or wait
          setTimeout(() => window.location.replace('/'), 2500);
          return;
        }

        // No tokens or code found
        setError(true);
        setMessage('No sign-in link detected. Please request a new confirmation link.');
      } catch (e: any) {
        console.error('Confirm error:', e);
        setError(true);
        setMessage(e.message || 'An unexpected error occurred. Please try again.');
      }
    })();
  }, []);





  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl gold-gradient shadow-lg">
          <i className={`fas ${error ? 'fa-exclamation-triangle' : success ? 'fa-check-circle' : 'fa-spinner fa-spin'} text-white text-2xl`}></i>
        </div>

        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          {error ? 'Sign-In Issue' : success ? 'Welcome!' : 'Completing Sign-In'}
        </h1>

        <p className={`text-sm leading-relaxed ${error ? 'text-red-400' : success ? 'text-green-400' : 'text-white/70'}`}>
          {message}
        </p>

        {success && (
          <div className="animate-in fade-in zoom-in slide-in-from-bottom-4 duration-500">
            <button onClick={handleContinue} className="w-full py-4 rounded-xl gold-gradient text-black font-black uppercase tracking-widest text-sm hover:scale-[1.02] transition-all shadow-lg shadow-amber-500/20">
              Continue to App <i className="fas fa-arrow-right ml-2"></i>
            </button>
            <p className="mt-4 text-[10px] text-white/30 uppercase font-bold tracking-widest">
              Redirecting automatically...
            </p>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <a href="/" className="inline-block gold-gradient text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all">
              Return Home
            </a>
            <div className="pt-4 border-t border-white/5">
              <p className="text-xs text-white/40 leading-relaxed">
                Tip: Try opening the link in the <strong>same browser</strong> where you requested it. In-app browsers (like in Gmail/Outlook) may cause issues.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Confirm;
