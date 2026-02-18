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
            setMessage('✅ Signed in successfully! Redirecting...');
            setTimeout(() => window.location.replace('/'), 1000);
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
          setMessage('✅ Signed in successfully! Redirecting...');
          setTimeout(() => window.location.replace('/'), 1000);
          return;
        }

        // No tokens or code found
        setError(true);
        setMessage('No sign-in link detected. Please request a new confirmation link.');
      } catch (e) {
        console.error('Confirm error:', e);
        setError(true);
        setMessage('An unexpected error occurred. Please try again.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712]">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-10 shadow-2xl max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl gold-gradient shadow-lg">
          <i className={`fas ${error ? 'fa-exclamation-triangle' : success ? 'fa-check-circle' : 'fa-spinner fa-spin'} text-white text-2xl`}></i>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          {error ? 'Sign-In Issue' : success ? 'Welcome!' : 'Completing Sign-In'}
        </h1>
        <p className={`text-sm ${error ? 'text-red-400' : success ? 'text-green-400' : 'text-white/70'}`}>{message}</p>
        {error && (
          <a href="/" className="inline-block gold-gradient text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all">
            Back to Home
          </a>
        )}
      </div>
    </div>
  );
};

export default Confirm;
