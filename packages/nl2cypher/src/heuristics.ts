export class HeuristicQueryGenerator {
  generate(nlPrompt: string): string | null {
    const raw = nlPrompt.trim();

    const knownLangs = [
      'typescript',
      'javascript',
      'python',
      'php',
      'go',
      'rust',
      'java',
      'html',
      'css',
      'scss',
      'sql',
      'c',
      'cpp',
      'ruby',
      'csharp',
      'swift',
      'kotlin',
    ];

    if (/\b(file|files|berkas|dokumen|code|source)\b/i.test(raw)) {
      for (const lang of knownLangs) {
        const langRegex = new RegExp(`\\b${lang}\\b`, 'i');
        if (langRegex.test(raw)) {
          return `MATCH (f:File) WHERE f.language = '${lang}' RETURN f`;
        }
      }
    }

    const callsMatch = raw.match(
      /(?:who calls|siapa yang memanggil|fungsi yang memanggil|calls to)\s+['"]?([a-zA-Z0-9_$]+)['"]?/i,
    );
    if (callsMatch && callsMatch[1]) {
      return `MATCH (caller:Symbol)-[:CALLS]->(target:Symbol) WHERE target.name = '${callsMatch[1]}' RETURN caller`;
    }

    const calleeMatch = raw.match(
      /(?:what does|fungsi yang dipanggil oleh)\s+['"]?([a-zA-Z0-9_$]+)['"]?\s*(?:call)?/i,
    );
    if (calleeMatch && calleeMatch[1]) {
      return `MATCH (caller:Symbol)-[:CALLS]->(target:Symbol) WHERE caller.name = '${calleeMatch[1]}' RETURN target`;
    }

    const importMatch = raw.match(
      /(?:files importing|file yang (?:meng)?import|which files import|who imports)\s+['"]?([a-zA-Z0-9._\-/]+)['"]?/i,
    );
    if (importMatch && importMatch[1]) {
      return `MATCH (f:File)-[:IMPORTS]->(t:File) WHERE t.name CONTAINS '${importMatch[1]}' RETURN f`;
    }

    const fileImportsMatch = raw.match(
      /(?:what does|apa yang di(?:-|\s*)?import oleh)\s+['"]?([a-zA-Z0-9._\-/]+)['"]?\s*(?:import)?/i,
    );
    if (fileImportsMatch && fileImportsMatch[1]) {
      return `MATCH (f:File)-[:IMPORTS]->(t:File) WHERE f.name CONTAINS '${fileImportsMatch[1]}' RETURN t`;
    }

    const funcMatch = raw.match(
      /(?:find function|cari fungsi|search function)\s+['"]?([a-zA-Z0-9_$]+)['"]?/i,
    );
    if (funcMatch && funcMatch[1]) {
      return `MATCH (s:Symbol) WHERE s.name CONTAINS '${funcMatch[1]}' RETURN s`;
    }

    const classMatch = raw.match(
      /(?:find class|cari class|cari kelas)\s+['"]?([a-zA-Z0-9_$]+)['"]?/i,
    );
    if (classMatch && classMatch[1]) {
      return `MATCH (s:Symbol) WHERE s.name CONTAINS '${classMatch[1]}' RETURN s`;
    }

    const fileMatch = raw.match(
      /(?:find file|cari file|search file)\s+['"]?([a-zA-Z0-9._\-/]+)['"]?/i,
    );
    if (fileMatch && fileMatch[1]) {
      return `MATCH (f:File) WHERE f.name CONTAINS '${fileMatch[1]}' RETURN f`;
    }

    const genericMatch = raw.match(/(?:find|cari|search)\s+['"]?([a-zA-Z0-9._\-/]+)['"]?/i);
    if (genericMatch && genericMatch[1]) {
      return `MATCH (s:Symbol) WHERE s.name CONTAINS '${genericMatch[1]}' RETURN s`;
    }

    return null;
  }
}
