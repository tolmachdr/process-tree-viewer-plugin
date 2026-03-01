import { buildProcessTree } from './buildProcessTree';
import { Process } from '../types/process';

const makeProcess = (overrides: Partial<Process> & { pid: number }): Process => ({
  ppid: 0,
  name: 'test',
  type: 'audit',
  timestamp: '2024-01-01T00:00:00.000Z',
  _id: `id-${overrides.pid}`,
  _index: 'test-index',
  uid: 1000,
  ...overrides,
});

describe('buildProcessTree', () => {
  describe('basic structure', () => {
    it('returns empty array for empty input', () => {
      expect(buildProcessTree([], '', true)).toEqual([]);
    });

    it('single process with no parent becomes a root', () => {
      const processes = [makeProcess({ pid: 1, ppid: 0 })];
      const tree = buildProcessTree(processes, '', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(1);
      expect(tree[0].children).toHaveLength(0);
      expect(tree[0].depth).toBe(0);
    });

    it('links child process to its parent', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 1 }),
      ];
      const tree = buildProcessTree(processes, '', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].pid).toBe(2);
    });

    it('sets depth=0 for root, depth=1 for child, depth=2 for grandchild', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 1 }),
        makeProcess({ pid: 3, ppid: 2 }),
      ];
      const tree = buildProcessTree(processes, '', true);

      expect(tree[0].depth).toBe(0);
      expect(tree[0].children[0].depth).toBe(1);
      expect(tree[0].children[0].children[0].depth).toBe(2);
    });

    it('process with unknown ppid becomes a root', () => {
      const processes = [makeProcess({ pid: 5, ppid: 999 })];
      const tree = buildProcessTree(processes, '', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(5);
    });

    it('multiple processes without a parent produce multiple roots', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 0 }),
        makeProcess({ pid: 3, ppid: 0 }),
      ];
      expect(buildProcessTree(processes, '', true)).toHaveLength(3);
    });

    it('one parent with multiple children', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 1 }),
        makeProcess({ pid: 3, ppid: 1 }),
        makeProcess({ pid: 4, ppid: 1 }),
      ];
      const tree = buildProcessTree(processes, '', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(3);
    });
  });

  describe('sorting', () => {
    it('sorts roots by timestamp descending (newest first)', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, timestamp: '2024-01-01T00:00:00Z' }),
        makeProcess({ pid: 2, ppid: 0, timestamp: '2024-01-03T00:00:00Z' }),
        makeProcess({ pid: 3, ppid: 0, timestamp: '2024-01-02T00:00:00Z' }),
      ];
      const tree = buildProcessTree(processes, '', true);

      expect(tree[0].pid).toBe(2);
      expect(tree[1].pid).toBe(3);
      expect(tree[2].pid).toBe(1);
    });

    it('sorts children by timestamp descending', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, timestamp: '2024-01-03T00:00:00Z' }),
        makeProcess({ pid: 2, ppid: 1, timestamp: '2024-01-01T00:00:00Z' }),
        makeProcess({ pid: 3, ppid: 1, timestamp: '2024-01-02T00:00:00Z' }),
      ];
      const tree = buildProcessTree(processes, '', true);

      expect(tree[0].children[0].pid).toBe(3);
      expect(tree[0].children[1].pid).toBe(2);
    });
  });

  describe('search filtering', () => {
    it('empty search query returns all processes', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'bash' }),
        makeProcess({ pid: 2, ppid: 0, name: 'nginx' }),
      ];
      expect(buildProcessTree(processes, '', true)).toHaveLength(2);
    });

    it('filters by process name', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'bash' }),
        makeProcess({ pid: 2, ppid: 0, name: 'nginx' }),
      ];
      const tree = buildProcessTree(processes, 'bash', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('bash');
    });

    it('search is case-insensitive', () => {
      const processes = [makeProcess({ pid: 1, ppid: 0, name: 'NGINX' })];
      expect(buildProcessTree(processes, 'nginx', true)).toHaveLength(1);
    });

    it('filters by exe path', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'a', exe: '/usr/bin/bash' }),
        makeProcess({ pid: 2, ppid: 0, name: 'b', exe: '/usr/bin/python3' }),
      ];
      const tree = buildProcessTree(processes, 'python3', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(2);
    });

    it('filters by command', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'a', command: 'npm start' }),
        makeProcess({ pid: 2, ppid: 0, name: 'b', command: 'yarn build' }),
      ];
      expect(buildProcessTree(processes, 'yarn', true)).toHaveLength(1);
    });

    it('filters by pid as string', () => {
      const processes = [
        makeProcess({ pid: 1234, ppid: 0 }),
        makeProcess({ pid: 5678, ppid: 0 }),
      ];
      const tree = buildProcessTree(processes, '1234', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(1234);
    });

    it('filters by ppid as string', () => {
      const processes = [
        makeProcess({ pid: 10, ppid: 9999 }),
        makeProcess({ pid: 20, ppid: 1111 }),
      ];
      const tree = buildProcessTree(processes, '9999', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(10);
    });

    it('filters by working directory cwd', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, cwd: '/home/user/project' }),
        makeProcess({ pid: 2, ppid: 0, cwd: '/tmp' }),
      ];
      expect(buildProcessTree(processes, 'project', true)).toHaveLength(1);
    });

    it('keeps parent visible when a child matches the search query', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'parent' }),
        makeProcess({ pid: 2, ppid: 1, name: 'matching-child' }),
      ];
      const tree = buildProcessTree(processes, 'matching', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(1);
      expect(tree[0].children[0].pid).toBe(2);
    });

    it('hides a process that has no match and no matching descendants', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'parent' }),
        makeProcess({ pid: 2, ppid: 0, name: 'other' }),
      ];
      const tree = buildProcessTree(processes, 'parent', true);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(1);
    });
  });

  describe('system process filtering', () => {
    it('shows system processes when showSystemProcesses=true', () => {
      const processes = [makeProcess({ pid: 1, ppid: 0, uid: 0 })];
      expect(buildProcessTree(processes, '', true)).toHaveLength(1);
    });

    it('hides processes with uid=0 when showSystemProcesses=false', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, uid: 0 }),
        makeProcess({ pid: 2, ppid: 0, uid: 1000 }),
      ];
      const tree = buildProcessTree(processes, '', false);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(2);
    });

    it('hides process named "systemd" when showSystemProcesses=false', () => {
      const processes = [makeProcess({ pid: 1, ppid: 0, name: 'systemd', uid: 1000 })];
      expect(buildProcessTree(processes, '', false)).toHaveLength(0);
    });

    it('hides process named "init" when showSystemProcesses=false', () => {
      const processes = [makeProcess({ pid: 1, ppid: 0, name: 'init', uid: 1000 })];
      expect(buildProcessTree(processes, '', false)).toHaveLength(0);
    });

    it('hides process named "kthreadd" when showSystemProcesses=false', () => {
      const processes = [makeProcess({ pid: 1, ppid: 0, name: 'kthreadd', uid: 1000 })];
      expect(buildProcessTree(processes, '', false)).toHaveLength(0);
    });

    it('keeps system parent when it has a non-system child', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, uid: 0 }),
        makeProcess({ pid: 2, ppid: 1, uid: 1000, name: 'user-process' }),
      ];
      const tree = buildProcessTree(processes, '', false);

      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
    });

    it('returns empty array when all processes are system-level', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, uid: 0 }),
        makeProcess({ pid: 2, ppid: 0, name: 'systemd', uid: 1000 }),
      ];
      expect(buildProcessTree(processes, '', false)).toHaveLength(0);
    });
  });

  describe('combined scenarios', () => {
    it('search and system filter work together', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0, name: 'bash', uid: 1000 }),
        makeProcess({ pid: 2, ppid: 0, name: 'systemd', uid: 0 }),
        makeProcess({ pid: 3, ppid: 0, name: 'bash', uid: 0 }),
      ];
      // pid=3: name matches but uid=0 → hidden
      // pid=1: name matches, uid=1000 → visible
      const tree = buildProcessTree(processes, 'bash', false);

      expect(tree).toHaveLength(1);
      expect(tree[0].pid).toBe(1);
    });

    it('no node appears more than once in the tree', () => {
      const processes = [
        makeProcess({ pid: 1, ppid: 0 }),
        makeProcess({ pid: 2, ppid: 1 }),
        makeProcess({ pid: 3, ppid: 2 }),
      ];
      const flat = (nodes: any[]): any[] =>
        nodes.flatMap((n) => [n, ...flat(n.children)]);

      const tree = buildProcessTree(processes, '', true);
      const ids = flat(tree).map((n) => n.pid);

      expect(ids).toHaveLength(new Set(ids).size);
    });
  });
});
