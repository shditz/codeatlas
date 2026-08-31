import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TypeScriptSemanticResolver, resolveProjectSemantics } from '../index.js';

describe('TypeScript Semantic Resolution Engine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-semantic-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('recognizes TypeScript and JavaScript languages', () => {
    const resolver = new TypeScriptSemanticResolver();
    expect(resolver.canResolve('typescript')).toBe(true);
    expect(resolver.canResolve('javascript')).toBe(true);
    expect(resolver.canResolve('rust')).toBe(false);
    expect(resolver.canResolve('python')).toBe(false);
  });

  it('resolves type inheritance (extends & implements) across separate files with confidence 1.0', async () => {
    const serviceInterfacePath = path.join(tmpDir, 'src', 'interfaces', 'user.service.ts');
    const serviceImplPath = path.join(tmpDir, 'src', 'services', 'user.service.impl.ts');
    const baseServicePath = path.join(tmpDir, 'src', 'services', 'base.service.ts');

    fs.mkdirSync(path.dirname(serviceInterfacePath), { recursive: true });
    fs.mkdirSync(path.dirname(serviceImplPath), { recursive: true });

    fs.writeFileSync(
      serviceInterfacePath,
      `export interface IUserService {
  getUser(id: string): { id: string; name: string };
}`,
    );

    fs.writeFileSync(
      baseServicePath,
      `export class BaseService {
  protected log(msg: string): void {
    console.log(msg);
  }
}`,
    );

    fs.writeFileSync(
      serviceImplPath,
      `import { IUserService } from '../interfaces/user.service.js';
import { BaseService } from './base.service.js';

export class UserServiceImpl extends BaseService implements IUserService {
  getUser(id: string) {
    this.log('Getting user');
    return { id, name: 'Alice' };
  }
}`,
    );

    const result = await resolveProjectSemantics(
      ['src/interfaces/user.service.ts', 'src/services/base.service.ts', 'src/services/user.service.impl.ts'],
      { rootDir: tmpDir },
    );

    expect(result.edges.length).toBeGreaterThan(0);

    const extendsEdge = result.edges.find((e) => e.kind === 'extends');
    expect(extendsEdge).toBeDefined();
    expect(extendsEdge?.sourceFile).toBe('src/services/user.service.impl.ts');
    expect(extendsEdge?.targetFile).toBe('src/services/base.service.ts');
    expect(extendsEdge?.confidence).toBe(1.0);
    expect(extendsEdge?.resolution).toBe('semantic-ts');

    const implementsEdge = result.edges.find((e) => e.kind === 'implements');
    expect(implementsEdge).toBeDefined();
    expect(implementsEdge?.sourceFile).toBe('src/services/user.service.impl.ts');
    expect(implementsEdge?.targetFile).toBe('src/interfaces/user.service.ts');
    expect(implementsEdge?.confidence).toBe(1.0);
    expect(implementsEdge?.resolution).toBe('semantic-ts');
  });

  it('accurately resolves tsconfig.json path mappings (@/*)', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@models/*': ['src/models/*'],
            '@components/*': ['src/components/*'],
          },
        },
      }),
    );

    const modelPath = path.join(tmpDir, 'src', 'models', 'user.ts');
    const controllerPath = path.join(tmpDir, 'src', 'controllers', 'user.controller.ts');

    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
    fs.mkdirSync(path.dirname(controllerPath), { recursive: true });

    fs.writeFileSync(modelPath, `export interface User { id: string; role: string; }`);
    fs.writeFileSync(
      controllerPath,
      `import type { User } from '@models/user';

export function handleUser(): User {
  return { id: '1', role: 'admin' };
}`,
    );

    const result = await resolveProjectSemantics(
      ['src/models/user.ts', 'src/controllers/user.controller.ts'],
      { rootDir: tmpDir },
    );

    const importEdge = result.edges.find(
      (e) => e.sourceFile === 'src/controllers/user.controller.ts' && e.targetFile === 'src/models/user.ts',
    );

    expect(importEdge).toBeDefined();
    expect(importEdge?.confidence).toBe(1.0);
    expect(importEdge?.resolution).toBe('semantic-ts');
  });
});
