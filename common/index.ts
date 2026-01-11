export const PLUGIN_ID = 'processTreeViewer';
export const PLUGIN_NAME = 'Process Tree Viewer';

export interface ProcessDocument {
  _id: string;
  _index: string;
  pid: number;
  ppid: number;
  name: string;
  uid: number;
  gid: number;
  exe: string;
  command: string;
  args: string[];
  cwd: string;
  timestamp: string;
  score: number;
}

export interface IndexInfo {
  index: string;
  'docs.count': string;
  'store.size': string;
  health: 'green' | 'yellow' | 'red';
  status: 'open' | 'close';
  pri: string;
  rep: string;
}

export interface ProcessSearchParams {
  index: string;
  timeRange: {
    from: string;
    to: string;
  };
  size?: number;
  query?: any;
}

export interface SearchResponse {
  processes: ProcessDocument[];
  total: number;
  took: number;
  timed_out: boolean;
}
