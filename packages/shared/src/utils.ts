import { createHash } from 'node:crypto';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  const unit = units[idx];
  if (!unit) return `${bytes} B`;
  return `${(bytes / Math.pow(1024, idx)).toFixed(idx === 0 ? 0 : 1)} ${unit}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
