import React, { ChangeEvent } from 'react';
import {
  EuiPage,
  EuiPageBody,
  EuiPageContent,
  EuiEmptyPrompt,
  EuiIcon,
  EuiText,
  EuiSpacer,
  EuiPanel,
  EuiFormRow,
  EuiSelect,
  EuiComboBox,
  EuiButton,
  EuiCallOut,
} from '@elastic/eui';
import { IndexInfo, Agent, ComboBoxOption } from '../types/process';

interface SetupScreenProps {
  indices: IndexInfo[];
  loadingIndices: boolean;
  agents: Agent[];
  loadingAgents: boolean;
  selectedIndex: string;
  selectedAgents: ComboBoxOption[];
  agentOptions: ComboBoxOption[];
  onIndexChange: (index: string) => void;
  onAgentsChange: (agents: ComboBoxOption[]) => void;
  onStart: () => void;
  error: string | null;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({
  indices,
  loadingIndices,
  agents,
  loadingAgents,
  selectedIndex,
  selectedAgents,
  agentOptions,
  onIndexChange,
  onAgentsChange,
  onStart,
  error,
}) => {
  return (
    <EuiPage>
      <EuiPageBody>
        <EuiPageContent verticalPosition="center" horizontalPosition="center">
          <EuiEmptyPrompt
            icon={<EuiIcon type="search" size="xxl" />}
            title={<h2>Process Tree Viewer</h2>}
            body={
              <>
                <EuiText>
                  <p>Select data source and agents to start monitoring</p>
                </EuiText>
                <EuiSpacer size="xl" />

                <EuiPanel style={{ maxWidth: 700, margin: '0 auto' }}>
                  <EuiFormRow label="Data Source" fullWidth>
                    <EuiSelect
                      value={selectedIndex}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        onIndexChange(e.target.value);
                      }}
                      options={[
                        { value: '', text: 'Select index...' },
                        ...indices.map((index) => ({
                          value: index.index,
                          text: `${index.index} (${index['docs.count']} docs)`,
                        })),
                      ]}
                      isLoading={loadingIndices}
                      fullWidth
                    />
                  </EuiFormRow>

                  <EuiSpacer size="m" />

                  <EuiFormRow
                    label="Agents"
                    fullWidth
                    helpText={
                      !selectedIndex
                        ? 'Select an index first'
                        : loadingAgents
                        ? 'Loading agents...'
                        : agents.length === 0
                        ? 'No agents found in selected index'
                        : `${agents.length} agents available`
                    }
                  >
                    <EuiComboBox
                      placeholder="Select one or more agents..."
                      options={agentOptions}
                      selectedOptions={selectedAgents}
                      onChange={onAgentsChange}
                      isLoading={loadingAgents}
                      isDisabled={!selectedIndex || agents.length === 0}
                      isClearable
                      fullWidth
                    />
                  </EuiFormRow>

                  {error && (
                    <>
                      <EuiSpacer size="m" />
                      <EuiCallOut title="Error" color="danger" iconType="alert" size="s">
                        {error}
                      </EuiCallOut>
                    </>
                  )}

                  <EuiSpacer size="xl" />

                  <EuiButton
                    fill
                    fullWidth
                    onClick={onStart}
                    isDisabled={!selectedIndex || selectedAgents.length === 0}
                    iconType="play"
                  >
                    Start Monitoring
                  </EuiButton>
                </EuiPanel>
              </>
            }
          />
        </EuiPageContent>
      </EuiPageBody>
    </EuiPage>
  );
};
