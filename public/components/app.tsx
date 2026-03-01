import React, { useState, useCallback, useMemo } from 'react';
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
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiBadge,
  EuiSwitch,
  EuiProgress,
  EuiTextColor,
  EuiButtonEmpty,
} from '@elastic/eui';

import { ComboBoxOption, TimeRange, TIME_RANGES, Process, ProcessNode } from '../types/process';
import { buildProcessTree } from '../utils/buildProcessTree';
import { processStats } from '../utils/processStats';
import { useIndices } from '../hooks/useIndices';
import { useAgents } from '../hooks/useAgents';
import { useProcesses } from '../hooks/useProcesses';
import { SetupScreen } from './SetupScreen';
import { ControlPanel } from './ControlPanel';
import { StatsPanel } from './StatsPanel';
import { ProcessTree } from './ProcessTree';
import { ProcessDetail } from './ProcessDetail';

interface Props {
  http: {
    get: (path: string, options?: any) => Promise<any>;
    post: (path: string, options?: any) => Promise<any>;
  };
}

export const ProcessTreeViewerApp: React.FC<Props> = ({ http }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Index & agent selection
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [selectedAgents, setSelectedAgents] = useState<ComboBoxOption[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TIME_RANGES[3]);
  const [customTimeRange, setCustomTimeRange] = useState({ from: 'now-1h', to: 'now' });

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [showSystemProcesses, setShowSystemProcesses] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [isFlyoutVisible, setIsFlyoutVisible] = useState(false);

  // Data hooks
  const { indices, loadingIndices, error: indicesError } = useIndices(http);
  const { agents, loadingAgents } = useAgents(http, selectedIndex);

  const getSelectedAgentIds = useCallback((): string[] => {
    return selectedAgents
      .map((a) => a.value)
      .filter((v): v is string => v !== undefined);
  }, [selectedAgents]);

  const {
    processes,
    setProcesses,
    loading,
    loadingMore,
    hasMore,
    setHasMore,
    setCurrentOffset,
    totalProcesses,
    isUpdating,
    lastUpdateTime,
    newProcessCount,
    error: processesError,
    setError: setProcessesError,
    lastTimestampRef,
    processMapRef,
    scrollContainerRef,
    initialLoad,
    loadMore,
    incrementalUpdate,
  } = useProcesses(
    http,
    selectedIndex,
    selectedTimeRange,
    customTimeRange,
    getSelectedAgentIds,
    isInitialized
  );

  const error = indicesError || processesError;

  // Auto-refresh
  React.useEffect(() => {
    if (!autoRefresh || !selectedIndex || !isInitialized) return;
    const id = setInterval(incrementalUpdate, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, selectedIndex, incrementalUpdate, isInitialized]);

  // Expand new nodes on incremental update
  React.useEffect(() => {
    const newProcs = processes.filter((p) => p.isNew);
    if (newProcs.length === 0) return;
    setExpandedNodes((prev) => {
      const next = { ...prev };
      newProcs.forEach((p) => {
        next[`process-${p.pid}-${p._id}`] = true;
      });
      return next;
    });
  }, [processes]);

  const agentOptions: ComboBoxOption[] = useMemo(() => {
    return agents.map((agent) => ({
      label: `${agent.name} (${agent.id}) - ${agent.count} events`,
      value: agent.id,
    }));
  }, [agents]);

  const treeNodes = useMemo(
    () => buildProcessTree(processes, searchQuery, showSystemProcesses),
    [processes, searchQuery, showSystemProcesses]
  );

  const stats = useMemo(() => processStats(processes), [processes]);

  // Handlers
  const handleToggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleProcessClick = useCallback((process: Process) => {
    setSelectedProcess(process);
    setIsFlyoutVisible(true);
  }, []);

  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
    setCustomTimeRange({ from: range.value, to: 'now' });
  };

  const handleCustomTimeChange = ({ start, end }: { start: string; end: string }) => {
    setCustomTimeRange({ from: start, to: end });
    setSelectedTimeRange({ text: 'Custom', value: start });
  };

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    const walk = (nodes: ProcessNode[]) => {
      nodes.forEach((n) => {
        next[`process-${n.pid}-${n._id}`] = true;
        if (n.children.length) walk(n.children);
      });
    };
    walk(treeNodes);
    setExpandedNodes(next);
  };

  const handleCollapseAll = () => setExpandedNodes({});

  const handleManualRefresh = () => {
    lastTimestampRef.current = null;
    setCurrentOffset(0);
    setHasMore(true);
    processMapRef.current.clear();
    initialLoad();
  };

  const handleStartMonitoring = () => {
    if (!selectedIndex) {
      setProcessesError('Выберите индекс');
      return;
    }
    if (selectedAgents.length === 0) {
      setProcessesError('Выберите хотя бы одного агента');
      return;
    }
    setProcessesError(null);
    setIsInitialized(true);
    initialLoad();
  };

  const handleReset = () => {
    setIsInitialized(false);
    setProcesses([]);
    setProcessesError(null);
    setCurrentOffset(0);
    setHasMore(true);
    lastTimestampRef.current = null;
    processMapRef.current.clear();
  };

  const handleIndexChange = (index: string) => {
    setSelectedIndex(index);
    lastTimestampRef.current = null;
    processMapRef.current.clear();
    setSelectedAgents([]);
  };

  // Setup screen
  if (!isInitialized) {
    return (
      <SetupScreen
        indices={indices}
        loadingIndices={loadingIndices}
        agents={agents}
        loadingAgents={loadingAgents}
        selectedIndex={selectedIndex}
        selectedAgents={selectedAgents}
        agentOptions={agentOptions}
        onIndexChange={(index) => {
          setSelectedIndex(index);
          setSelectedAgents([]);
          setProcessesError(null);
        }}
        onAgentsChange={(selected) => {
          setSelectedAgents(selected);
          setProcessesError(null);
        }}
        onStart={handleStartMonitoring}
        error={error}
      />
    );
  }

  // Flat list for list view
  const flatten = (nodes: ProcessNode[]): ProcessNode[] =>
    nodes.reduce<ProcessNode[]>((acc, n) => [...acc, n, ...flatten(n.children)], []);
  const flatList = flatten(treeNodes);

  return (
    <EuiPage>
      <EuiPageBody>
        <EuiPageHeader
          pageTitle="Process Tree Viewer"
          description={`Monitoring: ${selectedAgents.map((a) => a.label).join(', ')}`}
          rightSideItems={[
            <EuiFlexGroup gutterSize="s" alignItems="center" key="header-controls">
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
                      <EuiTextColor color="success"> (+{newProcessCount} new)</EuiTextColor>
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
                  Refresh
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiSwitch
                  label="Live updates"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="s"
                  onClick={handleReset}
                  iconType="cross"
                  color="danger"
                >
                  Reset
                </EuiButtonEmpty>
              </EuiFlexItem>
            </EuiFlexGroup>,
          ]}
        />

        {isUpdating && <EuiProgress size="xs" color="primary" position="absolute" />}

        <EuiPageContent>
          <EuiPageContentBody>
            <ControlPanel
              indices={indices}
              loadingIndices={loadingIndices}
              agents={agents}
              loadingAgents={loadingAgents}
              selectedIndex={selectedIndex}
              selectedAgents={selectedAgents}
              agentOptions={agentOptions}
              selectedTimeRange={selectedTimeRange}
              customTimeRange={customTimeRange}
              searchQuery={searchQuery}
              showSystemProcesses={showSystemProcesses}
              viewMode={viewMode}
              onIndexChange={handleIndexChange}
              onAgentsChange={setSelectedAgents}
              onTimeRangeChange={handleTimeRangeChange}
              onCustomTimeChange={handleCustomTimeChange}
              onSearchChange={setSearchQuery}
              onSystemProcessesChange={setShowSystemProcesses}
              onViewModeChange={setViewMode}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
            />

            <EuiSpacer size="l" />

            {processes.length > 0 && (
              <>
                <StatsPanel
                  stats={stats}
                  loadedCount={stats.total}
                  totalCount={totalProcesses}
                />
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
              <div style={{ textAlign: 'center', padding: 40 }}>
                <EuiLoadingSpinner size="xl" />
                <EuiSpacer size="m" />
                <EuiText>Loading process data...</EuiText>
              </div>
            )}

            {!loading && viewMode === 'list' && (
              <EuiPanel paddingSize="m">
                <EuiFlexGroup>
                  <EuiFlexItem>
                    <EuiText size="s">
                      <strong>Process List</strong>
                    </EuiText>
                  </EuiFlexItem>
                  <EuiFlexItem grow={false}>
                    <EuiText size="s" color="subdued">
                      {flatList.length} processes {hasMore && '(scroll for more)'}
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
                <EuiSpacer size="m" />

                <div
                  ref={scrollContainerRef}
                  style={{ maxHeight: '70vh', overflow: 'auto' }}
                >
                  {flatList.map((process, idx) => (
                    <div
                      key={`${process._id}-${idx}`}
                      onClick={() => handleProcessClick(process)}
                      style={{
                        padding: '12px',
                        paddingLeft: `${process.depth * 24 + 12}px`,
                        marginBottom: 2,
                        borderRadius: 4,
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
                          <EuiText size="s" style={{ fontWeight: 'bold' }}>{process.name}</EuiText>
                          {process.exe && (
                            <EuiText size="xs" color="subdued">{process.exe}</EuiText>
                          )}
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

                  {loadingMore && (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <EuiLoadingSpinner size="m" />
                      <EuiSpacer size="s" />
                      <EuiText size="s" color="subdued">Loading more processes...</EuiText>
                    </div>
                  )}

                  {!hasMore && flatList.length > 0 && (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <EuiText size="s" color="subdued">No more processes to load</EuiText>
                    </div>
                  )}
                </div>
              </EuiPanel>
            )}

            {!loading && viewMode === 'tree' && (
              <EuiPanel paddingSize="none">
                <div
                  ref={scrollContainerRef}
                  style={{
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    padding: 16,
                    backgroundColor: '#FAFBFD',
                    display: 'block',
                    position: 'relative',
                  }}
                >
                  <ProcessTree
                    nodes={treeNodes}
                    expandedNodes={expandedNodes}
                    onToggle={handleToggleNode}
                    onProcessClick={handleProcessClick}
                  />

                  {loadingMore && (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <EuiLoadingSpinner size="m" />
                      <EuiSpacer size="s" />
                      <EuiText size="s" color="subdued">Loading more processes...</EuiText>
                    </div>
                  )}

                  {!hasMore && processes.length > 0 && (
                    <div style={{ textAlign: 'center', padding: 20 }}>
                      <EuiText size="s" color="subdued">No more processes to load</EuiText>
                    </div>
                  )}
                </div>
              </EuiPanel>
            )}

            <ProcessDetail
              process={selectedProcess}
              isVisible={isFlyoutVisible}
              onClose={() => setIsFlyoutVisible(false)}
            />
          </EuiPageContentBody>
        </EuiPageContent>
      </EuiPageBody>

      <style>{`
        @keyframes nodePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }
        @keyframes slideIn {
          from { transform: translateX(-20px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </EuiPage>
  );
};
