import { useState, useEffect, useCallback } from 'react';
import { IndexInfo } from '../types/process';

interface Http {
  get: (path: string, options?: any) => Promise<any>;
  post: (path: string, options?: any) => Promise<any>;
}

export function useIndices(http: Http) {
  const [indices, setIndices] = useState<IndexInfo[]>([]);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIndices = useCallback(async () => {
    setLoadingIndices(true);
    try {
      const response = await http.get('/api/process_tree/indices', {
        query: { pattern: '*' },
      });
      if (response.success) {
        setIndices(response.indices);
      }
    } catch (err: any) {
      setError(`Ошибка загрузки индексов: ${err.message}`);
    } finally {
      setLoadingIndices(false);
    }
  }, [http]);

  useEffect(() => {
    loadIndices();
  }, [loadIndices]);

  return { indices, loadingIndices, error, loadIndices };
}
