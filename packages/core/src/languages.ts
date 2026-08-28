import type { Language } from './models.js';

const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.php': 'php',
  '.phtml': 'php',
};

const FILENAME_TO_LANGUAGE: Record<string, Language> = {
  Dockerfile: 'dockerfile',
  Makefile: 'shell',
};

export function detectLanguage(filePath: string): Language {
  const basename = filePath.split('/').pop() ?? '';

  const filenameMatch = FILENAME_TO_LANGUAGE[basename];
  if (filenameMatch) {
    return filenameMatch;
  }

  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex === -1) {
    return 'unknown';
  }

  const ext = basename.slice(dotIndex).toLowerCase();

  if (EXTENSION_TO_LANGUAGE[ext]) {
    return EXTENSION_TO_LANGUAGE[ext];
  }

  // Return the extension without the dot (e.g., '.vue' -> 'vue')
  // Ensure we only return alphanumeric extensions, otherwise 'unknown'
  const extName = ext.slice(1);
  return /^[a-z0-9]+$/.test(extName) ? extName : 'unknown';
}

export function isParseableLanguage(language: Language): boolean {
  return (
    language === 'typescript' ||
    language === 'javascript' ||
    language === 'python' ||
    language === 'go' ||
    language === 'rust'
  );
}

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.startsWith('__tests__/') ||
    normalized.includes('__tests__/') ||
    normalized.includes('__test__/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('_test.') ||
    normalized.includes('_spec.')
  );
}

export function isGeneratedFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.startsWith('dist/') ||
    normalized.startsWith('build/') ||
    normalized.startsWith('out/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/build/') ||
    normalized.includes('/out/') ||
    normalized.includes('.min.') ||
    normalized.includes('.generated.') ||
    normalized.includes('.d.ts') ||
    normalized.includes('/coverage/') ||
    normalized.startsWith('coverage/') ||
    normalized.includes('/__generated__/')
  );
}

const PARSEABLE_LANGUAGES: Set<Language> = new Set([
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
]);

export function canParse(language: Language): boolean {
  return PARSEABLE_LANGUAGES.has(language);
}
