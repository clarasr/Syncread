import { SyncAnchor } from "./fuzzy-matcher";

export interface SyncPoint {
  audioTime: number;
  textIndex: number;
}

export function calculateSyncPoints(
  anchors: SyncAnchor[],
  totalDuration: number,
  totalTextLength: number
): SyncPoint[] {
  if (anchors.length === 0) {
    // No anchors, create linear sync
    return [
      { audioTime: 0, textIndex: 0 },
      { audioTime: totalDuration, textIndex: totalTextLength },
    ];
  }

  // Sort anchors by confidence and time
  const sortedAnchors = [...anchors].sort((a, b) => b.confidence - a.confidence);

  // Take top anchors (filter out overlapping ones)
  const selectedAnchors: SyncAnchor[] = [];
  const MIN_TIME_GAP = 30; // seconds
  const MIN_TEXT_GAP = 500; // characters

  for (const anchor of sortedAnchors) {
    const hasOverlap = selectedAnchors.some(
      (existing) =>
        Math.abs(existing.audioTime - anchor.audioTime) < MIN_TIME_GAP ||
        Math.abs(existing.textIndex - anchor.textIndex) < MIN_TEXT_GAP
    );

    if (!hasOverlap) {
      selectedAnchors.push(anchor);
    }
  }

  // Sort selected anchors by time
  selectedAnchors.sort((a, b) => a.audioTime - b.audioTime);

  // Add start and end points if missing
  const syncPoints: SyncPoint[] = [];

  if (selectedAnchors[0]?.audioTime > 5) {
    syncPoints.push({ audioTime: 0, textIndex: 0 });
  }

  syncPoints.push(...selectedAnchors.map(a => ({ audioTime: a.audioTime, textIndex: a.textIndex })));

  const lastAnchor = selectedAnchors[selectedAnchors.length - 1];
  if (lastAnchor && lastAnchor.audioTime < totalDuration - 30) {
    syncPoints.push({
      audioTime: totalDuration,
      textIndex: totalTextLength,
    });
  }

  return syncPoints;
}

export function interpolateSync(
  syncPoints: SyncPoint[],
  audioTime: number
): number {
  if (syncPoints.length === 0) return 0;
  if (syncPoints.length === 1) return syncPoints[0].textIndex;

  // Find the two sync points to interpolate between
  let before = syncPoints[0];
  let after = syncPoints[syncPoints.length - 1];

  for (let i = 0; i < syncPoints.length - 1; i++) {
    if (
      audioTime >= syncPoints[i].audioTime &&
      audioTime <= syncPoints[i + 1].audioTime
    ) {
      before = syncPoints[i];
      after = syncPoints[i + 1];
      break;
    }
  }

  // Linear interpolation
  const timeDiff = after.audioTime - before.audioTime;
  const textDiff = after.textIndex - before.textIndex;

  if (timeDiff === 0) return before.textIndex;

  const ratio = (audioTime - before.audioTime) / timeDiff;
  const textIndex = before.textIndex + ratio * textDiff;

  return Math.round(textIndex);
}
