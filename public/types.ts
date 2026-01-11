import { NavigationPublicPluginStart } from '../../../src/plugins/navigation/public';

export interface ProcessTreeViewerPluginSetup {
  getGreeting: () => string;
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ProcessTreeViewerPluginStart {}

export interface AppPluginStartDependencies {
  navigation: NavigationPublicPluginStart;
}
