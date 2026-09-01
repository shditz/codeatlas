import type {
  ServiceNode,
  ServiceEndpoint,
  CrossServiceEdge,
  MultiRepoSchema,
} from '@codeatlas-ai/core';
import type { AtlasDatabase } from '@codeatlas-ai/storage';
import { FileRepository, SymbolRepository, DependencyRepository } from '@codeatlas-ai/storage';

export class MultiRepoAggregator {
  constructor(_options: { fuzzyMatching?: boolean } = {}) {}

  exportServiceSchema(
    db: AtlasDatabase,
    projectId: number,
    serviceName: string,
    workspaceRoot: string,
  ): ServiceNode {
    const fileRepo = new FileRepository(db);
    const symRepo = new SymbolRepository(db);
    const depRepo = new DependencyRepository(db);

    const files = fileRepo.getAll(projectId);
    const symbols = symRepo.getAllByProject(projectId);
    const deps = depRepo.getAll(projectId);

    const exportedApis: ServiceEndpoint[] = [];
    const consumedApis: ServiceEndpoint[] = [];
    const internalDependencies = new Set<string>();

    for (const sym of symbols) {
      const sig = (sym.signature || '').toLowerCase();
      const name = sym.name.toLowerCase();

      const isRoute =
        sym.kind === 'route_handler' ||
        sig.includes('@get') ||
        sig.includes('@post') ||
        sig.includes('@put') ||
        sig.includes('@delete') ||
        sig.includes('router.') ||
        sig.includes('app.get') ||
        sig.includes('app.post') ||
        name.endsWith('controller') ||
        name.endsWith('handler') ||
        name.endsWith('route');

      if (isRoute) {
        const pathMatch =
          (sym.signature || '').match(/['"`](\/[a-zA-Z0-9_\-/{}:]+)['"`]/) ||
          sym.name.match(/^(\/[a-zA-Z0-9_\-/{}:]+)/);

        const routePath = pathMatch
          ? pathMatch[1]
          : `/${sym.name.replace(/controller|handler/gi, '').toLowerCase()}`;
        let method = 'GET';
        if (sig.includes('post') || sig.includes('@post')) method = 'POST';
        else if (sig.includes('put') || sig.includes('@put')) method = 'PUT';
        else if (sig.includes('delete') || sig.includes('@delete')) method = 'DELETE';
        else if (sig.includes('patch') || sig.includes('@patch')) method = 'PATCH';

        exportedApis.push({
          path: routePath || `/${sym.name}`,
          method,
          protocol: 'http',
          handler: sym.name,
          sourceFile: sym.filePath,
        });
      }

      const isClientCall =
        sig.includes('fetch(') ||
        sig.includes('axios.') ||
        sig.includes('http.') ||
        name.includes('client') ||
        name.includes('apicall') ||
        name.includes('servicecaller');

      if (isClientCall) {
        const urlMatch = (sym.signature || '').match(
          /['"`]((?:https?:\/\/[^'"`]+)|\/[a-zA-Z0-9_\-/{}:]+)['"`]/,
        );
        if (urlMatch && urlMatch[1]) {
          consumedApis.push({
            path: urlMatch[1],
            method: 'GET',
            protocol: 'http',
            sourceFile: sym.filePath,
          });
        }
      }
    }

    for (const d of deps) {
      if (d.target.startsWith('@') || !d.target.startsWith('.')) {
        const pkgName = d.target.split('/')[0] || d.target;
        internalDependencies.add(pkgName);
      }
    }

    return {
      id: serviceName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name: serviceName,
      rootPath: workspaceRoot,
      fileCount: files.length,
      symbolCount: symbols.length,
      exportedApis,
      consumedApis,
      dependencies: Array.from(internalDependencies),
    };
  }

  aggregate(services: ServiceNode[]): MultiRepoSchema {
    const edges = this.findCrossServiceEdges(services);

    return {
      schemaVersion: '1.0',
      timestamp: new Date().toISOString(),
      name: `Multi-Repo Global Ecosystem (${services.length} services)`,
      services,
      crossServiceEdges: edges,
    };
  }

  findCrossServiceEdges(services: ServiceNode[]): CrossServiceEdge[] {
    const edges: CrossServiceEdge[] = [];
    const serviceMap = new Map<string, ServiceNode>();

    for (const s of services) {
      serviceMap.set(s.id, s);
      serviceMap.set(s.name.toLowerCase(), s);
    }

    for (const source of services) {
      for (const consumed of source.consumedApis) {
        const consumedPath = this.normalizeApiPath(consumed.path);

        for (const target of services) {
          if (target.id === source.id) continue;

          for (const exported of target.exportedApis) {
            const exportedPath = this.normalizeApiPath(exported.path);

            if (this.pathsMatch(consumedPath, exportedPath)) {
              edges.push({
                id: `edge_${source.id}_to_${target.id}_api_${consumedPath.replace(/[^a-z0-9]/g, '_')}`,
                sourceService: source.id,
                targetService: target.id,
                type: 'api_call',
                protocol: exported.protocol,
                endpoint: exported.path,
                weight: 2,
                description: `${source.name} calls ${target.name} endpoint ${exported.path}`,
              });
            }
          }
        }
      }

      for (const dep of source.dependencies) {
        for (const target of services) {
          if (target.id === source.id) continue;
          if (
            target.name.toLowerCase() === dep.toLowerCase() ||
            target.id === dep.toLowerCase() ||
            (target.name.startsWith('@') && dep.includes(target.name.split('/')[1] || ''))
          ) {
            edges.push({
              id: `edge_${source.id}_to_${target.id}_dep_${dep.replace(/[^a-z0-9]/g, '_')}`,
              sourceService: source.id,
              targetService: target.id,
              type: 'package_dep',
              weight: 1,
              description: `${source.name} imports shared module from ${target.name}`,
            });
          }
        }
      }
    }

    const unique = new Map<string, CrossServiceEdge>();
    for (const e of edges) {
      const key = `${e.sourceService}->${e.targetService}:${e.type}:${e.endpoint || ''}`;
      if (!unique.has(key)) {
        unique.set(key, e);
      }
    }

    return Array.from(unique.values());
  }

  private normalizeApiPath(p: string): string {
    return p
      .replace(/^https?:\/\/[^/]+/, '')
      .split('?')[0]!
      .replace(/\/+/g, '/')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  private pathsMatch(p1: string, p2: string): boolean {
    if (!p1 || !p2) return false;
    if (p1 === p2) return true;

    const segs1 = p1.split('/');
    const segs2 = p2.split('/');
    if (segs1.length !== segs2.length) return false;

    for (let i = 0; i < segs1.length; i++) {
      const s1 = segs1[i]!;
      const s2 = segs2[i]!;
      if (s1.startsWith(':') || s1.startsWith('{') || s2.startsWith(':') || s2.startsWith('{')) {
        continue;
      }
      if (s1 !== s2) return false;
    }
    return true;
  }

  toGraphData(schema: MultiRepoSchema): {
    nodes: Array<{
      id: string;
      label: string;
      type: 'service' | 'endpoint';
      cluster?: string;
      size: number;
      metrics?: { fileCount: number; symbolCount: number };
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: string;
      label?: string;
      weight?: number;
    }>;
  } {
    const nodes: Array<{
      id: string;
      label: string;
      type: 'service' | 'endpoint';
      cluster?: string;
      size: number;
      metrics?: { fileCount: number; symbolCount: number };
    }> = [];

    const edges: Array<{
      source: string;
      target: string;
      type: string;
      label?: string;
      weight?: number;
    }> = [];

    for (const service of schema.services) {
      nodes.push({
        id: `svc_${service.id}`,
        label: `🏢 ${service.name}`,
        type: 'service',
        cluster: service.name,
        size: Math.max(25, Math.min(60, 15 + Math.sqrt(service.fileCount) * 5)),
        metrics: {
          fileCount: service.fileCount,
          symbolCount: service.symbolCount,
        },
      });

      for (const api of service.exportedApis.slice(0, 8)) {
        const apiNodeId = `api_${service.id}_${api.method || 'GET'}_${api.path.replace(/[^a-z0-9]/gi, '_')}`;
        nodes.push({
          id: apiNodeId,
          label: `${api.method || 'GET'} ${api.path}`,
          type: 'endpoint',
          cluster: service.name,
          size: 14,
        });

        edges.push({
          source: `svc_${service.id}`,
          target: apiNodeId,
          type: 'contains_api',
          weight: 1,
        });
      }
    }

    for (const edge of schema.crossServiceEdges) {
      edges.push({
        source: `svc_${edge.sourceService}`,
        target: `svc_${edge.targetService}`,
        type: edge.type,
        label: edge.endpoint ? `${edge.type}: ${edge.endpoint}` : edge.type,
        weight: edge.weight ?? 2,
      });
    }

    return { nodes, edges };
  }
}
