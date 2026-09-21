export interface PanelWidthOptions {
  viewportWidth: number;
  navigationVisible: boolean;
  tocVisible: boolean;
  navigationWidth: number;
  tocWidth: number;
}

export interface PanelWidths {
  navigationWidth: number;
  tocWidth: number;
  navigationMin: number;
  navigationMax: number;
  tocMin: number;
  tocMax: number;
}

const NAVIGATION_MIN = 220;
const TOC_MIN = 180;
const ARTICLE_MIN = 240;

/** Clamp CSS widths without allowing malformed input to introduce NaN or negatives. */
export function clampPanelWidth(value: number, min: number, max: number): number {
  const minimum = Number.isFinite(min) ? Math.max(0, min) : 0;
  const maximum = Number.isFinite(max) ? Math.max(minimum, max) : minimum;
  const width = Number.isFinite(value) ? value : value === Infinity ? maximum : minimum;
  return Math.min(maximum, Math.max(minimum, width));
}

/**
 * Resolve preferred widths against the space left for the article. Visibility is
 * supplied by the layout: navigation is normally hidden below 1200px, and the
 * TOC below 768px. Hidden panels retain their preferences for later use.
 */
export function resolvePanelWidths(options: PanelWidthOptions): PanelWidths {
  const viewportWidth = Number.isFinite(options.viewportWidth) ? Math.max(0, options.viewportWidth) : 0;
  let navigationWidth = Number.isFinite(options.navigationWidth) ? Math.max(NAVIGATION_MIN, options.navigationWidth) : NAVIGATION_MIN;
  let tocWidth = Number.isFinite(options.tocWidth) ? Math.max(TOC_MIN, options.tocWidth) : TOC_MIN;
  // Hidden panels do not have an interactive limit and keep their finite
  // preference, including widths that would not fit the current viewport.
  let navigationMax = Math.max(navigationWidth, viewportWidth);
  let tocMax = Math.max(tocWidth, viewportWidth);

  if (viewportWidth >= 768) {
    const gutter = viewportWidth >= 1200 ? 40 : 32;
    const availableWidth = viewportWidth - gutter * (options.tocVisible ? 3 : 2) - ARTICLE_MIN;

    // Keep the navigation preference first, while reserving the TOC minimum.
    if (options.navigationVisible) {
      const navigationLimit = Math.max(
        NAVIGATION_MIN,
        availableWidth - (options.tocVisible ? TOC_MIN : 0),
      );
      navigationWidth = clampPanelWidth(navigationWidth, NAVIGATION_MIN, navigationLimit);
    }

    if (options.tocVisible) {
      tocMax = Math.max(
        TOC_MIN,
        availableWidth - (options.navigationVisible ? navigationWidth : 0),
      );
      tocWidth = clampPanelWidth(tocWidth, TOC_MIN, tocMax);
    }

    // Dragging either separator must preserve the other panel's current width.
    if (options.navigationVisible) {
      navigationMax = Math.max(
        NAVIGATION_MIN,
        availableWidth - (options.tocVisible ? tocWidth : 0),
      );
    }
  }

  return {
    navigationWidth,
    tocWidth,
    navigationMin: NAVIGATION_MIN,
    navigationMax,
    tocMin: TOC_MIN,
    tocMax,
  };
}
