import type { Language } from '@codeatlas/core';

/**
 * Generate a structural skeleton of the code by stripping function/method bodies
 * while preserving imports, types, interfaces, class declarations, and function signatures.
 */
export function generateSkeleton(code: string, language: Language): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return generateTypeScriptSkeleton(code);
    case 'python':
      return generatePythonSkeleton(code);
    case 'go':
      return generateGoSkeleton(code);
    case 'rust':
      return generateRustSkeleton(code);
    default:
      return generateGenericBraceSkeleton(code);
  }
}

/**
 * TypeScript / JavaScript Skeleton Generator
 */
function generateTypeScriptSkeleton(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  let inComment = false;
  let braceDepth = 0;
  let inFunctionBody = false;
  let functionBodyDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const line = rawLine.trim();

    // Multiline comment tracking
    if (line.startsWith('/*') && !line.includes('*/')) {
      inComment = true;
      result.push(rawLine);
      continue;
    }
    if (inComment) {
      result.push(rawLine);
      if (line.includes('*/')) inComment = false;
      continue;
    }

    // Keep comments, imports, exports, types, interfaces
    if (
      line.startsWith('//') ||
      line.startsWith('import ') ||
      line.startsWith('export type ') ||
      line.startsWith('type ') ||
      line.startsWith('export interface ') ||
      line.startsWith('interface ') ||
      line.startsWith('export enum ') ||
      line.startsWith('enum ') ||
      line.startsWith('export default ') && !line.includes('function')
    ) {
      result.push(rawLine);
      continue;
    }

    // Check if line defines a function or method start
    const isFunctionHeader =
      /^(export\s+)?(async\s+)?function\b/.test(line) ||
      /^(public\s+|private\s+|protected\s+|static\s+|async\s+)*(constructor|get\s+\w+|set\s+\w+|\w+)\s*\([^)]*\)\s*(:\s*[^;{]+)?\s*\{?$/.test(line) ||
      /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*(:\s*[^=>]+)?\s*=>\s*\{?$/.test(line);

    // If currently skipping function body
    if (inFunctionBody) {
      const openCount = (rawLine.match(/\{/g) || []).length;
      const closeCount = (rawLine.match(/\}/g) || []).length;
      braceDepth += openCount - closeCount;

      if (braceDepth <= functionBodyDepth) {
        inFunctionBody = false;
        // Function ended
        const indent = ' '.repeat(rawLine.search(/\S/) > -1 ? rawLine.search(/\S/) : 2);
        result.push(`${indent}}`);
      }
      continue;
    }

    if (isFunctionHeader && line.includes('{')) {
      const headerPart = rawLine.substring(0, rawLine.indexOf('{')).trimEnd();
      const openCount = (rawLine.match(/\{/g) || []).length;
      const closeCount = (rawLine.match(/\}/g) || []).length;
      
      // If closed on same line (e.g. () => {})
      if (openCount === closeCount && openCount > 0) {
        result.push(`${headerPart} { /* ... */ }`);
      } else {
        functionBodyDepth = braceDepth;
        braceDepth += openCount - closeCount;
        inFunctionBody = true;
        result.push(`${headerPart} { /* [implementation hidden] */`);
      }
      continue;
    }

    // Keep class headers, properties, etc.
    const openCount = (rawLine.match(/\{/g) || []).length;
    const closeCount = (rawLine.match(/\}/g) || []).length;
    braceDepth += openCount - closeCount;

    result.push(rawLine);
  }

  return result.join('\n');
}

/**
 * Python Skeleton Generator
 */
function generatePythonSkeleton(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  let inDef = false;
  let defIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      if (!inDef) result.push(rawLine);
      continue;
    }

    const currentIndent = rawLine.search(/\S/);

    if (inDef) {
      if (currentIndent > defIndent) {
        // Still inside def body, skip
        continue;
      } else {
        // Exited def body
        inDef = false;
      }
    }

    if (/^(async\s+)?def\s+\w+\s*\(/.test(trimmed)) {
      result.push(rawLine);
      const indentStr = ' '.repeat(currentIndent + 4);
      result.push(`${indentStr}... # [implementation hidden]`);
      inDef = true;
      defIndent = currentIndent;
      continue;
    }

    result.push(rawLine);
  }

  return result.join('\n');
}

/**
 * Go Skeleton Generator
 */
function generateGoSkeleton(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  let inFunc = false;
  let braceDepth = 0;
  let funcDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (inFunc) {
      const openCount = (rawLine.match(/\{/g) || []).length;
      const closeCount = (rawLine.match(/\}/g) || []).length;
      braceDepth += openCount - closeCount;

      if (braceDepth <= funcDepth) {
        inFunc = false;
        result.push('}');
      }
      continue;
    }

    if (/^func\s+/.test(trimmed) && trimmed.includes('{')) {
      const header = rawLine.substring(0, rawLine.indexOf('{')).trimEnd();
      const openCount = (rawLine.match(/\{/g) || []).length;
      const closeCount = (rawLine.match(/\}/g) || []).length;

      if (openCount === closeCount && openCount > 0) {
        result.push(`${header} { /* ... */ }`);
      } else {
        funcDepth = braceDepth;
        braceDepth += openCount - closeCount;
        inFunc = true;
        result.push(`${header} { /* [implementation hidden] */`);
      }
      continue;
    }

    const openCount = (rawLine.match(/\{/g) || []).length;
    const closeCount = (rawLine.match(/\}/g) || []).length;
    braceDepth += openCount - closeCount;

    result.push(rawLine);
  }

  return result.join('\n');
}

/**
 * Rust Skeleton Generator
 */
function generateRustSkeleton(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  let inFn = false;
  let braceDepth = 0;
  let fnDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (inFn) {
      const openCount = (rawLine.match(/\{/g) || []).length;
      const closeCount = (rawLine.match(/\}/g) || []).length;
      braceDepth += openCount - closeCount;

      if (braceDepth <= fnDepth) {
        inFn = false;
        result.push('}');
      }
      continue;
    }

    if (/^(pub\s+)?(async\s+)?fn\s+/.test(trimmed) && trimmed.includes('{')) {
      const header = rawLine.substring(0, rawLine.indexOf('{')).trimEnd();
      const openCount = (rawLine.match(/\{/g) || []).length;
      const closeCount = (rawLine.match(/\}/g) || []).length;

      if (openCount === closeCount && openCount > 0) {
        result.push(`${header} { /* ... */ }`);
      } else {
        fnDepth = braceDepth;
        braceDepth += openCount - closeCount;
        inFn = true;
        result.push(`${header} { /* [implementation hidden] */`);
      }
      continue;
    }

    const openCount = (rawLine.match(/\{/g) || []).length;
    const closeCount = (rawLine.match(/\}/g) || []).length;
    braceDepth += openCount - closeCount;

    result.push(rawLine);
  }

  return result.join('\n');
}

/**
 * Generic Brace-based Skeleton Generator
 */
function generateGenericBraceSkeleton(code: string): string {
  return generateTypeScriptSkeleton(code);
}
