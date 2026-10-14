import test from 'node:test';
import assert from 'node:assert/strict';
import { constrainDiagram, fitDiagram, zoomDiagram } from '../src/components/diagram-viewport.ts';

const closeTo = (actual, expected) => {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be close to ${expected}`);
};

const diagramPointAt = (view, point) => ({
  x: (point.x - view.x) / view.scale,
  y: (point.y - view.y) / view.scale,
});

const assertSameContentAt = (before, from, after, to) => {
  const expected = diagramPointAt(before, from);
  const actual = diagramPointAt(after, to);
  closeTo(actual.x, expected.x);
  closeTo(actual.y, expected.y);
};

test('fit centers wide and tall diagrams with 24px padding on the limiting axis', () => {
  for (const [diagram, viewport] of [
    [{ width: 1800, height: 300 }, { width: 1200, height: 800 }],
    [{ width: 300, height: 1800 }, { width: 390, height: 700 }],
  ]) {
    const view = fitDiagram(diagram, viewport);
    closeTo(view.x + diagram.width * view.scale / 2, viewport.width / 2);
    closeTo(view.y + diagram.height * view.scale / 2, viewport.height / 2);
    assert.ok(view.x >= 24);
    assert.ok(view.y >= 24);
    closeTo(Math.min(view.x, view.y), 24);
  }
});

test('fit leaves small diagrams at natural size', () => {
  assert.deepEqual(
    fitDiagram({ width: 200, height: 100 }, { width: 1200, height: 800 }),
    { x: 500, y: 350, scale: 1 },
  );
});

test('fit supports huge diagrams without a minimum scale that crops the diagram', () => {
  const diagram = { width: 1_000_000, height: 2_000_000 };
  const viewport = { width: 390, height: 700 };
  const view = fitDiagram(diagram, viewport);
  assert.ok(view.scale < 0.001);
  closeTo(diagram.height * view.scale, viewport.height - 48);
  closeTo(view.y, 24);
  assert.ok(diagram.width * view.scale <= viewport.width - 48);
});

test('fit keeps finite, positive scale while the viewport has not been measured', () => {
  for (const viewport of [{ width: 0, height: 0 }, { width: 20, height: 30 }]) {
    const view = fitDiagram({ width: 1000, height: 600 }, viewport);
    assert.ok(Object.values(view).every(Number.isFinite));
    assert.ok(view.scale > 0);
    closeTo(view.x + 1000 * view.scale / 2, viewport.width / 2);
    closeTo(view.y + 600 * view.scale / 2, viewport.height / 2);
  }
});

test('wheel zoom keeps content under an off-center mouse pointer fixed', () => {
  const initial = { x: -120, y: 80, scale: 0.75 };
  const pointer = { x: 217, y: 451 };
  const enlarged = zoomDiagram(initial, 2.5, pointer, pointer, 0.1, 8);
  assert.equal(enlarged.scale, 2.5);
  assertSameContentAt(initial, pointer, enlarged, pointer);

  const restored = zoomDiagram(enlarged, initial.scale, pointer, pointer, 0.1, 8);
  closeTo(restored.x, initial.x);
  closeTo(restored.y, initial.y);
  assert.equal(restored.scale, initial.scale);
});

test('pinch can translate its center while scaling around the same diagram content', () => {
  const before = { x: 40, y: -120, scale: 0.5 };
  const from = { x: 110, y: 250 };
  const to = { x: 150, y: 290 };
  const after = zoomDiagram(before, 0.8, from, to, 0.1, 8);
  assertSameContentAt(before, from, after, to);
  closeTo(after.scale, 0.8);

  const translated = zoomDiagram(after, after.scale, to, { x: 160, y: 270 }, 0.1, 8);
  closeTo(translated.x, after.x + 10);
  closeTo(translated.y, after.y - 20);
});

test('zoom clamps scale before calculating translation at both limits', () => {
  const from = { x: 215, y: 381 };
  const to = { x: 240, y: 350 };
  const initial = { x: -150, y: 70, scale: 1 };
  for (const [request, expected] of [[0.01, 0.2], [30, 8]]) {
    const limited = zoomDiagram(initial, request, from, to, 0.2, 8);
    assert.equal(limited.scale, expected);
    assertSameContentAt(initial, from, limited, to);

    const repeated = zoomDiagram(limited, request, to, to, 0.2, 8);
    closeTo(repeated.x, limited.x);
    closeTo(repeated.y, limited.y);
    assert.equal(repeated.scale, limited.scale);

    const panned = zoomDiagram(limited, request, to, { x: to.x + 20, y: to.y - 10 }, 0.2, 8);
    closeTo(panned.x, limited.x + 20);
    closeTo(panned.y, limited.y - 10);
  }
});

test('panning a large diagram to any extreme retains 64px on both axes', () => {
  const diagram = { width: 1000, height: 800 };
  const viewport = { width: 390, height: 600 };
  for (const x of [-1e6, 1e6]) {
    for (const y of [-1e6, 1e6]) {
      const view = constrainDiagram({ x, y, scale: 2 }, diagram, viewport);
      const visibleWidth = Math.min(viewport.width, view.x + 2000) - Math.max(0, view.x);
      const visibleHeight = Math.min(viewport.height, view.y + 1600) - Math.max(0, view.y);
      assert.equal(visibleWidth, 64);
      assert.equal(visibleHeight, 64);
      assert.equal(view.scale, 2);
    }
  }
});

test('panning small diagrams keeps their entire size visible', () => {
  const diagram = { width: 20, height: 30 };
  const viewport = { width: 390, height: 600 };
  assert.deepEqual(
    constrainDiagram({ x: -1000, y: -1000, scale: 1 }, diagram, viewport),
    { x: 0, y: 0, scale: 1 },
  );
  assert.deepEqual(
    constrainDiagram({ x: 1000, y: 1000, scale: 1 }, diagram, viewport),
    { x: 370, y: 570, scale: 1 },
  );
});

test('tiny viewports retain their full width and height inside a large diagram', () => {
  const diagram = { width: 1000, height: 800 };
  const viewport = { width: 30, height: 40 };
  assert.deepEqual(
    constrainDiagram({ x: 1000, y: -1000, scale: 1 }, diagram, viewport),
    { x: 0, y: -760, scale: 1 },
  );
});

test('constrain preserves ordinary panning and a newly fitted diagram', () => {
  const diagram = { width: 1000, height: 800 };
  const viewport = { width: 1200, height: 800 };
  const panned = { x: -200, y: 150, scale: 1.2 };
  assert.deepEqual(constrainDiagram(panned, diagram, viewport), panned);
  const fitted = fitDiagram(diagram, viewport);
  assert.deepEqual(constrainDiagram(fitted, diagram, viewport), fitted);
});
