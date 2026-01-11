import { Plugin, CoreSetup, CoreStart, AppMountParameters } from '../../../src/core/public';
import { PLUGIN_NAME } from '../common';

export interface ProcessTreeViewerSetup {}
export interface ProcessTreeViewerStart {}

export class ProcessTreeViewerPlugin
  implements Plugin<ProcessTreeViewerSetup, ProcessTreeViewerStart> {
  public setup(core: CoreSetup): ProcessTreeViewerSetup {
    core.application.register({
      id: 'processTreeViewer',
      title: PLUGIN_NAME,
      category: {
        id: 'opensearch',
        label: 'OpenSearch Plugins',
        order: 2000,
      },
      order: 100,
      async mount(params: AppMountParameters) {
        const { renderApp } = await import('./application');

        const [coreStart] = await core.getStartServices();

        return renderApp(params, coreStart);
      },
    });

    return {};
  }

  public start(coreStart: CoreStart): ProcessTreeViewerStart {
    return {};
  }

  public stop() {}
}

export const plugin = () => new ProcessTreeViewerPlugin();
