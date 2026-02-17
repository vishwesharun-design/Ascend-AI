import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';

interface ChatProps {
  user: any;
  onSignInRequired: () => void;
  isDarkMode: boolean;
}

const Chat: React.FC<ChatProps> = ({ user, onSignInRequired, isDarkMode }) => {
  const [messages, setMessages] = useState<{ id: string; sender: 'user' | 'bot'; text: string; timestamp: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  if (!user) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-96 rounded-2xl border-2 ${isDarkMode ? 'bg-slate-900/50 border-blue-500/30' : 'bg-blue-50 border-blue-300'}`}>
        <div className="text-center space-y-4 p-8">
          <div className={`text-5xl mb-4 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
            <i className="fas fa-lock"></i>
          </div>
          <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Chat Locked 🔒
          </h3>
          <p className={`text-sm leading-relaxed max-w-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Sign in first to activate chat and get strategic assistance for your goals.
          </p>
          <div className="pt-4 space-y-2">
            <button 
              onClick={onSignInRequired}
              className="gold-gradient text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all"
            >
              <i className="fas fa-sign-in-alt mr-2"></i> Sign In Now
            </button>
            <p className={`text-[10px] opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              You'll have access to AI coaching once authenticated
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      sender: 'user' as const,
      text: inputValue,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userInput,
          conversationHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get chat response');
      }

      const data = await response.json();

      const botMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot' as const,
        text: data.message || 'Unable to generate response. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot' as const,
        text: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl border-2 overflow-hidden ${isDarkMode ? 'bg-slate-900/50 border-cyan-500/30' : 'bg-cyan-50 border-cyan-300'}`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-white border-cyan-200'}`}>
        <div className="flex items-center gap-3">
          <i className={`fas fa-comments text-lg ${isDarkMode ? 'text-cyan-300' : 'text-cyan-600'}`}></i>
          <div>
            <h4 className={`font-black text-sm uppercase tracking-tight ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
              Strategy Coach
            </h4>
            <p className={`text-[10px] opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Ask for strategic guidance
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-64">
        {messages.length === 0 ? (
          <div className={`flex items-center justify-center h-full text-center opacity-50 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <div className="space-y-2">
              <i className="fas fa-comments text-3xl opacity-30"></i>
              <p className="text-[11px] font-bold uppercase tracking-widest">Start a conversation</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed ${
                  message.sender === 'user'
                    ? isDarkMode
                      ? 'bg-amber-500/30 text-amber-100 border border-amber-500/50'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                    : isDarkMode
                    ? 'bg-slate-800 text-slate-100 border border-slate-700'
                    : 'bg-white text-slate-800 border border-slate-200'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{animationDelay: '100ms'}}></div>
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{animationDelay: '200ms'}}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSendMessage}
        className={`p-4 border-t ${isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-white border-cyan-200'}`}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={user ? "Ask a strategic question..." : "Sign in to chat"}
            disabled={isLoading || !user}
            className={`flex-1 px-4 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-amber-500/50 text-sm ${
              isDarkMode
                ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim() || !user}
            title={!user ? "Sign in to send messages" : "Send message"}
            className="px-4 py-2 rounded-lg gold-gradient text-black font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          </button>
        </div>
        {!user && (
          <p className="text-[10px] text-amber-500 mt-2 font-bold">
            <i className="fas fa-lock mr-1"></i> Sign in to use chat
          </p>
        )}
      </form>
    </div>
  );
};

export default Chat;
