export interface Process {
  pid: number;
  ppid: number;
  name: string;
  exe?: string;
  command?: string;
  uid?: number;
  gid?: number;
  type: string;
  timestamp: string;
  _id: string;
  _index: string;
  agent?: { id: string; name: string };
  rule?: { description: string; level: number };
  cwd?: string;
  rawData?: any;
  isNew?: boolean;
  execve?: {
    argc?: string;
    [key: string]: string | undefined;
  };
}

export interface ProcessNode extends Process {
  children: ProcessNode[];
  depth: number;
}

export interface IndexInfo {
  index: string;
  health: string;
  status: string;
  'docs.count': string;
  'store.size': string;
}

export interface Agent {
  id: string;
  name: string;
  count: number;
}

export interface TimeRange {
  text: string;
  value: string;
}

export type ComboBoxOption = {
  label: string;
  value?: string;
};

export const PAGE_SIZE = 500;

export const TIME_RANGES: TimeRange[] = [
  { text: '5 minutes', value: 'now-5m' },
  { text: '15 minutes', value: 'now-15m' },
  { text: '30 minutes', value: 'now-30m' },
  { text: '1 hour', value: 'now-1h' },
  { text: '3 hours', value: 'now-3h' },
  { text: '6 hours', value: 'now-6h' },
  { text: '12 hours', value: 'now-12h' },
  { text: '1 day', value: 'now-1d' },
  { text: '3 days', value: 'now-3d' },
  { text: '1 week', value: 'now-1w' },
];
