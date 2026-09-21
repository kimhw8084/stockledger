import { useEffect, useState } from 'react';

let webKeyboardModality = true;
let webModalityListenersInstalled = false;

function ensureWebModalityListeners() {
  if (webModalityListenersInstalled || typeof document === 'undefined') return;
  webModalityListenersInstalled = true;

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    webKeyboardModality = true;
  }, true);

  document.addEventListener('pointerdown', () => {
    webKeyboardModality = false;
  }, true);
}

export function useInteractionState() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    ensureWebModalityListeners();
  }, []);

  return {
    hovered,
    focused,
    interactionProps: {
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
      onFocus: () => setFocused(typeof document === 'undefined' || webKeyboardModality),
      onBlur: () => setFocused(false),
    },
  } as const;
}
