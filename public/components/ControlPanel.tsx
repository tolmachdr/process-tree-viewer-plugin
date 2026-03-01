import React, { ChangeEvent } from 'react';
import {
  EuiPanel,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiSelect,
  EuiSuperDatePicker,
  EuiComboBox,
  EuiFieldSearch,
  EuiCheckbox,
  EuiButtonGroup,
  EuiButton,
  EuiSpacer,
} from '@elastic/eui';
import { IndexInfo, Agent, TimeRange, ComboBoxOption, TIME_RANGES } from '../types/process';

interface ControlPanelProps {
  indices: IndexInfo[];
  loadingIndices: boolean;
  agents: Agent[];
  loadingAgents: boolean;
  selectedIndex: string;
  selectedAgents: ComboBoxOption[];
  agentOptions: ComboBoxOption[];
  selectedTimeRange: TimeRange;
  customTimeRange: { from: string; to: string };
  searchQuery: string;
  showSystemProcesses: boolean;
  viewMode: 'tree' | 'list';
  onIndexChange: (index: string) => void;
  onAgentsChange: (agents: ComboBoxOption[]) => void;
  onTimeRangeChange: (range: TimeRange) => void;
  onCustomTimeChange: (range: { start: string; end: string }) => void;
  onSearchChange: (query: string) => void;
  onSystemProcessesChange: (show: boolean) => void;
  onViewModeChange: (mode: 'tree' | 'list') => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  indices,
  loadingIndices,
  agents,
  loadingAgents,
  selectedIndex,
  selectedAgents,
  agentOptions,
  selectedTimeRange,
  customTimeRange,
  searchQuery,
  showSystemProcesses,
  viewMode,
  onIndexChange,
  onAgentsChange,
  onTimeRangeChange,
  onCustomTimeChange,
  onSearchChange,
  onSystemProcessesChange,
  onViewModeChange,
  onExpandAll,
  onCollapseAll,
}) => {
  return (
    <EuiPanel>
      <EuiFlexGroup gutterSize="m" alignItems="flexEnd">
        <EuiFlexItem grow={2}>
          <EuiFormRow label="Data Source" fullWidth>
            <EuiSelect
              value={selectedIndex}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => onIndexChange(e.target.value)}
              options={[
                { value: '', text: 'Select index...' },
                ...indices.map((idx) => ({
                  value: idx.index,
                  text: `${idx.index} (${idx['docs.count']} docs)`,
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
                const range = TIME_RANGES.find((r) => r.value === e.target.value);
                if (range) onTimeRangeChange(range);
              }}
              options={TIME_RANGES.map((r) => ({ value: r.value, text: r.text }))}
              fullWidth
            />
          </EuiFormRow>
        </EuiFlexItem>

        <EuiFlexItem grow={2}>
          <EuiFormRow label="Custom Range" fullWidth>
            <EuiSuperDatePicker
              start={customTimeRange.from}
              end={customTimeRange.to}
              onTimeChange={onCustomTimeChange}
              showUpdateButton={false}
            />
          </EuiFormRow>
        </EuiFlexItem>
      </EuiFlexGroup>

      <EuiSpacer size="m" />

      <EuiFlexGroup gutterSize="m" alignItems="flexEnd">
        <EuiFlexItem grow={2}>
          <EuiFormRow
            label="Agents"
            fullWidth
            helpText={
              !selectedIndex
                ? 'Select an index first'
                : loadingAgents
                ? 'Loading agents...'
                : agents.length === 0
                ? 'No agents found'
                : `${agents.length} agents available`
            }
          >
            <EuiComboBox
              placeholder="Select agents (all if empty)"
              options={agentOptions}
              selectedOptions={selectedAgents}
              onChange={onAgentsChange}
              isLoading={loadingAgents}
              isDisabled={!selectedIndex || agents.length === 0}
              isClearable
              fullWidth
            />
          </EuiFormRow>
        </EuiFlexItem>

        <EuiFlexItem grow={3}>
          <EuiFormRow
            label="Search Processes"
            fullWidth
            helpText="Search by name, PID, PPID, UID, exe, command, cwd"
          >
            <EuiFieldSearch
              placeholder="Search..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
              isClearable
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
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onSystemProcessesChange(e.target.checked)
              }
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
            onChange={(id: string) => onViewModeChange(id as 'tree' | 'list')}
            isFullWidth
          />
        </EuiFlexItem>

        {viewMode === 'tree' && (
          <EuiFlexItem grow={false}>
            <EuiFlexGroup gutterSize="s">
              <EuiFlexItem grow={false}>
                <EuiButton size="s" onClick={onExpandAll}>
                  Expand All
                </EuiButton>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton size="s" onClick={onCollapseAll}>
                  Collapse All
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    </EuiPanel>
  );
};
