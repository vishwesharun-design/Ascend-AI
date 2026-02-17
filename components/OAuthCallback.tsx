import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

const OAuthCallback: React.FC = () => {
  const [message, setMessage] = useState('Completing sign-in...');

  useEffect(() => {
    (async () => {
      try {
        // Wait a moment for Supabase to process the URL and auth state
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('OAuth callback error:', error);
          setMessage('Failed to complete sign-in. Redirecting...');
          setTimeout(() => (window.location.href = '/'), 2500);
          return;
        }

        if (session) {
          setMessage('Signed in — redirecting...');
          setTimeout(() => (window.location.href = '/'), 800);
          return;
        }

        // No session found
        setMessage('No session found. Redirecting to home...');
        setTimeout(() => (window.location.href = '/'), 1200);
      } catch (err) {
        console.error('Unexpected OAuth callback error:', err);
        setMessage('Unexpected error. Redirecting...');
        setTimeout(() => (window.location.href = '/'), 2000);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-6 rounded-xl bg-white/80 dark:bg-slate-900 shadow">
        <h3 className="font-bold text-lg mb-2">{message}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">If you are not redirected, <a href="/" className="underline">click here</a>.</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
