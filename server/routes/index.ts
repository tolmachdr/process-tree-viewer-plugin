import { IRouter } from 'src/core/server';
import { registerIndicesRoute } from './indices';
import { registerAgentsRoute } from './agents';
import { registerProcessesRoute } from './processes';

export function defineRoutes(router: IRouter) {
  registerIndicesRoute(router);
  registerAgentsRoute(router);
  registerProcessesRoute(router);
}
