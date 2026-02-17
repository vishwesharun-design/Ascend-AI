
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDarkMode?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, isDarkMode = true, size = 'medium' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className={`relative glass w-full ${sizeClasses[size]} max-h-[80vh] overflow-hidden rounded-3xl flex flex-col animate-in zoom-in-95 fade-in duration-300 border shadow-2xl ${
        isDarkMode ? 'bg-gray-900/90 border-white/10' : 'bg-white/95 border-slate-200'
      }`}>
        <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-amber-100' : 'text-slate-900'}`}>{title}</h3>
          <button 
            onClick={onClose}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
