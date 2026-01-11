// public/plugin.ts
import {
  Plugin,
  CoreSetup,
  CoreStart,
  AppMountParameters,
} from '../../../src/core/public';
import { PLUGIN_NAME } from '../common';

export interface ProcessTreeViewerSetup {}
export interface ProcessTreeViewerStart {}

export class ProcessTreeViewerPlugin
  implements Plugin<ProcessTreeViewerSetup, ProcessTreeViewerStart> {

  public setup(core: CoreSetup): ProcessTreeViewerSetup {
    // Регистрируем основное приложение
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
        // Load application bundle
        const { renderApp } = await import('./application');
        // Get start services as specified in opensearch_dashboards.json
        const [coreStart] = await core.getStartServices();
        // Render the application
        return renderApp(params, coreStart);
      },
    });

    return {};
  }

  public start(coreStart: CoreStart): ProcessTreeViewerStart {
    // Здесь можно инициализировать сервисы, если нужно
    return {};
  }

  public stop() {}
}

// Экспорт инициализатора плагина
export const plugin = () => new ProcessTreeViewerPlugin();