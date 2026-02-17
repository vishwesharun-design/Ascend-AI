import { useState, useEffect } from 'react';

export const useTypeWriter = (text: string, speed: number = 30) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      return;
    }

    let currentIndex = displayedText.length;
    
    // If new text is shorter, reset
    if (currentIndex > text.length) {
      setDisplayedText('');
      currentIndex = 0;
    }

    if (currentIndex >= text.length) {
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, currentIndex + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [text, speed, displayedText.length]);

  return displayedText;
};
