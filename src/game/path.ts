import type { Cell, Vector2 } from '@/src/game/types';

export type PolylineData = {
  points: Vector2[];
  segmentLengths: number[];
  totalLength: number;
};

export function toCellKey(cell: Cell): string {
  return `${cell.col}:${cell.row}`;
}

export function cellCenter(cell: Cell): Vector2 {
  return {
    x: cell.col + 0.5,
    y: cell.row + 0.5,
  };
}

export function isCellInBounds(cell: Cell, cols: number, rows: number): boolean {
  return cell.col >= 0 && cell.col < cols && cell.row >= 0 && cell.row < rows;
}

export function expandPathCells(waypoints: Cell[]): Cell[] {
  const cells: Cell[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const start = waypoints[index];
    const end = waypoints[index + 1];

    if (start.col !== end.col && start.row !== end.row) {
      throw new Error('Path segments must be horizontal or vertical');
    }

    const colStep = Math.sign(end.col - start.col);
    const rowStep = Math.sign(end.row - start.row);
    const steps = Math.max(Math.abs(end.col - start.col), Math.abs(end.row - start.row));

    for (let step = 0; step <= steps; step += 1) {
      const nextCell = {
        col: start.col + colStep * step,
        row: start.row + rowStep * step,
      };
      const key = toCellKey(nextCell);
      if (!seen.has(key)) {
        seen.add(key);
        cells.push(nextCell);
      }
    }
  }

  return cells;
}

export function buildPolylineData(waypoints: Cell[]): PolylineData {
  const points = waypoints.map(cellCenter);

  if (points.length < 2) {
    throw new Error('Path requires at least 2 waypoints');
  }

  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    segmentLengths.push(distance);
    totalLength += distance;
  }

  return {
    points,
    segmentLengths,
    totalLength,
  };
}

export function samplePolyline(polyline: PolylineData, distance: number): Vector2 {
  if (distance <= 0) {
    return polyline.points[0];
  }

  if (distance >= polyline.totalLength) {
    return polyline.points[polyline.points.length - 1];
  }

  let walked = 0;

  for (let segmentIndex = 0; segmentIndex < polyline.segmentLengths.length; segmentIndex += 1) {
    const segmentLength = polyline.segmentLengths[segmentIndex];
    if (walked + segmentLength >= distance) {
      const from = polyline.points[segmentIndex];
      const to = polyline.points[segmentIndex + 1];
      const segmentDistance = distance - walked;
      const progress = segmentDistance / segmentLength;
      return {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
    }
    walked += segmentLength;
  }

  return polyline.points[polyline.points.length - 1];
}
