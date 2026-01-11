import './index.scss';

import { ProcessTreeViewerPlugin } from './plugin';

export function plugin() {
  return new ProcessTreeViewerPlugin();
}
export { ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart } from './types';
