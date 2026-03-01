import { useState, useEffect, useCallback } from 'react';
import { Agent } from '../types/process';

interface Http {
  get: (path: string, options?: any) => Promise<any>;
  post: (path: string, options?: any) => Promise<any>;
}

export function useAgents(http: Http, selectedIndex: string) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!selectedIndex) return;
    setLoadingAgents(true);
    setAgents([]);
    try {
      const response = await http.get(
        `/api/process_tree/agents/${encodeURIComponent(selectedIndex)}`
      );
      if (response.success && response.agents) {
        setAgents(response.agents);
      } else {
        setAgents([]);
      }
    } catch (err: any) {
      console.error('Error loading agents:', err);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  }, [http, selectedIndex]);

  useEffect(() => {
    if (selectedIndex) loadAgents();
  }, [selectedIndex, loadAgents]);

  return { agents, loadingAgents, loadAgents };
}
