import './index.scss';

import { ProcessTreeViewerPlugin } from './plugin';

// This exports static code and TypeScript types,
// as well as, OpenSearch Dashboards Platform `plugin()` initializer.
export function plugin() {
  return new ProcessTreeViewerPlugin();
}
export { ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart } from './types';
