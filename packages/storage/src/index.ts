export { AtlasDatabase } from './database.js';
export { runMigrations } from './migrations.js';
export {
  FileRepository,
  SymbolRepository,
  ImportRepository,
  DependencyRepository,
  ProjectRepository,
  EmbeddingRepository,
  GitMetricsRepository,
  type ProjectRecord,
  type EmbeddingRecord,
  type GitMetricRecord,
} from './repositories.js';
export { SearchRepository, type FtsResult } from './search.js';
export {
  FederationService,
  type FederatedRepoInfo,
  type CrossRepoSymbolResult,
} from './federation.js';
