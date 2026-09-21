import { useEffect, useState } from 'react';
import { resolvePanelWidths } from './panel-widths';

const storageKey = 'leo-learn-panel-widths';
type Preferences = { navigation: number; toc?: number };

function readPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return {
      navigation: typeof stored?.navigation === 'number' && Number.isFinite(stored.navigation) ? stored.navigation : 300,
      toc: typeof stored?.toc === 'number' && Number.isFinite(stored.toc) ? stored.toc : undefined,
    };
  } catch { return { navigation: 300 }; }
}

export function usePanelWidths(navigationVisible: boolean, tocVisible: boolean, defaultTocWidth: number) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Resizing still works when storage is unavailable. */ }
  }, [preferences]);

  const widths = resolvePanelWidths({ viewportWidth, navigationVisible, tocVisible, navigationWidth: preferences.navigation, tocWidth: preferences.toc ?? defaultTocWidth });
  // A user drag trades space with the article, keeping the other visible pane
  // at its current width even when its saved preference was viewport-clamped.
  const setNavigationWidth = (navigation: number) => setPreferences((current) => ({ ...current, navigation, toc: tocVisible ? widths.tocWidth : current.toc }));
  const setTocWidth = (toc: number | undefined) => setPreferences((current) => ({ ...current, toc, navigation: navigationVisible ? widths.navigationWidth : current.navigation }));

  return {
    widths,
    setNavigationWidth,
    setTocWidth,
    resetNavigationWidth: () => setNavigationWidth(300),
    resetTocWidth: () => setTocWidth(undefined),
  };
}
