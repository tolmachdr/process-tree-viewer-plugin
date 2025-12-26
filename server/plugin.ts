import {
  PluginInitializerContext,
  CoreSetup,
  CoreStart,
  Plugin,
  Logger,
} from '../../../src/core/server';

import { ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart } from './types';
import { defineRoutes } from './routes';

export class ProcessTreeViewerPlugin
  implements Plugin<ProcessTreeViewerPluginSetup, ProcessTreeViewerPluginStart> {
  private readonly logger: Logger;

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(core: CoreSetup) {
    this.logger.debug('processTreeViewer: Setup');
    const router = core.http.createRouter();

    // Register server side APIs
    defineRoutes(router);

    return {};
  }

  public start(core: CoreStart) {
    this.logger.debug('processTreeViewer: Started');
    return {};
  }

  public stop() {}
}
