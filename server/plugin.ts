import { PluginInitializerContext, CoreSetup, CoreStart, Plugin, Logger } from 'src/core/server';
import { defineRoutes } from './routes';
import { ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart } from './types';

export class ProcessTreeViewerPlugin
  implements Plugin<ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart> {
  private readonly logger: Logger;

  constructor(private readonly initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup): ProcessTreeViewerPluginSetup {
    const router = core.http.createRouter();

    defineRoutes(router);

    this.logger.info('ProcessTreeViewerPlugin setup complete');

    return {};
  }

  public start(core: CoreStart): ProcessTreeViewerPluginStart {
    this.logger.info('ProcessTreeViewerPlugin started');
    return {};
  }

  public stop() {
    this.logger.info('ProcessTreeViewerPlugin stopped');
  }
}
