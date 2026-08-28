import path from 'node:path';

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function toRelativePath(filePath: string, root: string): string {
  return normalizePath(path.relative(root, filePath));
}

export function toAbsolutePath(relativePath: string, root: string): string {
  return normalizePath(path.resolve(root, relativePath));
}

export function getExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext;
}

export function getBasename(filePath: string): string {
  return path.basename(filePath);
}

export function getDirname(filePath: string): string {
  return normalizePath(path.dirname(filePath));
}

export function getModule(filePath: string, root: string): string {
  const rel = toRelativePath(filePath, root);
  const parts = rel.split('/');
  if (parts.length <= 1) {
    return '.';
  }
  return parts.slice(0, -1).join('/');
}

export function isHidden(filePath: string): boolean {
  const basename = path.basename(filePath);
  return basename.startsWith('.') && basename !== '.';
}
