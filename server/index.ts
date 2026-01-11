import { PluginInitializerContext } from '../../../src/core/server';
import { ProcessTreeViewerPlugin } from './plugin';

export function plugin(initializerContext: PluginInitializerContext) {
  return new ProcessTreeViewerPlugin(initializerContext);
}

export { ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart } from './types';
