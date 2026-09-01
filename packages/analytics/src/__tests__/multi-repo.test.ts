import { describe, it, expect } from 'vitest';
import { MultiRepoAggregator } from '../index.js';
import type { ServiceNode } from '@codeatlas-ai/core';

describe('MultiRepoAggregator & Cross-Service Ecosystem Discovery', () => {
  const aggregator = new MultiRepoAggregator();

  it('detects REST API calls between microservices', () => {
    const authService: ServiceNode = {
      id: 'auth-service',
      name: 'Auth Service',
      fileCount: 20,
      symbolCount: 85,
      exportedApis: [
        {
          path: '/api/v1/auth/login',
          method: 'POST',
          protocol: 'http',
          handler: 'loginHandler',
          sourceFile: 'src/routes/auth.ts',
        },
        {
          path: '/api/v1/users/:id',
          method: 'GET',
          protocol: 'http',
          handler: 'getUserHandler',
          sourceFile: 'src/routes/users.ts',
        },
      ],
      consumedApis: [],
      dependencies: [],
    };

    const frontendApp: ServiceNode = {
      id: 'web-frontend',
      name: 'Web Frontend',
      fileCount: 45,
      symbolCount: 190,
      exportedApis: [],
      consumedApis: [
        {
          path: '/api/v1/auth/login',
          method: 'POST',
          protocol: 'http',
          sourceFile: 'src/services/apiClient.ts',
        },
        {
          path: '/api/v1/users/123',
          method: 'GET',
          protocol: 'http',
          sourceFile: 'src/hooks/useUser.ts',
        },
      ],
      dependencies: [],
    };

    const schema = aggregator.aggregate([authService, frontendApp]);

    expect(schema.services).toHaveLength(2);
    expect(schema.crossServiceEdges).toHaveLength(2);

    const loginEdge = schema.crossServiceEdges.find((e) => e.endpoint?.includes('login'));
    expect(loginEdge).toBeDefined();
    expect(loginEdge?.sourceService).toBe('web-frontend');
    expect(loginEdge?.targetService).toBe('auth-service');
    expect(loginEdge?.type).toBe('api_call');
  });

  it('detects shared package dependencies across repositories', () => {
    const coreLib: ServiceNode = {
      id: 'core-ui-components',
      name: '@myorg/core-ui',
      fileCount: 15,
      symbolCount: 60,
      exportedApis: [],
      consumedApis: [],
      dependencies: [],
    };

    const consumerApp: ServiceNode = {
      id: 'dashboard-app',
      name: 'Dashboard App',
      fileCount: 50,
      symbolCount: 220,
      exportedApis: [],
      consumedApis: [],
      dependencies: ['@myorg/core-ui', 'react', 'lodash'],
    };

    const schema = aggregator.aggregate([coreLib, consumerApp]);

    expect(schema.crossServiceEdges).toHaveLength(1);
    expect(schema.crossServiceEdges[0]?.sourceService).toBe('dashboard-app');
    expect(schema.crossServiceEdges[0]?.targetService).toBe('core-ui-components');
    expect(schema.crossServiceEdges[0]?.type).toBe('package_dep');
  });

  it('converts MultiRepoSchema to visualizer GraphData format', () => {
    const serviceA: ServiceNode = {
      id: 'payment-svc',
      name: 'Payment Service',
      fileCount: 30,
      symbolCount: 120,
      exportedApis: [{ path: '/api/checkout', method: 'POST', protocol: 'http' }],
      consumedApis: [],
      dependencies: [],
    };

    const serviceB: ServiceNode = {
      id: 'order-svc',
      name: 'Order Service',
      fileCount: 25,
      symbolCount: 110,
      exportedApis: [],
      consumedApis: [{ path: '/api/checkout', method: 'POST', protocol: 'http' }],
      dependencies: [],
    };

    const schema = aggregator.aggregate([serviceA, serviceB]);
    const graphData = aggregator.toGraphData(schema);

    expect(graphData.nodes.length).toBeGreaterThanOrEqual(3);
    const serviceNodes = graphData.nodes.filter((n) => n.type === 'service');
    expect(serviceNodes).toHaveLength(2);

    const crossEdge = graphData.edges.find((e) => e.type === 'api_call');
    expect(crossEdge).toBeDefined();
    expect(crossEdge?.source).toBe('svc_order-svc');
    expect(crossEdge?.target).toBe('svc_payment-svc');
  });
});
