export { CodebaseAnalyzer } from './analyzer.js';
export { CycleDetector } from './cycle-detector.js';
export { DeadCodeDetector, type DeadCodeDetectorOptions } from './dead-code-detector.js';
export { MetricsCalculator, type GraphMetricsSummary } from './metrics.js';
export {
  GitMetricsAnalyzer,
  type TechnicalDebtHotspot,
  type FileChurnInfo,
} from './git-metrics.js';
