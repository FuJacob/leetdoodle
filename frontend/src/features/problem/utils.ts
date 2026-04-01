import type { ProblemStats } from '../../shared/nodes';

// Extract "two-sum" from "https://leetcode.com/problems/two-sum/"
export function extractSlug(url: string): string | null {
  const match = url.match(/leetcode\.com\/problems\/([^/?#]+)/);
  return match ? match[1] : null;
}

export function parseStats(raw: string | null): ProblemStats | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function difficultyClass(d: string) {
  if (d === 'Easy') return 'text-(--lc-success)';
  if (d === 'Hard') return 'text-(--lc-danger)';
  return 'text-(--lc-warning)';
}
