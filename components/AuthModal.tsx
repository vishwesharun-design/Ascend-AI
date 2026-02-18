import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { getOrCreateDeviceFingerprint } from '../services/deviceFingerprint';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    user: any;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, isDarkMode, user }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isDeviceBlocked, setIsDeviceBlocked] = useState(false);

    // Auto-close modal when user is authenticated (e.g., after email confirmation)
    useEffect(() => {
        if (user && isOpen) {
            setEmail('');
            setPassword('');
            setMessage(null);
            setIsDeviceBlocked(false);
            onClose();
        }
    }, [user, isOpen, onClose]);

    if (!isOpen) return null;

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setIsDeviceBlocked(false);

        try {
            // For magic link flow, check device before sending link
            const deviceFingerprint = getOrCreateDeviceFingerprint();
            try {
                const spamCheckRes = await fetch('/api/check-spam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceFingerprint })
                });

                if (!spamCheckRes.ok) {
                    setMessage('⚠️ Device verification failed. Please try again later.');
                    setLoading(false);
                    return;
                }

                const spamCheck = await spamCheckRes.json();
                if (spamCheck.isBlocked) {
                    setIsDeviceBlocked(true);
                    setMessage(`🚫 DEVICE BLOCKED: ${spamCheck.reason || 'Too many accounts created from this device.'}`);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.error('Spam check error:', err);
                setMessage('⚠️ Could not verify device; please try again later.');
                setLoading(false);
                return;
            }

            // Send magic link / confirmation email with explicit redirect to /confirm
            const redirectTo = `${window.location.origin}/confirm`;
            const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
            if (error) {
                console.error('Magic link error:', error);
                setMessage('Failed to send confirmation link. Please try again.');
            } else {
                setMessage('📧 Confirmation link sent — check your inbox (and spam). Open the link to sign in.');
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            setMessage('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setMessage(null);
        const deviceFingerprint = getOrCreateDeviceFingerprint();
        try {
            const spamCheckRes = await fetch('http://api/check-spam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceFingerprint })
            });

            if (!spamCheckRes.ok) {
                setMessage('⚠️ Device verification failed. Please try again later.');
                setLoading(false);
                return;
            }

            const spamCheck = await spamCheckRes.json();
            if (spamCheck.isBlocked) {
                setIsDeviceBlocked(true);
                setMessage(`🚫 DEVICE BLOCKED: ${spamCheck.reason || 'Too many accounts created from this device.'}`);
                setLoading(false);
                return;
            }

            const redirectTo = `${window.location.origin}/auth/oauth-callback`;
            await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        } catch (err) {
            console.error('Google sign-in error:', err);
            setMessage('Google sign-in failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className={`relative w-full max-w-md rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden ${isDarkMode ? 'bg-gradient-to-br from-slate-900 via-[#0f172a] to-black border border-white/10' : 'bg-white text-slate-900'}`}>
                {/* Header with gold accent */}
                <div className="absolute top-0 left-0 right-0 h-1 gold-gradient"></div>
                
                <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter mb-1">{isLogin ? '🎯 Welcome Back' : '⚡ Join Ascend'}</h2>
                            <p className={`text-[11px] uppercase tracking-widest font-bold ${isDarkMode ? 'text-amber-400/70' : 'text-amber-600/70'}`}>{isLogin ? 'Access your Vault' : 'Start Building Futures'}</p>
                        </div>
                        <button onClick={onClose} className={`text-lg opacity-50 hover:opacity-100 transition-opacity ${isDarkMode ? 'text-white/70' : 'text-slate-700'}`}><i className="fas fa-times"></i></button>
                    </div>

                    {/* Divider */}
                    <div className={`h-px ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`}></div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className={`text-[10px] font-black uppercase tracking-widest block mb-2 flex items-center gap-2 ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600/80'}`}><i className="fas fa-envelope text-xs"></i> Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className={`w-full p-4 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/50 border-2 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-white/30' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'} focus:border-amber-500/50`}
                            />
                        </div>
                        {/* Password removed: magic-link email-only flow */}

                        {message && (
                            <div className={`p-4 rounded-xl text-xs font-bold flex items-start gap-3 ${message.includes('Check') ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                <i className={`fas ${message.includes('Check') ? 'fa-check-circle' : 'fa-exclamation-circle'} text-sm mt-0.5 shrink-0`}></i>
                                <span>{message}</span>
                            </div>
                        )}

                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full py-5 rounded-xl gold-gradient text-black font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-envelope-open-text"></i>
                                    <span>Send Confirmation Link</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className={`h-px ${isDarkMode ? 'bg-white/5' : 'bg-slate-200'}`}></div>

                                        <div className="pt-4">
                                            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-sm font-bold flex items-center justify-center gap-3">
                                                <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" className="w-5 h-5" />
                                                <span>Continue with Google</span>
                                            </button>
                                        </div>

                                        <div className={`text-center space-y-2 ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`}>
                                                <p className="text-[10px] uppercase tracking-widest font-bold opacity-60">Enter your email and we'll send a confirmation link — open it to sign in.</p>
                                        </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
