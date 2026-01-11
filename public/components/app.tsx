import React, { useState, useEffect, useCallback, useMemo, ChangeEvent, useRef } from 'react';
import {
  EuiPage,
  EuiPageBody,
  EuiPageHeader,
  EuiPageContent,
  EuiPageContentBody,
  EuiLoadingSpinner,
  EuiCallOut,
  EuiText,
  EuiSpacer,
  EuiPanel,
  EuiFieldSearch,
  EuiButton,
  EuiSelect,
  EuiFormRow,
  EuiTreeView,
  EuiIcon,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiToolTip,
  EuiHealth,
  EuiSuperDatePicker,
  EuiCheckbox,
  EuiTitle,
  EuiDescriptionList,
  EuiDescriptionListTitle,
  EuiDescriptionListDescription,
  EuiStat,
  EuiCodeBlock,
  EuiButtonGroup,
  EuiRange,
  EuiTreeViewProps,
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiTabbedContent,
  EuiSwitch,
  EuiProgress,
  EuiTextColor,
} from '@elastic/eui';

// Типы данных
interface Process {
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
  agent?: {
    id: string;
    name: string;
  };
  rule?: {
    description: string;
    level: number;
  };
  cwd?: string;
  rawData?: any;
  isNew?: boolean; // Флаг для подсветки новых процессов
}

interface ProcessNode extends Process {
  children: ProcessNode[];
  depth: number;
}

interface IndexInfo {
  index: string;
  health: string;
  status: string;
  'docs.count': string;
  'store.size': string;
}

interface TimeRange {
  text: string;
  value: string;
}

interface Props {
  http: {
    get: (path: string, options?: any) => Promise<any>;
    post: (path: string, options?: any) => Promise<any>;
  };
}

// Предустановленные периоды времени
const TIME_RANGES: TimeRange[] = [
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

// Основной компонент
export const ProcessTreeViewerApp: React.FC<Props> = ({ http }) => {
  // Состояния
  const [loading, setLoading] = useState(false);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [indices, setIndices] = useState<IndexInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TIME_RANGES[3]);
  const [customTimeRange, setCustomTimeRange] = useState({ from: 'now-1h', to: 'now' });
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState<number>(500);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [showSystemProcesses, setShowSystemProcesses] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [isFlyoutVisible, setIsFlyoutVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [newProcessCount, setNewProcessCount] = useState(0);

  // Refs для хранения последнего timestamp
  const lastTimestampRef = useRef<string | null>(null);
  const processMapRef = useRef<Map<string, Process>>(new Map());

  // Инициализация - первая загрузка
  const initialLoad = useCallback(async () => {
    if (!selectedIndex) {
      setError('Выберите индекс для поиска процессов');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timeFrom = selectedTimeRange.value || customTimeRange.from;
      
      const response = await http.post('/api/process_tree/processes', {
        body: JSON.stringify({
          index: selectedIndex,
          timeRange: {
            from: timeFrom,
            to: 'now',
          },
          limit: limit,
        }),
      });

      if (response.success) {
        const processesWithFlag = response.processes.map((p: Process) => ({ ...p, isNew: false }));
        setProcesses(processesWithFlag);
        
        // Сохраняем процессы в Map для быстрого поиска
        processMapRef.current.clear();
        processesWithFlag.forEach((p: Process) => {
          processMapRef.current.set(p._id, p);
        });
        
        // Сохраняем последний timestamp
        if (processesWithFlag.length > 0) {
          const timestamps = processesWithFlag.map((p: Process) => new Date(p.timestamp).getTime());
          const maxTimestamp = Math.max(...timestamps);
          lastTimestampRef.current = new Date(maxTimestamp).toISOString();
        }
        
        setLastUpdateTime(new Date());
      } else {
        setError(`Ошибка загрузки процессов: ${response.error}`);
      }
    } catch (err: any) {
      setError(`Ошибка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [http, selectedIndex, selectedTimeRange, customTimeRange, limit]);

  // Инкрементальное обновление - загружаем только новые данные
  const incrementalUpdate = useCallback(async () => {
    if (!selectedIndex || !lastTimestampRef.current || loading) {
      return;
    }

    setIsUpdating(true);

    try {
      const response = await http.post('/api/process_tree/processes', {
        body: JSON.stringify({
          index: selectedIndex,
          timeRange: {
            from: lastTimestampRef.current,
            to: 'now',
          },
          limit: 1000, // Берем больше для инкрементального обновления
        }),
      });

      if (response.success && response.processes.length > 0) {
        const newProcesses = response.processes.filter(
          (p: Process) => !processMapRef.current.has(p._id)
        );

        if (newProcesses.length > 0) {
          // Помечаем новые процессы
          const markedNewProcesses = newProcesses.map((p: Process) => ({ ...p, isNew: true }));
          
          // Добавляем в Map
          markedNewProcesses.forEach((p: Process) => {
            processMapRef.current.set(p._id, p);
          });

          // Обновляем состояние
          setProcesses(prev => {
            const updated = [...prev, ...markedNewProcesses];
            
            // Сортируем по timestamp
            updated.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            
            // Ограничиваем количество процессов
            const maxProcesses = limit * 2; // Держим в 2 раза больше для истории
            if (updated.length > maxProcesses) {
              // Удаляем старые процессы из Map
              const removed = updated.slice(maxProcesses);
              removed.forEach(p => processMapRef.current.delete(p._id));
              
              return updated.slice(0, maxProcesses);
            }
            
            return updated;
          });

          // Обновляем последний timestamp
          const timestamps = markedNewProcesses.map((p: Process) => new Date(p.timestamp).getTime());
          const maxTimestamp = Math.max(...timestamps);
          lastTimestampRef.current = new Date(maxTimestamp).toISOString();
          
          setNewProcessCount(newProcesses.length);
          setLastUpdateTime(new Date());
          
          // Убираем флаг isNew через 3 секунды
          setTimeout(() => {
            setProcesses(prev => 
              prev.map(p => ({ ...p, isNew: false }))
            );
          }, 3000);
        }
      }
    } catch (err: any) {
      console.error('Incremental update error:', err);
      // Не показываем ошибку пользователю для инкрементальных обновлений
    } finally {
      setIsUpdating(false);
    }
  }, [http, selectedIndex, loading, limit]);

  // Загрузка индексов
  const loadIndices = useCallback(async () => {
    setLoadingIndices(true);
    try {
      const response = await http.get('/api/process_tree/indices', {
        query: { pattern: '*' },
      });
      
      if (response.success) {
        setIndices(response.indices);
        if (response.indices.length > 0 && !selectedIndex) {
          const wazuhIndex = response.indices.find((i: IndexInfo) => 
            i.index.includes('wazuh') || i.index.includes('alerts')
          );
          setSelectedIndex(wazuhIndex?.index || response.indices[0].index);
        }
      }
    } catch (err: any) {
      setError(`Ошибка загрузки индексов: ${err.message}`);
    } finally {
      setLoadingIndices(false);
    }
  }, [http, selectedIndex]);

  // Эффект для первоначальной загрузки
  useEffect(() => {
    loadIndices();
  }, [loadIndices]);

  useEffect(() => {
    if (selectedIndex) {
      initialLoad();
    }
  }, [selectedIndex, selectedTimeRange, customTimeRange, limit]);

  // Эффект для автоматического обновления (инкрементальное)
  useEffect(() => {
    if (!autoRefresh || !selectedIndex) return;
    
    const intervalId = setInterval(() => {
      incrementalUpdate();
    }, 10000); // Каждые 10 секунд
    
    return () => clearInterval(intervalId);
  }, [autoRefresh, selectedIndex, incrementalUpdate]);

  // Построение дерева процессов с учетом фильтрации
  const buildProcessTree = useMemo(() => {
    if (!processes.length) return [];
    
    let filteredList = [...processes];
    
    // Фильтр по поиску
    if (searchQuery && searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filteredList = filteredList.filter(p => {
        const name = (p.name || '').toLowerCase();
        const exe = (p.exe || '').toLowerCase();
        const command = (p.command || '').toLowerCase();
        const pid = String(p.pid || '');
        const ppid = String(p.ppid || '');
        const cwd = (p.cwd || '').toLowerCase();
        
        return name.includes(query) ||
               exe.includes(query) ||
               command.includes(query) ||
               pid.includes(query) ||
               ppid.includes(query) ||
               cwd.includes(query);
      });
    }
    
    // Фильтр системных процессов
    if (!showSystemProcesses) {
      filteredList = filteredList.filter(p => 
        p.uid !== 0 && 
        p.uid !== undefined && 
        p.uid > 100 &&
        !(p.name || '').includes('systemd') &&
        !(p.name || '').includes('init') &&
        !(p.name || '').includes('kthreadd')
      );
    }
    
    const processMap = new Map<number, ProcessNode>();
    const rootProcesses: ProcessNode[] = [];
    
    // Создаем все узлы
    filteredList.forEach(process => {
      processMap.set(process.pid, {
        ...process,
        children: [],
        depth: 0,
      });
    });
    
    // Строим иерархию
    filteredList.forEach(process => {
      const node = processMap.get(process.pid);
      if (!node) return;
      
      if (process.ppid > 0) {
        const parent = processMap.get(process.ppid);
        if (parent) {
          parent.children.push(node);
          node.depth = parent.depth + 1;
          return;
        }
      }
      
      rootProcesses.push(node);
    });
    
    // Сортируем
    const sortChildren = (nodes: ProcessNode[]) => {
      nodes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };
    
    sortChildren(rootProcesses);
    return rootProcesses;
  }, [processes, searchQuery, showSystemProcesses]);

  // Статистика
  const stats = useMemo(() => {
    const total = processes.length;
    const uniquePids = new Set(processes.map(p => p.pid)).size;
    const rootProcesses = processes.filter(p => p.ppid === 0).length;
    const systemProcesses = processes.filter(p => p.uid === 0).length;
    const topProcesses = [...processes]
      .reduce((acc: Record<string, number>, p) => {
        acc[p.name] = (acc[p.name] || 0) + 1;
        return acc;
      }, {});
    
    const top5 = Object.entries(topProcesses)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    return { total, uniquePids, rootProcesses, systemProcesses, top5 };
  }, [processes]);

  // Обработчик клика по процессу
  const handleProcessClick = (process: Process) => {
    setSelectedProcess(process);
    setIsFlyoutVisible(true);
  };

  // Flyout с деталями процесса
  const renderProcessDetailsFlyout = () => {
    if (!isFlyoutVisible || !selectedProcess) return null;

    const tabs = [
      {
        id: 'overview',
        name: 'Overview',
        content: (
          <>
            <EuiSpacer size="m" />
            <EuiDescriptionList>
              <EuiDescriptionListTitle>Process ID (PID)</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                <EuiBadge color="primary">{selectedProcess.pid}</EuiBadge>
              </EuiDescriptionListDescription>

              <EuiDescriptionListTitle>Parent PID (PPID)</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                <EuiBadge>{selectedProcess.ppid || 'N/A'}</EuiBadge>
              </EuiDescriptionListDescription>

              <EuiDescriptionListTitle>Process Name</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                <strong>{selectedProcess.name}</strong>
              </EuiDescriptionListDescription>

              {selectedProcess.exe && (
                <>
                  <EuiDescriptionListTitle>Executable</EuiDescriptionListTitle>
                  <EuiDescriptionListDescription>
                    <EuiCodeBlock language="text" paddingSize="s" fontSize="s">
                      {selectedProcess.exe}
                    </EuiCodeBlock>
                  </EuiDescriptionListDescription>
                </>
              )}

              {selectedProcess.cwd && (
                <>
                  <EuiDescriptionListTitle>Working Directory</EuiDescriptionListTitle>
                  <EuiDescriptionListDescription>
                    <EuiCodeBlock language="text" paddingSize="s" fontSize="s">
                      {selectedProcess.cwd}
                    </EuiCodeBlock>
                  </EuiDescriptionListDescription>
                </>
              )}

              {selectedProcess.command && (
                <>
                  <EuiDescriptionListTitle>Command Line</EuiDescriptionListTitle>
                  <EuiDescriptionListDescription>
                    <EuiCodeBlock language="bash" paddingSize="s" fontSize="s">
                      {selectedProcess.command}
                    </EuiCodeBlock>
                  </EuiDescriptionListDescription>
                </>
              )}

              {selectedProcess.uid !== undefined && (
                <>
                  <EuiDescriptionListTitle>User ID (UID)</EuiDescriptionListTitle>
                  <EuiDescriptionListDescription>
                    <EuiBadge color={selectedProcess.uid === 0 ? 'danger' : 'default'}>
                      {selectedProcess.uid}
                    </EuiBadge>
                  </EuiDescriptionListDescription>
                </>
              )}

              {selectedProcess.gid !== undefined && (
                <>
                  <EuiDescriptionListTitle>Group ID (GID)</EuiDescriptionListTitle>
                  <EuiDescriptionListDescription>
                    <EuiBadge>{selectedProcess.gid}</EuiBadge>
                  </EuiDescriptionListDescription>
                </>
              )}

              <EuiDescriptionListTitle>Timestamp</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                {new Date(selectedProcess.timestamp).toLocaleString()}
              </EuiDescriptionListDescription>

              <EuiDescriptionListTitle>Type</EuiDescriptionListTitle>
              <EuiDescriptionListDescription>
                <EuiBadge color="hollow">{selectedProcess.type}</EuiBadge>
              </EuiDescriptionListDescription>
            </EuiDescriptionList>
          </>
        ),
      },
      {
        id: 'agent',
        name: 'Agent Info',
        content: (
          <>
            <EuiSpacer size="m" />
            {selectedProcess.agent ? (
              <EuiDescriptionList>
                <EuiDescriptionListTitle>Agent ID</EuiDescriptionListTitle>
                <EuiDescriptionListDescription>
                  {selectedProcess.agent.id}
                </EuiDescriptionListDescription>

                <EuiDescriptionListTitle>Agent Name</EuiDescriptionListTitle>
                <EuiDescriptionListDescription>
                  {selectedProcess.agent.name}
                </EuiDescriptionListDescription>
              </EuiDescriptionList>
            ) : (
              <EuiText color="subdued">No agent information available</EuiText>
            )}
          </>
        ),
      },
      {
        id: 'rule',
        name: 'Rule Info',
        content: (
          <>
            <EuiSpacer size="m" />
            {selectedProcess.rule ? (
              <EuiDescriptionList>
                <EuiDescriptionListTitle>Description</EuiDescriptionListTitle>
                <EuiDescriptionListDescription>
                  {selectedProcess.rule.description}
                </EuiDescriptionListDescription>

                <EuiDescriptionListTitle>Level</EuiDescriptionListTitle>
                <EuiDescriptionListDescription>
                  <EuiBadge color={
                    selectedProcess.rule.level >= 10 ? 'danger' :
                    selectedProcess.rule.level >= 7 ? 'warning' : 'default'
                  }>
                    {selectedProcess.rule.level}
                  </EuiBadge>
                </EuiDescriptionListDescription>
              </EuiDescriptionList>
            ) : (
              <EuiText color="subdued">No rule information available</EuiText>
            )}
          </>
        ),
      },
      {
        id: 'raw',
        name: 'Raw Data',
        content: (
          <>
            <EuiSpacer size="m" />
            <EuiCodeBlock language="json" fontSize="s" paddingSize="m" isCopyable>
              {JSON.stringify(selectedProcess.rawData || selectedProcess, null, 2)}
            </EuiCodeBlock>
          </>
        ),
      },
    ];

    return (
      <EuiFlyout
        onClose={() => setIsFlyoutVisible(false)}
        size="m"
        aria-labelledby="processDetailsFlyout"
      >
        <EuiFlyoutHeader hasBorder>
          <EuiTitle size="m">
            <h2>Process Details</h2>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            {selectedProcess.name} (PID: {selectedProcess.pid})
          </EuiText>
        </EuiFlyoutHeader>
        <EuiFlyoutBody>
          <EuiTabbedContent tabs={tabs} initialSelectedTab={tabs[0]} />
        </EuiFlyoutBody>
      </EuiFlyout>
    );
  };

  // Конвертация в формат дерева для EuiTreeView
  const treeItems: EuiTreeViewProps['items'] = useMemo(() => {
    const convertToTreeItem = (node: ProcessNode): any => {
      const isRoot = node.ppid === 0;
      const isSystem = node.uid === 0;
      const isNew = node.isNew;
      
      const label = (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            handleProcessClick(node);
          }}
          style={{ 
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '4px',
            transition: 'all 0.3s ease',
            backgroundColor: isNew ? '#E6F9F5' : 'transparent',
            border: isNew ? '2px solid #00BFB3' : '2px solid transparent',
            animation: isNew ? 'pulse 2s ease-in-out' : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isNew) {
              e.currentTarget.style.backgroundColor = '#F5F7FA';
            }
          }}
          onMouseLeave={(e) => {
            if (!isNew) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <EuiFlexGroup alignItems="center" gutterSize="s" responsive={false}>
            {isNew && (
              <EuiFlexItem grow={false}>
                <EuiBadge color="success" iconType="bullseye">NEW</EuiBadge>
              </EuiFlexItem>
            )}
            <EuiFlexItem grow={false}>
              <EuiHealth color={isSystem ? 'danger' : isRoot ? 'warning' : 'success'} />
            </EuiFlexItem>
            <EuiFlexItem grow={false} style={{ minWidth: 150, maxWidth: 400 }}>
              <EuiText 
                size="s" 
                style={{ 
                  fontWeight: isRoot ? 'bold' : 'normal',
                  fontFamily: 'monospace',
                  color: isSystem ? '#BD271E' : 'inherit',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {node.name}
                {node.cwd && ` - ${node.cwd}`}
                {node.command && ` - ${node.command}`}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color={isSystem ? 'danger' : 'hollow'}>
                PID: {node.pid}
              </EuiBadge>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiBadge color={isRoot ? 'warning' : 'hollow'}>
                PPID: {node.ppid || 0}
              </EuiBadge>
            </EuiFlexItem>
            {node.uid !== undefined && (
              <EuiFlexItem grow={false}>
                <EuiBadge color={node.uid === 0 ? 'danger' : 'default'}>
                  UID: {node.uid}
                </EuiBadge>
              </EuiFlexItem>
            )}
            <EuiFlexItem grow={false}>
              <EuiText size="xs" color="subdued">
                {new Date(node.timestamp).toLocaleTimeString()}
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </div>
      );
      
      return {
        id: `process-${node.pid}-${node._id}`,
        label,
        icon: <EuiIcon type={isRoot ? 'node' : 'gear'} size="s" />,
        children: node.children.length > 0 
          ? node.children.map(convertToTreeItem)
          : undefined,
        isExpanded: expandedNodes[`process-${node.pid}-${node._id}`] || node.depth < 1 || isNew,
      };
    };
    
    return buildProcessTree.map(convertToTreeItem);
  }, [buildProcessTree, expandedNodes]);

  // Обработчики
  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
    setCustomTimeRange({ from: range.value, to: 'now' });
  };

  const handleCustomTimeChange = ({ start, end }: { start: string; end: string }) => {
    setCustomTimeRange({ from: start, to: end });
    setSelectedTimeRange({ text: 'Custom', value: start });
  };

  const handleExpandAll = () => {
    const newExpanded: Record<string, boolean> = {};
    processes.forEach(p => {
      newExpanded[`process-${p.pid}-${p._id}`] = true;
    });
    setExpandedNodes(newExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedNodes({});
  };

  const handleManualRefresh = () => {
    lastTimestampRef.current = null;
    processMapRef.current.clear();
    initialLoad();
  };

  // Рендер контента в зависимости от режима просмотра
  const renderContent = () => {
    const filteredData = buildProcessTree;

    if (viewMode === 'list') {
      const flattenTree = (nodes: ProcessNode[]): ProcessNode[] => {
        let result: ProcessNode[] = [];
        nodes.forEach(node => {
          result.push(node);
          if (node.children.length > 0) {
            result = result.concat(flattenTree(node.children));
          }
        });
        return result;
      };

      const flatList = flattenTree(filteredData);

      return (
        <EuiPanel paddingSize="m">
          <EuiFlexGroup>
            <EuiFlexItem>
              <EuiTitle size="xs"><h3>Process List</h3></EuiTitle>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="s" color="subdued">
                {flatList.length} processes
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
          <EuiSpacer size="m" />
          
          {flatList.map(process => (
            <div 
              key={process._id} 
              onClick={() => handleProcessClick(process)}
              style={{ 
                padding: '12px',
                marginBottom: '4px',
                borderRadius: '4px',
                border: process.isNew ? '2px solid #00BFB3' : '1px solid #D3DAE6',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backgroundColor: process.isNew ? '#E6F9F5' : 'white',
                animation: process.isNew ? 'slideIn 0.5s ease' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!process.isNew) {
                  e.currentTarget.style.backgroundColor = '#F5F7FA';
                  e.currentTarget.style.borderColor = '#98A2B3';
                }
              }}
              onMouseLeave={(e) => {
                if (!process.isNew) {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#D3DAE6';
                }
              }}
            >
              <EuiFlexGroup alignItems="center" responsive={false}>
                {process.isNew && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="success" iconType="bullseye">NEW</EuiBadge>
                  </EuiFlexItem>
                )}
                <EuiFlexItem grow={false} style={{ width: 80 }}>
                  <EuiBadge color="hollow">PID: {process.pid}</EuiBadge>
                </EuiFlexItem>
                <EuiFlexItem grow={false} style={{ width: 100 }}>
                  <EuiBadge color="hollow">PPID: {process.ppid || 0}</EuiBadge>
                </EuiFlexItem>
                <EuiFlexItem>
                  <div>
                    <EuiText size="s" style={{ fontWeight: 'bold' }}>
                      {process.name}
                    </EuiText>
                    {process.exe && (
                      <EuiText size="xs" color="subdued">
                        {process.exe}
                      </EuiText>
                    )}
                  </div>
                </EuiFlexItem>
                {process.uid !== undefined && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color={process.uid === 0 ? 'danger' : 'default'}>
                      UID: {process.uid}
                    </EuiBadge>
                  </EuiFlexItem>
                )}
                <EuiFlexItem grow={false} style={{ width: 120 }}>
                  <EuiText size="xs" color="subdued">
                    {new Date(process.timestamp).toLocaleTimeString()}
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </div>
          ))}
        </EuiPanel>
      );
    }

    return (
      <EuiPanel paddingSize="none">
        <div style={{ 
          maxHeight: '70vh', 
          overflow: 'auto', 
          padding: '16px',
          backgroundColor: '#FAFBFD',
        }}>
          {treeItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <EuiIcon type="eyeClosed" size="xl" color="subdued" />
              <EuiSpacer size="m" />
              <EuiText color="subdued">
                No processes found. Try changing the time range or filters.
              </EuiText>
            </div>
          ) : (
            <EuiTreeView
              items={treeItems}
              display="compressed"
              showExpansionArrows
              expandByDefault={false}
              aria-label="Process Tree"
            />
          )}
        </div>
      </EuiPanel>
    );
  };

  return (
    <EuiPage>
      <EuiPageBody>
        <EuiPageHeader 
          pageTitle="Process Tree Viewer" 
          description="Real-time process monitoring and analysis"
          rightSideItems={[
            <EuiFlexGroup gutterSize="s" alignItems="center">
              {isUpdating && (
                <EuiFlexItem grow={false}>
                  <EuiLoadingSpinner size="m" />
                </EuiFlexItem>
              )}
              {lastUpdateTime && (
                <EuiFlexItem grow={false}>
                  <EuiText size="xs" color="subdued">
                    Last update: {lastUpdateTime.toLocaleTimeString()}
                    {newProcessCount > 0 && (
                      <EuiTextColor color="success">
                        {' '}(+{newProcessCount} new)
                      </EuiTextColor>
                    )}
                  </EuiText>
                </EuiFlexItem>
              )}
              <EuiFlexItem grow={false}>
                <EuiButton
                  size="s"
                  onClick={handleManualRefresh}
                  iconType="refresh"
                  isLoading={loading}
                >
                  Full Refresh
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiSwitch
                  label="Live updates"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              </EuiFlexItem>
            </EuiFlexGroup>
          ]}
        />
        
        {isUpdating && <EuiProgress size="xs" color="primary" position="absolute" />}
        
        <EuiPageContent>
          <EuiPageContentBody>
            {/* Панель управления */}
            <EuiPanel>
              <EuiFlexGroup gutterSize="m" alignItems="flexEnd">
                <EuiFlexItem grow={2}>
                  <EuiFormRow label="Data Source" fullWidth>
                    <EuiSelect
                      value={selectedIndex}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setSelectedIndex(e.target.value);
                        lastTimestampRef.current = null;
                        processMapRef.current.clear();
                      }}
                      options={[
                        { value: '', text: 'Select index...' },
                        ...indices.map(index => ({
                          value: index.index,
                          text: `${index.index} (${index['docs.count']} docs)`,
                        })),
                      ]}
                      isLoading={loadingIndices}
                      fullWidth
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                
                <EuiFlexItem grow={2}>
                  <EuiFormRow label="Time Range" fullWidth>
                    <EuiSelect
                      value={selectedTimeRange.value}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        const range = TIME_RANGES.find(r => r.value === e.target.value);
                        if (range) handleTimeRangeChange(range);
                      }}
                      options={TIME_RANGES.map(range => ({
                        value: range.value,
                        text: range.text,
                      }))}
                      fullWidth
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                
                <EuiFlexItem grow={2}>
                  <EuiFormRow label="Custom Range" fullWidth>
                    <EuiSuperDatePicker
                      start={customTimeRange.from}
                      end={customTimeRange.to}
                      onTimeChange={handleCustomTimeChange}
                      showUpdateButton={false}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
              
              <EuiSpacer size="m" />
              
              <EuiFlexGroup gutterSize="m" alignItems="center">
                <EuiFlexItem grow={3}>
                  <EuiFormRow label="Search Processes" fullWidth>
                    <EuiFieldSearch
                      placeholder="Search by name, PID, PPID, exe, command, cwd..."
                      value={searchQuery}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                      isClearable
                      fullWidth
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                
                <EuiFlexItem grow={1}>
                  <EuiFormRow label="Limit" fullWidth>
                    <EuiRange
                      min={100}
                      max={5000}
                      step={100}
                      value={limit}
                      onChange={(event, isValid) => {
                        if (!isValid) return;
                        setLimit(Number(event.currentTarget.value));
                      }}
                      showValue
                      fullWidth
                    />
                  </EuiFormRow>
                </EuiFlexItem>
                
                <EuiFlexItem grow={false}>
                  <EuiFormRow hasEmptyLabelSpace>
                    <EuiCheckbox
                      id="show-system"
                      label="Show system processes"
                      checked={showSystemProcesses}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setShowSystemProcesses(e.target.checked)}
                    />
                  </EuiFormRow>
                </EuiFlexItem>
              </EuiFlexGroup>
              
              <EuiSpacer size="m" />
              
              <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
                <EuiFlexItem grow={false}>
                  <EuiButtonGroup
                    legend="View mode"
                    options={[
                      { id: 'tree', label: 'Tree View', iconType: 'branch' },
                      { id: 'list', label: 'List View', iconType: 'list' },
                    ]}
                    idSelected={viewMode}
                    onChange={(id: string) => setViewMode(id as 'tree' | 'list')}
                    isFullWidth
                  />
                </EuiFlexItem>
                
                {viewMode === 'tree' && (
                  <EuiFlexItem grow={false}>
                    <EuiFlexGroup gutterSize="s">
                      <EuiFlexItem grow={false}>
                        <EuiButton size="s" onClick={handleExpandAll}>
                          Expand All
                        </EuiButton>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiButton size="s" onClick={handleCollapseAll}>
                          Collapse All
                        </EuiButton>
                      </EuiFlexItem>
                    </EuiFlexGroup>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiPanel>

            <EuiSpacer size="l" />

            {processes.length > 0 && (
              <>
                <EuiPanel paddingSize="m">
                  <EuiTitle size="xs"><h3>Statistics</h3></EuiTitle>
                  <EuiSpacer size="m" />
                  <EuiFlexGroup>
                    <EuiFlexItem>
                      <EuiStat
                        title={stats.total.toString()}
                        description="Total processes"
                        titleColor="primary"
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiStat
                        title={stats.uniquePids.toString()}
                        description="Unique PIDs"
                        titleColor="success"
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiStat
                        title={stats.rootProcesses.toString()}
                        description="Root processes"
                        titleColor="warning"
                      />
                    </EuiFlexItem>
                    <EuiFlexItem>
                      <EuiStat
                        title={stats.systemProcesses.toString()}
                        description="System processes"
                        titleColor="danger"
                      />
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  
                  {stats.top5.length > 0 && (
                    <>
                      <EuiSpacer size="m" />
                      <EuiText size="xs" color="subdued">
                        <strong>Most frequent processes:</strong>{' '}
                        {stats.top5.map((p, i) => (
                          <EuiBadge key={i} color="hollow" style={{ marginRight: 4 }}>
                            {p.name}: {p.count}
                          </EuiBadge>
                        ))}
                      </EuiText>
                    </>
                  )}
                </EuiPanel>
                
                <EuiSpacer size="l" />
              </>
            )}

            {error && (
              <>
                <EuiCallOut title="Error" color="danger" iconType="alert">
                  <EuiText size="s">{error}</EuiText>
                  <EuiSpacer size="s" />
                  <EuiButton onClick={handleManualRefresh} iconType="refresh" size="s">
                    Retry
                  </EuiButton>
                </EuiCallOut>
                <EuiSpacer size="l" />
              </>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <EuiLoadingSpinner size="xl" />
                <EuiSpacer size="m" />
                <EuiText>Loading process data...</EuiText>
              </div>
            )}

            {!loading && renderContent()}

            {renderProcessDetailsFlyout()}
          </EuiPageContentBody>
        </EuiPageContent>
      </EuiPageBody>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </EuiPage>
  );
};
