import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

const Confirm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleYes = async () => {
    setLoading(true);
    setMessage(null);
    try {
      // Get session that was auto-detected from URL by Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Confirm sign-in error:', error);
        setMessage('Failed to complete sign-in. Please request a new link.');
      } else if (session) {
        setMessage('✅ Signed in successfully. Redirecting...');
        setTimeout(() => window.location.replace('/'), 1200);
      } else {
        setMessage('No active session found. Please try again.');
      }
    } catch (e) {
      console.error('Confirm error:', e);
      setMessage('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleNo = () => {
    // Clear any URL params and return home
    window.location.replace('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Confirm Sign In</h1>
        <p className="mb-6">Do you want to sign in to Ascend AI with this link?</p>
        {message && <p className="mb-4">{message}</p>}
        <div className="flex gap-4 justify-center">
          <button onClick={handleYes} disabled={loading} className="px-6 py-3 bg-amber-500 text-black font-bold rounded-lg">Yes</button>
          <button onClick={handleNo} disabled={loading} className="px-6 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg">No</button>
        </div>
      </div>
    </div>
  );
};

export default Confirm;
