export { AtlasDatabase } from './database.js';
export { runMigrations } from './migrations.js';
export {
  FileRepository,
  SymbolRepository,
  ImportRepository,
  DependencyRepository,
  ProjectRepository,
  EmbeddingRepository,
  type ProjectRecord,
  type EmbeddingRecord,
} from './repositories.js';
export { SearchRepository, type FtsResult } from './search.js';
export {
  FederationService,
  type FederatedRepoInfo,
  type CrossRepoSymbolResult,
} from './federation.js';
