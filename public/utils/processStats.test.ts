import { processStats } from './processStats';
import { Process } from '../types/process';

const makeProcess = (overrides: Partial<Process> & { pid: number }): Process => ({
  ppid: 1,
  name: 'test',
  type: 'audit',
  timestamp: '2024-01-01T00:00:00Z',
  _id: `id-${overrides.pid}`,
  _index: 'test-index',
  uid: 1000,
  ...overrides,
});

describe('processStats', () => {
  it('returns zeros for an empty array', () => {
    const stats = processStats([]);

    expect(stats.total).toBe(0);
    expect(stats.uniquePids).toBe(0);
    expect(stats.rootProcesses).toBe(0);
    expect(stats.systemProcesses).toBe(0);
    expect(stats.top5).toHaveLength(0);
  });

  describe('total', () => {
    it('counts all processes', () => {
      const processes = [
        makeProcess({ pid: 1 }),
        makeProcess({ pid: 2 }),
        makeProcess({ pid: 3 }),
      ];
      expect(processStats(processes).total).toBe(3);
    });

    it('single process → total=1', () => {
      expect(processStats([makeProcess({ pid: 1 })]).total).toBe(1);
    });
  });

  describe('uniquePids', () => {
    it('counts each pid only once even if it appears in multiple events', () => {
      const processes = [
        makeProcess({ pid: 1, _id: 'a' }),
        makeProcess({ pid: 1, _id: 'b' }),
        makeProcess({ pid: 2, _id: 'c' }),
      ];
      expect(processStats(processes).uniquePids).toBe(2);
    });

    it('equals total when all pids are unique', () => {
      const processes = [
        makeProcess({ pid: 10 }),
        makeProcess({ pid: 20 }),
        makeProcess({ pid: 30 }),
      ];
      const stats = processStats(processes);

      expect(stats.uniquePids).toBe(3);
      expect(stats.uniquePids).toBe(stats.total);
    });
  });

  describe('rootProcesses', () => {
    it('counts processes with ppid=0', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 0 }),
        makeProcess({ pid: 3, ppid: 1 }),
      ];
      expect(processStats(processes).rootProcesses).toBe(2);
    });

    it('returns 0 when no root processes exist', () => {
      const processes = [
        makeProcess({ pid: 2, ppid: 1 }),
        makeProcess({ pid: 3, ppid: 2 }),
      ];
      expect(processStats(processes).rootProcesses).toBe(0);
    });

    it('equals total when all processes are roots', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 0 }),
      ];
      const stats = processStats(processes);

      expect(stats.rootProcesses).toBe(stats.total);
    });
  });

  describe('systemProcesses', () => {
    it('counts processes with uid=0', () => {
      const processes = [
        makeProcess({ pid: 1, uid: 0 }),
        makeProcess({ pid: 2, uid: 0 }),
        makeProcess({ pid: 3, uid: 1000 }),
      ];
      expect(processStats(processes).systemProcesses).toBe(2);
    });

    it('returns 0 when no system processes exist', () => {
      const processes = [
        makeProcess({ pid: 1, uid: 1000 }),
        makeProcess({ pid: 2, uid: 500 }),
      ];
      expect(processStats(processes).systemProcesses).toBe(0);
    });
  });

  describe('top5', () => {
    it('returns the 5 most frequent process names', () => {
      const processes = [
        makeProcess({ pid: 1, name: 'bash' }),
        makeProcess({ pid: 2, name: 'bash' }),
        makeProcess({ pid: 3, name: 'bash' }),
        makeProcess({ pid: 4, name: 'nginx' }),
        makeProcess({ pid: 5, name: 'nginx' }),
        makeProcess({ pid: 6, name: 'python' }),
        makeProcess({ pid: 7, name: 'node' }),
        makeProcess({ pid: 8, name: 'ruby' }),
        makeProcess({ pid: 9, name: 'perl' }),
      ];
      const { top5 } = processStats(processes);

      expect(top5).toHaveLength(5);
      expect(top5[0]).toEqual({ name: 'bash', count: 3 });
      expect(top5[1]).toEqual({ name: 'nginx', count: 2 });
    });

    it('returns fewer than 5 entries when there are fewer unique names', () => {
      const processes = [
        makeProcess({ pid: 1, name: 'bash' }),
        makeProcess({ pid: 2, name: 'nginx' }),
      ];
      expect(processStats(processes).top5).toHaveLength(2);
    });

    it('sorts entries by count descending', () => {
      const processes = [
        makeProcess({ pid: 1, name: 'a' }),
        makeProcess({ pid: 2, name: 'b' }),
        makeProcess({ pid: 3, name: 'b' }),
        makeProcess({ pid: 4, name: 'c' }),
        makeProcess({ pid: 5, name: 'c' }),
        makeProcess({ pid: 6, name: 'c' }),
      ];
      const { top5 } = processStats(processes);

      expect(top5[0]).toEqual({ name: 'c', count: 3 });
      expect(top5[1]).toEqual({ name: 'b', count: 2 });
      expect(top5[2]).toEqual({ name: 'a', count: 1 });
    });

    it('returns exactly 5 entries when there are 10 unique names', () => {
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      const processes = names.map((name, i) => makeProcess({ pid: i + 1, name }));

      expect(processStats(processes).top5).toHaveLength(5);
    });
  });

  it('all metrics computed correctly for a mixed dataset', () => {
    const processes = [
      makeProcess({ pid: 1, ppid: 0, uid: 0, name: 'systemd' }),
      makeProcess({ pid: 2, ppid: 0, uid: 1000, name: 'bash' }),
      makeProcess({ pid: 3, ppid: 2, uid: 1000, name: 'bash' }),
      makeProcess({ pid: 3, ppid: 2, uid: 1000, name: 'vim', _id: 'id-3-dup' }),
    ];
    const stats = processStats(processes);

    expect(stats.total).toBe(4);
    expect(stats.uniquePids).toBe(3);   // pid 3 appears twice
    expect(stats.rootProcesses).toBe(2); // pid 1 and 2
    expect(stats.systemProcesses).toBe(1);
    expect(stats.top5[0]).toEqual({ name: 'bash', count: 2 });
  });
});
