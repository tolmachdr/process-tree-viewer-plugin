import { NavigationPublicPluginStart } from '../../../src/plugins/navigation/public';

export interface ProcessTreeViewerPluginSetup {
  getGreeting: () => string;
}

export interface ProcessTreeViewerPluginStart {}

export interface AppPluginStartDependencies {
  navigation: NavigationPublicPluginStart;
}
