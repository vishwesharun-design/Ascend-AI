import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, SuccessBlueprint, ActiveModal, SavedBlueprint, ArchitectMode } from './types';
import { geminiService } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import BlueprintDisplay from './components/BlueprintDisplay';
import Modal from './components/Modal';
import AuthModal from './components/AuthModal';
import Chat from './components/Chat';

const FREE_LIMIT = 3;
const PRO_LIMIT = 10;
const FREE_VAULT_LIMIT = 5;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [activeModal, setActiveModal] = useState<ActiveModal>(ActiveModal.NONE);
  const [architectMode, setArchitectMode] = useState<ArchitectMode>(ArchitectMode.STANDARD);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [inputGoal, setInputGoal] = useState('');
  const [blueprint, setBlueprint] = useState<SuccessBlueprint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [vaultItems, setVaultItems] = useState<SavedBlueprint[]>([]);
  const [vaultSearch, setVaultSearch] = useState('');
  const [dailyUsage, setDailyUsage] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  const modeMenuRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [isPro, setIsPro] = useState(false);
  const [isTrial, setIsTrial] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('ascend_theme');
    return saved !== null ? saved === 'dark' : true;
  });

  const dailyLimit = PRO_LIMIT;


  const localizedPricing = useMemo(() => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isIndia = timeZone.includes('Calcutta') || timeZone.includes('Kolkata') || navigator.language.includes('IN');
      return isIndia ? { symbol: '₹', amount: '30' } : { symbol: '$', amount: '10' };
    } catch (e) {
      return { symbol: '$', amount: '10' };
    }
  }, []);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
      else {
        setVaultItems([]);
        setIsPro(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    // Fetch Profile
    // Fetch Daily Usage from Supabase
const { data: usage } = await supabase
  .from('daily_usage')
  .select('*')
  .eq('user_id', userId)
  .single();

const today = new Date().toISOString().split('T')[0];

if (usage) {
  if (usage.last_reset_date !== today) {
    await supabase
      .from('daily_usage')
      .update({
        usage_count: 0,
        last_reset_date: today
      })
      .eq('user_id', userId);

    setDailyUsage(0);
  } else {
    setDailyUsage(usage.usage_count);
  }
} else {
  setDailyUsage(0);
}

    // Fetch Vault
    const { data: blueprints } = await supabase
  .from('blueprints')
  .select('*')
  .order('created_at', { ascending: false });

if (blueprints) {
  const formatted = blueprints.map((b: any) => ({
  id: b.id,
  blueprint: b.blueprint,
  timestamp: b.created_at,
  is_pinned: b.is_pinned || false
}));


  setVaultItems(formatted);
}

  };

  // On mount, load any locally-saved vault entries so user sees them immediately
  

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Daily Usage Logic (Still Local for now, could move to DB)


  useEffect(() => {
    localStorage.setItem('ascend_theme', isDarkMode ? 'dark' : 'light');
    document.body.style.backgroundColor = isDarkMode ? '#030712' : '#f9fafb';
  }, [isDarkMode]);

  const incrementUsage = async () => {
  if (!user) return;

  const { data: existing } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const today = new Date().toISOString().split('T')[0];

  if (!existing) {
    await supabase.from('daily_usage').insert({
      user_id: user.id,
      usage_count: 1,
      last_reset_date: today
    });
    setDailyUsage(1);
    return;
  }

  if (existing.last_reset_date !== today) {
    await supabase
      .from('daily_usage')
      .update({
        usage_count: 1,
        last_reset_date: today
      })
      .eq('user_id', user.id);

    setDailyUsage(1);
  } else {
    await supabase
      .from('daily_usage')
      .update({
        usage_count: existing.usage_count + 1
      })
      .eq('user_id', user.id);

    setDailyUsage(existing.usage_count + 1);
  }
};



  const handleStartArchitect = useCallback(async () => {
    if (dailyUsage >= dailyLimit) {
      setError(`Daily energy limit reached (${dailyLimit}/${dailyLimit}). Upgrade to Pro for ${PRO_LIMIT} daily units.`);
      setAppState(AppState.ERROR);
      return;
    }
    const trimmedGoal = inputGoal.trim();
    if (!trimmedGoal) return;
    setAppState(AppState.PLANNING);
    setError(null);
    setBlueprint(null);
    setIsSaved(false);
    setIsStreaming(true);
    try {
      let streamedText = '';
      const generatedBlueprint = await geminiService.generateBlueprintWithStream(
        trimmedGoal, 
        (isPro || isTrial), 
        architectMode,
        // onChunk callback - receives streamed text
        (chunk: string) => {
          streamedText += chunk;
          // Update blueprint with streamed content in real-time
          setBlueprint(prev => {
            const blueprint = prev || {
              goalTitle: trimmedGoal,
              visionStatement: "",
              coreFocus: [
                "Execution Discipline",
                "Strategic Clarity",
                "Momentum Building",
              ],
              strategyRoadmap: [
                {
                  title: "Phase 1: Strategic Foundation",
                  description: "",
                  timeline: "Initial Phase",
                  status: "pending",
                }
              ],
              marketAnalysis: [
                {
                  title: "AI Strategic Insight",
                  description:
                    "Generated using Gemini 2.5 Flash model for structured execution planning.",
                  sourceUrl: "",
                }
              ]
            };
            
            return {
              ...blueprint,
              visionStatement: streamedText.slice(0, 200),
              strategyRoadmap: blueprint.strategyRoadmap && blueprint.strategyRoadmap[0] 
                ? [
                    {
                      ...blueprint.strategyRoadmap[0],
                      description: streamedText,
                    }
                  ]
                : [{
                    title: "Phase 1: Strategic Foundation",
                    description: streamedText,
                    timeline: "Initial Phase",
                    status: "pending",
                  }]
            };
          });
        },
        // onComplete callback - receives complete blueprint
        (completeBlueprint: any) => {
          setBlueprint(completeBlueprint);
          setIsStreaming(false);
          setAppState(AppState.VIEWING_BLUEPRINT);
        },
        // Pass userId for backend usage tracking
        user?.id
      );
      
      if (generatedBlueprint && generatedBlueprint.strategyRoadmap?.length > 0) {
        setBlueprint(generatedBlueprint);
        setIsStreaming(false);
        setAppState(AppState.VIEWING_BLUEPRINT);
      }
      
      incrementUsage();
    } catch (err: any) {
      setError(err.message || "Strategic block. Please try again.");
      setAppState(AppState.ERROR);
      setIsStreaming(false);
    }
  }, [inputGoal, dailyUsage, dailyLimit, isPro, isTrial, architectMode, user?.id]);

  const handleSaveToVault = async () => {
    if (!blueprint || isSaved) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    
    try {
      // Inspect one sample row to detect available columns
      const { data: sampleRow } = await supabase.from('blueprints').select('*').limit(1).maybeSingle();

      // Prefer common column names if present, else fall back to 'blueprint'
      const preferred = ['blueprint', 'data', 'content', 'payload', 'json', 'blueprint_json'];
      let targetCol = 'blueprint';

      if (sampleRow) {
        const cols = Object.keys(sampleRow);
        const found = preferred.find((c) => cols.includes(c));
        if (found) targetCol = found;
        else {
          // pick first writable-looking column (not id/user_id/created_at)
          const candidate = cols.find(c => !['id', 'user_id', 'created_at', 'updated_at'].includes(c));
          if (candidate) targetCol = candidate;
        }
      }

      // Build insert object dynamically
      const insertObj: any = { user_id: user.id };
      insertObj[targetCol] = blueprint;

      const { data, error } = await supabase
        .from('blueprints')
        .insert([insertObj])
        .select()
        .single();

      if (error) {
        // If the error indicates a missing column, show actionable guidance
        if (error.message && error.message.includes("Could not find the '")) {
          // Graceful local fallback: persist in localStorage so user doesn't lose work
          const localId = `local-${Date.now()}`;
          const localEntry: SavedBlueprint = {
            id: localId,
            blueprint,
            timestamp: new Date().toISOString()
          };
          const existing = JSON.parse(localStorage.getItem('ascend_vault') || '[]');
          existing.unshift(localEntry);
          localStorage.setItem('ascend_vault', JSON.stringify(existing));
          setVaultItems([localEntry, ...vaultItems]);
          setIsSaved(true);
          alert("Saved to Vault locally (offline). To enable server-side archiving, run the migration to add a JSON 'blueprint' column to your Supabase 'blueprints' table. Open migrations/add_blueprint_column.sql and run it in Supabase SQL Editor.");
          return;
        }
        throw error;
      }

      const newEntry: SavedBlueprint = {
        id: data.id,
        // try to read the value from the returned row using targetCol
        blueprint: data[targetCol] ?? data.blueprint ?? data.data ?? data.content,
        timestamp: data.created_at
      };

      setVaultItems([newEntry, ...vaultItems]);
      setIsSaved(true);
    } catch (err: any) {
      alert("Failed to save to Vault: " + (err?.message || String(err)));
    }
  };

  const loadFromVault = (item: SavedBlueprint) => {
    setBlueprint(item.blueprint);
    setAppState(AppState.VIEWING_BLUEPRINT);
    setActiveModal(ActiveModal.NONE);
    setIsSaved(true);
  };

  const reset = useCallback(() => {
    setAppState(AppState.IDLE);
    setInputGoal('');
    setBlueprint(null);
    setError(null);
    setIsSaved(false);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setVaultItems([]);
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case ActiveModal.CHAT:
        return (
          <Chat 
            user={user} 
            onSignInRequired={() => { setActiveModal(ActiveModal.NONE); setIsAuthModalOpen(true); }}
            isDarkMode={isDarkMode}
          />
        );
      case ActiveModal.VAULT:
        return (
          <div className="space-y-3">
            {!user ? (
              <div className="text-center py-10 space-y-4">
                <p className="opacity-70 text-sm">Sign in to access your secure Vault.</p>
                <button onClick={() => { setActiveModal(ActiveModal.NONE); setIsAuthModalOpen(true); }} className="gold-gradient text-black px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px]">Sign In</button>
              </div>
            ) : (
              <>
                {!isPro && !isTrial && (
                  <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 mb-4">
  <p className="text-[10px] font-black uppercase text-emerald-500 text-center">
    Unlimited Vault Access 🚀
  </p>
</div>

                )}
                {vaultItems.length === 0 ? (
                  <div className="text-center py-10 opacity-50 text-sm">Your strategy vault is empty.</div>
                ) : (
                  vaultItems.map((item) => (
                    <button key={item.id} onClick={() => loadFromVault(item)} className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-white'}`}>
                      <div className="flex-1 text-left truncate">
                        <p className="font-bold truncate text-sm">{item.blueprint.goalTitle}</p>
                        <p className="text-[9px] opacity-50 uppercase font-black">{new Date(item.timestamp).toLocaleDateString()}</p>
                      </div>
                      <i className="fas fa-chevron-right text-[10px] opacity-30"></i>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        );
      case ActiveModal.UPGRADE:
        const trialUsed = localStorage.getItem('ascend_trial_start') !== null;
        return (
          <div className="text-center space-y-6 py-4">
            <div className="w-20 h-20 gold-gradient rounded-3xl flex items-center justify-center mx-auto shadow-2xl rotate-3">
              <i className="fas fa-crown text-white text-3xl"></i>
            </div>
            <div>
              <h4 className={`text-2xl font-black uppercase tracking-tighter mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ascend Pro</h4>
              <p className={`text-xs max-w-sm mx-auto opacity-70 ${isDarkMode ? 'text-white' : 'text-slate-600'}`}>Elevate your strategy with 10 Daily Units and Unlimited Archiving.</p>
            </div>
            <div className="py-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <span className="text-3xl font-black text-amber-500">{localizedPricing.symbol}{localizedPricing.amount}</span>
              <span className="text-xs font-bold opacity-60 uppercase ml-1">/ Month</span>
            </div>
            <div className="grid grid-cols-1 gap-3 text-left max-w-sm mx-auto">
              {[
                { icon: 'fa-bolt', text: `${PRO_LIMIT} Blueprints per day`, sub: 'Up from 3 free units' },
                { icon: 'fa-vault', text: 'Unlimited Vault archiving', sub: 'Archive every success strategy' },
                { icon: 'fa-microchip', text: 'Priority AI processing', sub: 'Advanced Intelligence Core' }
              ].map((benefit, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <i className={`fas ${benefit.icon} text-amber-500 shrink-0`}></i>
                  <div>
                    <span className={`text-sm font-bold block leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{benefit.text}</span>
                    <span className={`text-[10px] uppercase font-black tracking-tighter opacity-50 ${isDarkMode ? 'text-white' : 'text-slate-600'}`}>{benefit.sub}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <button disabled className="w-full gold-gradient text-black font-black uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.02] transition-all shadow-xl opacity-50 cursor-not-allowed">🚀 Free For Now</button>
            </div>
          </div>
        );
      case ActiveModal.PHILOSOPHY:
        return <p className="opacity-70 leading-relaxed text-sm">Ascend AI is designed to democratize success. By focusing on pure strategic intelligence, we allow students to map their futures every single day.</p>;
      default: return null;
    }
  };

  const limitReached = dailyUsage >= dailyLimit;

  // Mode Metadata
  const modeData = [
    { id: ArchitectMode.STANDARD, label: 'Standard', sub: 'Balanced strategy roadmap', icon: 'fa-compass' },
    { id: ArchitectMode.DETAILED, label: 'Detailed', sub: 'Granular, deep-dive analysis', icon: 'fa-microscope' },
    { id: ArchitectMode.SPEED, label: 'Rapid', sub: 'Fastest execution focus', icon: 'fa-bolt-lightning' },
    { id: ArchitectMode.MARKET, label: 'Market Intel', sub: 'Competitive gaps & intel', icon: 'fa-chart-pie' }
  ];

  const currentModeIcon = modeData.find(m => m.id === architectMode)?.icon || 'fa-compass';

  return (
    <div className={`min-h-screen flex flex-col p-4 md:p-8 transition-colors duration-500 ${isDarkMode ? 'bg-[#030712] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <header className="w-full max-w-7xl mx-auto flex justify-between items-center mb-10 z-10">
        <button onClick={reset} className="flex items-center space-x-3 group">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform"><i className="fas fa-crown text-white"></i></div>
          <div className="hidden sm:flex flex-col items-start leading-none">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tighter">ASCEND<span className="text-amber-500">AI</span></span>
              {(isPro || isTrial) && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-[8px] text-black font-black uppercase">{isTrial ? 'TRIAL' : 'PRO'}</span>}
            </div>
            <span className="text-[8px] font-bold uppercase tracking-widest opacity-50">Strategy Architect</span>
          </div>
        </button>
        <div className="flex items-center gap-3 md:gap-6">
          {!isPro && !isTrial && (
            <button onClick={() => setActiveModal(ActiveModal.UPGRADE)} className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500 border border-amber-500/30 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-all">
              <i className="fas fa-rocket"></i> Go Pro
            </button>
          )}
          <button onClick={() => setActiveModal(ActiveModal.CHAT)} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-2" title={user ? "Open Chat" : "Sign in to chat"}>
            <i className="fas fa-comments"></i> Chat
          </button>
          <button onClick={() => setActiveModal(ActiveModal.VAULT)} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-2">
            <i className="fas fa-vault"></i> Vault ({vaultItems.length})
          </button>

          {user ? (
            <button onClick={handleSignOut} title="Sign Out" className="w-10 h-10 rounded-xl border flex items-center justify-center opacity-60 hover:opacity-100 transition-all border-red-500/30 hover:bg-red-500/10 text-red-500">
              <i className="fas fa-sign-out-alt"></i>
            </button>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-2">
              <i className="fas fa-user-circle"></i> Login
            </button>
          )}

          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-10 h-10 rounded-xl border flex items-center justify-center opacity-60 hover:opacity-100 transition-all ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <i className={`fas ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto z-10">

        {appState === AppState.IDLE && (
          <div className="text-center py-20 flex flex-col items-center">
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-none mb-6">
              Build Your<br /><span className="text-amber-400">Strategic Future</span>

            </h1>
            <p className="max-w-2xl text-lg opacity-60 mb-10">Generate high-efficiency roadmaps and market insights for any ambitious goal.</p>

            {!user ? (
              <div className={`w-full max-w-3xl space-y-4 p-8 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900/50 border-red-500/30' : 'bg-red-50 border-red-300'}`}>
                <div className="flex flex-col items-center gap-4">
                  <div className={`text-5xl ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    <i className="fas fa-lock"></i>
                  </div>
                  <h2 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Blueprint Generator Locked 🔐
                  </h2>
                  <p className={`text-sm leading-relaxed max-w-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    Sign in first to activate the blueprint generator and create strategic roadmaps for your goals.
                  </p>
                  <button 
                    onClick={() => setIsAuthModalOpen(true)}
                    className="gold-gradient text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all mt-4"
                  >
                    <i className="fas fa-sign-in-alt mr-2"></i> Sign In to Generate
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-3xl space-y-4">
                {/* Input Command Area with Integrated Mode Toggle */}
                <div className="flex flex-col md:flex-row gap-2 relative">
                  <div className={`flex flex-1 items-center border rounded-2xl px-4 py-1 transition-all focus-within:ring-2 focus-within:ring-amber-500/20 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 shadow-sm text-slate-900'}`}>

                    {/* Mode Selector Button */}
                    <div className="relative" ref={modeMenuRef}>
                      <button
                        onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                        className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all hover:bg-amber-500/10 text-amber-500 shrink-0 ${isModeMenuOpen ? 'bg-amber-500/10' : ''}`}
                        title="Select Intelligence Mode"
                      >
                        <i className={`fas ${currentModeIcon} text-lg`}></i>
                      </button>

                      {/* Mode Dropdown Menu */}
                      {isModeMenuOpen && (
                        <div className={`absolute bottom-full left-0 mb-4 w-64 rounded-2xl border p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 ${isDarkMode ? 'bg-gray-900/95 border-white/10 backdrop-blur-xl' : 'bg-white border-slate-200 backdrop-blur-xl'}`}>
                          <div className="px-3 py-2 border-b border-white/5 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Intelligence Engine</span>
                          </div>
                          {modeData.map((mode) => (
                            <button
                              key={mode.id}
                              onClick={() => {
                                setArchitectMode(mode.id);
                                setIsModeMenuOpen(false);
                              }}
                              className={`w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left group ${architectMode === mode.id
                                ? (isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-600')
                                : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50')
                                }`}
                            >
                              <i className={`fas ${mode.icon} mt-1 text-sm ${architectMode === mode.id ? 'text-amber-500' : 'opacity-40'}`}></i>
                              <div className="flex-1">
                                <p className="text-xs font-black uppercase tracking-tighter leading-none mb-1">{mode.label}</p>
                                <p className="text-[10px] opacity-50 font-medium leading-tight">{mode.sub}</p>
                              </div>
                              {architectMode === mode.id && <i className="fas fa-check text-[10px] mt-1"></i>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder={limitReached ? "Daily energy exhausted..." : `Describe your ${architectMode.toLowerCase()} goal...`}
                      disabled={limitReached}
                      className="flex-1 bg-transparent border-none px-2 py-4 text-lg focus:outline-none placeholder:opacity-40"
                      value={inputGoal}
                      onChange={(e) => setInputGoal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleStartArchitect()}
                    />

                    <div className="hidden md:block px-2">
                      <span className="text-[8px] font-black uppercase px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Enter ↵</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartArchitect}
                    disabled={limitReached || !inputGoal.trim()}
                    className={`px-10 py-5 md:py-0 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${limitReached ? 'bg-gray-500 opacity-50' : 'gold-gradient text-black hover:scale-[1.02] active:scale-95 shadow-xl shadow-amber-500/10'}`}
                  >
                    {limitReached ? 'Limit' : 'Architect'}
                  </button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center px-2 pt-2 gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      <i className="fas fa-bolt text-amber-500 mr-1"></i> Energy: {dailyLimit - dailyUsage}/{dailyLimit} Units
                    </span>
                    {!isPro && !isTrial && limitReached && (
                      <button onClick={() => setActiveModal(ActiveModal.UPGRADE)} className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:underline">
                        Increase to {PRO_LIMIT} Units
                      </button>
                    )}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-30 italic">
                    Mode: {architectMode} Execution Engine
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {appState === AppState.PLANNING && (
          <div className="py-32 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-2xl font-black uppercase italic tracking-widest animate-pulse">Constructing {architectMode} Blueprint...</h2>
          </div>
        )}

        {appState === AppState.VIEWING_BLUEPRINT && blueprint && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center mb-8">
              <button onClick={reset} className="text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 flex items-center gap-2">
                <i className="fas fa-arrow-left"></i> New Blueprint
              </button>
              <button onClick={handleSaveToVault} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isSaved ? 'opacity-50' : 'gold-gradient text-black hover:scale-105 transition-all'}`}>
                {isSaved ? 'Archived in Vault' : 'Save To Vault'}
              </button>
            </div>
            <BlueprintDisplay blueprint={blueprint} isDarkMode={isDarkMode} isStreaming={isStreaming} />
          </div>
        )}

        {appState === AppState.ERROR && (
          <div className="py-20 text-center space-y-6">
            <div className="text-red-500 text-5xl mb-4"><i className="fas fa-shield-virus"></i></div>
            <h2 className="text-2xl font-black uppercase">System Pause</h2>
            <p className="opacity-60 max-w-sm mx-auto text-sm leading-relaxed">{error}</p>
            <div className="flex flex-col items-center gap-3">
              <button onClick={reset} className="px-8 py-3 rounded-xl border border-white/10 font-black uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">Back Home</button>
              {limitReached && !isPro && !isTrial && (
                <button onClick={() => setActiveModal(ActiveModal.UPGRADE)} className="gold-gradient text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Upgrade to 10 Units</button>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-10 text-center opacity-30 text-[9px] font-black uppercase tracking-widest">
        &copy; 2025 Ascend AI - {isPro ? 'Pro' : isTrial ? 'Trial' : 'Free Tier'} Active
      </footer>

      <Modal isOpen={activeModal !== ActiveModal.NONE} onClose={() => setActiveModal(ActiveModal.NONE)} title={activeModal === ActiveModal.UPGRADE ? "Ascend Pro" : activeModal === ActiveModal.CHAT ? "Strategy Coach" : activeModal.toString()} isDarkMode={isDarkMode} size={activeModal === ActiveModal.CHAT ? 'large' : 'medium'}>
        {renderModalContent()}
      </Modal>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} isDarkMode={isDarkMode} user={user} />
    </div>
  );
};

export default App;
