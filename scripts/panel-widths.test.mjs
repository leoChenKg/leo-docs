import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPanelWidth, resolvePanelWidths } from '../src/layout/panel-widths.ts';

const resolve = (changes = {}) => resolvePanelWidths({
  viewportWidth: 1920,
  navigationVisible: true,
  tocVisible: true,
  navigationWidth: 280,
  tocWidth: 240,
  ...changes,
});

test('clamps out-of-range and malformed widths to finite nonnegative bounds', () => {
  assert.equal(clampPanelWidth(100, 220, 1200), 220);
  assert.equal(clampPanelWidth(800, 220, 1200), 800);
  assert.equal(clampPanelWidth(2000, 220, 1200), 1200);
  assert.equal(clampPanelWidth(NaN, 220, 1200), 220);
  assert.equal(clampPanelWidth(Infinity, 220, 1200), 1200);
  assert.equal(clampPanelWidth(-Infinity, 220, 1200), 220);
  assert.equal(clampPanelWidth(undefined, 220, 1200), 220);
  assert.equal(clampPanelWidth(300, 220, 100), 220);
  assert.equal(clampPanelWidth(-30, -100, -10), 0);
  assert.equal(clampPanelWidth(300, NaN, Infinity), 0);
});

test('hidden mobile panels retain wide preferences without consuming article space', () => {
  const widths = resolve({
    viewportWidth: 320,
    navigationVisible: false,
    tocVisible: false,
    navigationWidth: 800,
    tocWidth: 720,
  });
  assert.equal(widths.navigationWidth, 800);
  assert.equal(widths.tocWidth, 720);
  assert.ok(widths.navigationMax >= widths.navigationWidth);
  assert.ok(widths.tocMax >= widths.tocWidth);
});

test('768px and 1024px layouts allow the TOC to use all space above the article minimum', () => {
  for (const [viewportWidth, expectedTocWidth] of [[768, 432], [1024, 688]]) {
    const widths = resolve({ viewportWidth, navigationVisible: false, navigationWidth: 800, tocWidth: 1000 });
    assert.equal(widths.navigationWidth, 800);
    assert.equal(widths.tocWidth, expectedTocWidth);
    assert.equal(widths.tocMax, expectedTocWidth);
    assert.equal(viewportWidth - 3 * 32 - widths.tocWidth, 240);
  }
});

test('desktop navigation can exceed 480px while preserving the current TOC', () => {
  const widths = resolve({ viewportWidth: 1200, navigationWidth: 600, tocWidth: 240 });
  assert.equal(widths.navigationWidth, 600);
  assert.equal(widths.tocWidth, 240);
  assert.equal(widths.navigationMax, 600);
  assert.equal(widths.tocMax, 240);
  assert.equal(1200 - 3 * 40 - widths.navigationWidth - widths.tocWidth, 240);
});

test('desktop TOC can exceed 400px while preserving the current navigation', () => {
  const widths = resolve({ viewportWidth: 1200, navigationWidth: 280, tocWidth: 560 });
  assert.equal(widths.navigationWidth, 280);
  assert.equal(widths.tocWidth, 560);
  assert.equal(widths.navigationMax, 280);
  assert.equal(widths.tocMax, 560);
  assert.equal(1200 - 3 * 40 - widths.navigationWidth - widths.tocWidth, 240);
});

test('1920px drag limits are set by the current other panel and the article minimum', () => {
  const current = resolve();
  assert.equal(current.navigationMax, 1320);
  assert.equal(current.tocMax, 1280);

  const navigationDragged = resolve({ navigationWidth: current.navigationMax, tocWidth: current.tocWidth });
  assert.equal(navigationDragged.navigationWidth, 1320);
  assert.equal(navigationDragged.tocWidth, current.tocWidth);
  assert.equal(1920 - 3 * 40 - navigationDragged.navigationWidth - navigationDragged.tocWidth, 240);

  const tocDragged = resolve({ navigationWidth: current.navigationWidth, tocWidth: current.tocMax });
  assert.equal(tocDragged.navigationWidth, current.navigationWidth);
  assert.equal(tocDragged.tocWidth, 1280);
  assert.equal(1920 - 3 * 40 - tocDragged.navigationWidth - tocDragged.tocWidth, 240);
});

test('hiding either panel releases its width and removes the TOC gap when absent', () => {
  const noNavigation = resolve({ viewportWidth: 1200, navigationVisible: false, navigationWidth: 900, tocWidth: 900 });
  assert.equal(noNavigation.navigationWidth, 900);
  assert.equal(noNavigation.tocWidth, 840);
  assert.equal(noNavigation.tocMax, 840);

  const noToc = resolve({ viewportWidth: 1200, tocVisible: false, navigationWidth: 900, tocWidth: 900 });
  assert.equal(noToc.navigationWidth, 880);
  assert.equal(noToc.navigationMax, 880);
  assert.equal(noToc.tocWidth, 900);

  const narrowNoToc = resolve({ viewportWidth: 768, tocVisible: false, navigationWidth: 900 });
  assert.equal(narrowNoToc.navigationWidth, 464);
  assert.equal(narrowNoToc.navigationMax, 464);
  assert.equal(768 - 2 * 32 - narrowNoToc.navigationWidth, 240);
});

test('viewport shrink keeps the navigation preference first and widening restores both preferences', () => {
  const preferences = { navigationWidth: 900, tocWidth: 500 };
  const wide = resolve({ viewportWidth: 1920, ...preferences });
  assert.equal(wide.navigationWidth, 900);
  assert.equal(wide.tocWidth, 500);

  const narrow = resolve({ viewportWidth: 1200, ...preferences });
  assert.equal(narrow.navigationWidth, 660);
  assert.equal(narrow.tocWidth, 180);
  assert.equal(narrow.navigationMax, 660);
  assert.equal(narrow.tocMax, 180);
  assert.equal(1200 - 3 * 40 - narrow.navigationWidth - narrow.tocWidth, 240);

  assert.deepEqual(resolve({ viewportWidth: 1920, ...preferences }), wide);
});

test('extremely large finite preferences are constrained only for visible panels', () => {
  const preferences = { navigationWidth: Number.MAX_VALUE, tocWidth: Number.MAX_VALUE };
  const visible = resolve(preferences);
  assert.equal(visible.navigationWidth, 1380);
  assert.equal(visible.tocWidth, 180);
  assert.equal(1920 - 3 * 40 - visible.navigationWidth - visible.tocWidth, 240);

  const hidden = resolve({ viewportWidth: 320, navigationVisible: false, tocVisible: false, ...preferences });
  assert.equal(hidden.navigationWidth, Number.MAX_VALUE);
  assert.equal(hidden.tocWidth, Number.MAX_VALUE);

  const noNavigation = resolve({ navigationVisible: false, ...preferences });
  assert.equal(noNavigation.navigationWidth, Number.MAX_VALUE);
  assert.equal(noNavigation.tocWidth, 1560);
});

test('malformed dimensions and preferences always produce finite nonnegative widths', () => {
  for (const viewportWidth of [NaN, Infinity, -Infinity, -320, 0, 320, 768, Number.MAX_VALUE]) {
    for (const preference of [NaN, Infinity, -Infinity, -100, undefined]) {
      const widths = resolve({ viewportWidth, navigationWidth: preference, tocWidth: preference });
      for (const width of Object.values(widths)) {
        assert.ok(Number.isFinite(width));
        assert.ok(width >= 0);
      }
      assert.ok(widths.navigationWidth >= widths.navigationMin);
      assert.ok(widths.navigationWidth <= widths.navigationMax);
      assert.ok(widths.tocWidth >= widths.tocMin);
      assert.ok(widths.tocWidth <= widths.tocMax);
    }
  }
});
