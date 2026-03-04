import { Process } from '../types/process';

export function processStats(processes: Process[]) {
  const total = processes.length;
  const uniquePids = new Set(processes.map((p) => p.pid)).size;
  const rootProcesses = processes.filter((p) => p.ppid === 0).length;
  const systemProcesses = processes.filter((p) => p.uid === 0).length;
  const freq = processes.reduce((acc: Record<string, number>, p) => {
    acc[p.name] = (acc[p.name] || 0) + 1;
    return acc;
  }, {});
  const top5 = Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  return { total, uniquePids, rootProcesses, systemProcesses, top5 };
}
