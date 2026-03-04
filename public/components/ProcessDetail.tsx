import React from 'react';
import {
  EuiFlyout,
  EuiFlyoutHeader,
  EuiFlyoutBody,
  EuiTitle,
  EuiText,
  EuiSpacer,
  EuiTabbedContent,
  EuiDescriptionList,
  EuiDescriptionListTitle,
  EuiDescriptionListDescription,
  EuiBadge,
  EuiCodeBlock,
} from '@elastic/eui';
import { Process } from '../types/process';

interface ProcessDetailProps {
  process: Process | null;
  isVisible: boolean;
  onClose: () => void;
}

export const ProcessDetail: React.FC<ProcessDetailProps> = ({
  process: selectedProcess,
  isVisible,
  onClose,
}) => {
  if (!isVisible || !selectedProcess) return null;

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

            {selectedProcess.execve && (
              <>
                <EuiDescriptionListTitle>Execve Details</EuiDescriptionListTitle>
                <EuiDescriptionListDescription>
                  <EuiCodeBlock language="json" paddingSize="s" fontSize="s">
                    {JSON.stringify(selectedProcess.execve, null, 2)}
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
                <EuiBadge
                  color={
                    selectedProcess.rule.level >= 10
                      ? 'danger'
                      : selectedProcess.rule.level >= 7
                      ? 'warning'
                      : 'default'
                  }
                >
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
      onClose={onClose}
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
