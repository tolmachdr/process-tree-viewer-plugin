import { useState, useCallback, useRef, useEffect } from 'react';
import { Process, TimeRange, PAGE_SIZE } from '../types/process';

interface Http {
  get: (path: string, options?: any) => Promise<any>;
  post: (path: string, options?: any) => Promise<any>;
}

export function useProcesses(
  http: Http,
  selectedIndex: string,
  selectedTimeRange: TimeRange,
  customTimeRange: { from: string; to: string },
  getSelectedAgentIds: () => string[],
  isInitialized: boolean
) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalProcesses, setTotalProcesses] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [newProcessCount, setNewProcessCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const lastTimestampRef = useRef<string | null>(null);
  const processMapRef = useRef<Map<string, Process>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const loadProcesses = useCallback(
    async (offset: number, isInitial: boolean = false) => {
      if (!selectedIndex) {
        setError('Выберите индекс для поиска процессов');
        return;
      }

      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      }
      setError(null);

      try {
        const timeFrom = selectedTimeRange.value || customTimeRange.from;
        const agentIds = getSelectedAgentIds();

        const response = await http.post('/api/process_tree/processes', {
          body: JSON.stringify({
            index: selectedIndex,
            timeRange: { from: timeFrom, to: customTimeRange.to },
            limit: PAGE_SIZE,
            offset,
            agentIds: agentIds.length > 0 ? agentIds : undefined,
          }),
        });

        if (response.success) {
          const processesWithFlag = response.processes.map((p: Process) => ({
            ...p,
            isNew: false,
          }));

          if (isInitial) {
            setProcesses(processesWithFlag);
            processMapRef.current.clear();
          } else {
            setProcesses((prev) => [...prev, ...processesWithFlag]);
          }

          processesWithFlag.forEach((p: Process) => {
            processMapRef.current.set(p._id, p);
          });

          setTotalProcesses(response.total || 0);
          setHasMore(processesWithFlag.length === PAGE_SIZE);
          setCurrentOffset(offset + processesWithFlag.length);

          if (processesWithFlag.length > 0) {
            const max = Math.max(
              ...processesWithFlag.map((p: Process) => new Date(p.timestamp).getTime())
            );
            lastTimestampRef.current = new Date(max).toISOString();
          }

          setLastUpdateTime(new Date());
        } else {
          setError(`Ошибка загрузки процессов: ${response.error}`);
        }
      } catch (err: any) {
        setError(`Ошибка: ${err.message}`);
      } finally {
        if (isInitial) {
          setLoading(false);
        } else {
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [http, selectedIndex, selectedTimeRange, customTimeRange, getSelectedAgentIds]
  );

  const initialLoad = useCallback(async () => {
    setCurrentOffset(0);
    setHasMore(true);
    await loadProcesses(0, true);
  }, [loadProcesses]);

  const loadMore = useCallback(() => {
    if (!loadingMoreRef.current && hasMore && !loading) {
      loadProcesses(currentOffset, false);
    }
  }, [loadProcesses, currentOffset, hasMore, loading]);

  const handleScroll = useCallback(
    (e: Event) => {
      const target = e.target as HTMLDivElement;
      if (!target) return;
      const { scrollTop, scrollHeight, clientHeight } = target;
      const pct = (scrollTop + clientHeight) / scrollHeight;
      if (pct > 0.8 && hasMore && !loadingMoreRef.current && !loading) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore]
  );

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const incrementalUpdate = useCallback(async () => {
    if (!selectedIndex || !lastTimestampRef.current || loading || !isInitialized) return;
    setIsUpdating(true);

    try {
      const agentIds = getSelectedAgentIds();

      const response = await http.post('/api/process_tree/processes', {
        body: JSON.stringify({
          index: selectedIndex,
          timeRange: { from: lastTimestampRef.current, to: 'now' },
          limit: 1000,
          offset: 0,
          agentIds: agentIds.length > 0 ? agentIds : undefined,
        }),
      });

      if (response.success && response.processes.length > 0) {
        const newProcesses = response.processes.filter(
          (p: Process) => !processMapRef.current.has(p._id)
        );

        if (newProcesses.length > 0) {
          const marked = newProcesses.map((p: Process) => ({ ...p, isNew: true }));
          marked.forEach((p: Process) => processMapRef.current.set(p._id, p));

          setProcesses((prev) => {
            const combined = [...marked, ...prev];
            combined.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            return combined;
          });

          const max = Math.max(
            ...marked.map((p: Process) => new Date(p.timestamp).getTime())
          );
          lastTimestampRef.current = new Date(max).toISOString();

          setNewProcessCount(newProcesses.length);
          setLastUpdateTime(new Date());

          setTimeout(() => {
            setProcesses((prev) => prev.map((p) => ({ ...p, isNew: false })));
          }, 3000);
        }
      }
    } catch (err: any) {
      console.error('Incremental update error:', err);
    } finally {
      setIsUpdating(false);
    }
  }, [http, selectedIndex, loading, getSelectedAgentIds, isInitialized]);

  return {
    processes,
    setProcesses,
    loading,
    loadingMore,
    hasMore,
    setHasMore,
    currentOffset,
    setCurrentOffset,
    totalProcesses,
    isUpdating,
    lastUpdateTime,
    newProcessCount,
    error,
    setError,
    lastTimestampRef,
    processMapRef,
    scrollContainerRef,
    loadingMoreRef,
    loadProcesses,
    initialLoad,
    loadMore,
    incrementalUpdate,
  };
}
