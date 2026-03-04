import React from 'react';
import {
  EuiPanel,
  EuiTitle,
  EuiSpacer,
  EuiFlexGroup,
  EuiFlexItem,
  EuiStat,
  EuiText,
  EuiBadge,
} from '@elastic/eui';
import { processStats } from '../utils/processStats';

interface StatsPanelProps {
  stats: ReturnType<typeof processStats>;
  loadedCount: number;
  totalCount: number;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, loadedCount, totalCount }) => {
  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs">
        <h3>Statistics</h3>
      </EuiTitle>
      <EuiSpacer size="m" />
      <EuiFlexGroup>
        <EuiFlexItem>
          <EuiStat
            title={`${loadedCount}${totalCount > loadedCount ? ` / ${totalCount}` : ''}`}
            description="Loaded / Total"
            titleColor="primary"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiStat
            title={String(stats.uniquePids)}
            description="Unique PIDs"
            titleColor="success"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiStat
            title={String(stats.rootProcesses)}
            description="Root processes"
            titleColor="warning"
          />
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiStat
            title={String(stats.systemProcesses)}
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
  );
};
