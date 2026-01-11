import React from 'react';
import ReactDOM from 'react-dom';
import { CoreStart, AppMountParameters } from '../../../src/core/public';
import { ProcessTreeViewerApp } from './components/app';

export const renderApp = (params: AppMountParameters, core: CoreStart) => {
  ReactDOM.render(
    <ProcessTreeViewerApp http={core.http} />,
    params.element
  );

  return () => ReactDOM.unmountComponentAtNode(params.element);
};