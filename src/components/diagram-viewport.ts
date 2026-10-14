export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DiagramTransform extends Point {
  scale: number;
}

const FIT_PADDING = 24;
const MIN_VISIBLE_SIZE = 64;

/** Place the complete diagram in the viewport without enlarging small diagrams. */
export function fitDiagram(diagram: Size, viewport: Size): DiagramTransform {
  const scale = Math.min(
    1,
    Math.max(1, viewport.width - FIT_PADDING * 2) / diagram.width,
    Math.max(1, viewport.height - FIT_PADDING * 2) / diagram.height,
  );

  return {
    x: (viewport.width - diagram.width * scale) / 2,
    y: (viewport.height - diagram.height * scale) / 2,
    scale,
  };
}

/** Move the content under `from` to `to`, including while a pinch changes scale. */
export function zoomDiagram(
  view: DiagramTransform,
  requestedScale: number,
  from: Point,
  to: Point,
  minScale: number,
  maxScale: number,
): DiagramTransform {
  const scale = Math.min(maxScale, Math.max(minScale, requestedScale));
  const ratio = scale / view.scale;

  return {
    x: to.x - (from.x - view.x) * ratio,
    y: to.y - (from.y - view.y) * ratio,
    scale,
  };
}

/** Keep a recoverable portion of the diagram visible without preventing panning. */
export function constrainDiagram(
  view: DiagramTransform,
  diagram: Size,
  viewport: Size,
): DiagramTransform {
  const width = diagram.width * view.scale;
  const height = diagram.height * view.scale;
  const visibleWidth = Math.min(MIN_VISIBLE_SIZE, width, viewport.width);
  const visibleHeight = Math.min(MIN_VISIBLE_SIZE, height, viewport.height);

  return {
    x: Math.min(viewport.width - visibleWidth, Math.max(visibleWidth - width, view.x)),
    y: Math.min(viewport.height - visibleHeight, Math.max(visibleHeight - height, view.y)),
    scale: view.scale,
  };
}
