import { PluginInitializerContext } from '../../../src/core/server';
import { ProcessTreeViewerPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.

export function plugin(initializerContext: PluginInitializerContext) {
  return new ProcessTreeViewerPlugin(initializerContext);
}

export { ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart } from './types';
