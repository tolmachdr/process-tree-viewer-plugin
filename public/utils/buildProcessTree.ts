import { Process, ProcessNode } from '../types/process';

export function buildProcessTree(
  processes: Process[],
  searchQuery: string,
  showSystemProcesses: boolean
): ProcessNode[] {
  if (!processes.length) return [];

  const nodeMap = new Map<number, ProcessNode>();

  processes.forEach((p) => {
    nodeMap.set(p.pid, { ...p, children: [], depth: 0 });
  });

  const roots: ProcessNode[] = [];

  nodeMap.forEach((node) => {
    if (node.ppid && nodeMap.has(node.ppid)) {
      const parent = nodeMap.get(node.ppid)!;
      parent.children.push(node);
      node.depth = parent.depth + 1;
    } else {
      roots.push(node);
    }
  });

  const sortTree = (nodes: ProcessNode[]) => {
    nodes.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    nodes.forEach((n) => n.children.length && sortTree(n.children));
  };
  sortTree(roots);

  const matchesSearch = (p: Process) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.exe || '').toLowerCase().includes(q) ||
      (p.command || '').toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      String(p.ppid).includes(q) ||
      String(p.uid || '').includes(q) ||
      (p.cwd || '').toLowerCase().includes(q)
    );
  };

  const isSystemProcess = (p: Process) =>
    p.uid === 0 ||
    (p.name || '').includes('systemd') ||
    (p.name || '').includes('init') ||
    (p.name || '').includes('kthreadd');

  const filterTree = (nodes: ProcessNode[]): ProcessNode[] =>
    nodes
      .map((node) => {
        const filteredChildren = filterTree(node.children);
        const visible =
          matchesSearch(node) && (showSystemProcesses || !isSystemProcess(node));
        if (visible || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean) as ProcessNode[];

  return filterTree(roots);
}
