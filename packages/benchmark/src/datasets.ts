import type { BenchmarkDataset } from './types.js';

export const EXPRESS_BENCHMARK_DATASET: BenchmarkDataset = {
  name: 'expressjs/express',
  repositoryUrl: 'https://github.com/expressjs/express.git',
  branch: 'master',
  tasks: [
    {
      id: 'express-routing-matching',
      query:
        'Find how routes and middleware are registered and dispatched on the express application',
      description: 'Locate core application routing and middleware initialization',
      expectedFiles: ['lib/application.js', 'lib/express.js'],
    },
    {
      id: 'express-app-listen',
      query: 'Where is app.listen defined and how does it start the HTTP server',
      description: 'Locate application initialization and HTTP server bootstrap',
      expectedFiles: ['lib/application.js', 'lib/express.js'],
    },
    {
      id: 'express-response-json',
      query: 'Locate the logic that formats and serializes response data to JSON with res.json',
      description: 'Trace res.json and res.send response prototype helpers',
      expectedFiles: ['lib/response.js'],
    },
    {
      id: 'express-request-cookies',
      query: 'Where are request cookies and headers parsed in the request prototype',
      description: 'Locate req.cookies and header parsing helpers in request prototype',
      expectedFiles: ['lib/request.js'],
    },
    {
      id: 'express-view-render',
      query: 'Find template rendering and view engine resolution with app.render and res.render',
      description: 'Trace view engine lookup and rendering pipeline',
      expectedFiles: ['lib/view.js', 'lib/application.js', 'lib/response.js'],
    },
  ],
};

export const ALL_DATASETS: BenchmarkDataset[] = [EXPRESS_BENCHMARK_DATASET];
