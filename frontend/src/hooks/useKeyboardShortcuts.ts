import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onTogglePlay: () => void;
  onTriggerMix: () => void;
  onAirhorn: () => void;
  onSubDrop: () => void;
  onSpinback: () => void;
  onEchoFreeze: () => void;
  onToggleView: () => void;
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onTriggerMix,
  onAirhorn,
  onSubDrop,
  onSpinback,
  onEchoFreeze,
  onToggleView
}: KeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in search inputs or text fields
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onTriggerMix();
      } else if (e.key === '1') {
        e.preventDefault();
        onAirhorn();
      } else if (e.key === '2') {
        e.preventDefault();
        onSubDrop();
      } else if (e.key === '3') {
        e.preventDefault();
        onSpinback();
      } else if (e.key === '4') {
        e.preventDefault();
        onEchoFreeze();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        onToggleView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePlay,
    onTriggerMix,
    onAirhorn,
    onSubDrop,
    onSpinback,
    onEchoFreeze,
    onToggleView
  ]);
}
