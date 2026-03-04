import React from 'react';
import {
  EuiIcon,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiToolTip,
  EuiHealth,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import { Process, ProcessNode } from '../types/process';

interface ProcessTreeNodeProps {
  node: ProcessNode;
  depth: number;
  expandedNodes: Record<string, boolean>;
  onToggle: (id: string) => void;
  onProcessClick: (process: Process) => void;
}

export const ProcessTreeNode: React.FC<ProcessTreeNodeProps> = React.memo(
  ({ node, depth, expandedNodes, onToggle, onProcessClick }) => {
    const nodeId = `process-${node.pid}-${node._id}`;
    const isExpanded = expandedNodes[nodeId] ?? (depth < 1 || !!node.isNew);
    const hasChildren = node.children.length > 0;
    const isRoot = node.ppid === 0;
    const isSystem = node.uid === 0;
    const isNew = node.isNew;
    const indentWidth = 24;

    return (
      <div
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Сам узел */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingLeft: depth * indentWidth,
            minHeight: 36,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Вертикальная линия */}
          {depth > 0 && (
            <div
              style={{
                position: 'absolute',
                left: depth * indentWidth - 12,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: '#D3DAE6',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Горизонтальная линия */}
          {depth > 0 && (
            <div
              style={{
                position: 'absolute',
                left: depth * indentWidth - 12,
                top: 18,
                width: 12,
                height: 1,
                backgroundColor: '#D3DAE6',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Кнопка раскрытия */}
          <div
            style={{
              width: 20,
              height: 20,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              marginRight: 4,
              borderRadius: 3,
              backgroundColor: hasChildren ? '#F0F4FB' : 'transparent',
              border: hasChildren ? '1px solid #D3DAE6' : 'none',
              userSelect: 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) onToggle(nodeId);
            }}
          >
            {hasChildren && (
              <EuiIcon
                type={isExpanded ? 'arrowDown' : 'arrowRight'}
                size="s"
                color="subdued"
              />
            )}
          </div>

          {/* Иконка процесса */}
          <div style={{ marginRight: 6, flexShrink: 0 }}>
            <EuiIcon
              type={isRoot ? 'node' : 'gear'}
              size="s"
              color={isSystem ? 'danger' : isRoot ? 'warning' : 'subdued'}
            />
          </div>

          {/* Карточка процесса */}
          <div
            onClick={() => onProcessClick(node)}
            style={{
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
              border: isNew ? '2px solid #00BFB3' : '1px solid transparent',
              backgroundColor: isNew ? '#E6F9F5' : 'transparent',
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
              animation: isNew ? 'nodePulse 2s ease-in-out' : 'none',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!isNew) {
                e.currentTarget.style.backgroundColor = '#F5F7FA';
                e.currentTarget.style.borderColor = '#D3DAE6';
              }
            }}
            onMouseLeave={(e) => {
              if (!isNew) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {isNew && (
                <span style={{ flexShrink: 0 }}>
                  <EuiBadge color="success" iconType="bullseye">NEW</EuiBadge>
                </span>
              )}

              <span style={{ flexShrink: 0 }}>
                <EuiHealth color={isSystem ? 'danger' : isRoot ? 'warning' : 'success'} />
              </span>

              <EuiToolTip
                content={`${node.exe || node.name}${node.command ? '\n' + node.command : ''}`}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: isRoot ? 700 : 400,
                    color: isSystem ? '#BD271E' : '#1a1c21',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 60,
                    maxWidth: 300,
                    flexShrink: 1,
                    display: 'block',
                  }}
                >
                  {node.name}
                  {node.cwd && <span style={{ color: '#69707D' }}> — {node.cwd}</span>}
                  {node.command && <span style={{ color: '#69707D' }}> — {node.command}</span>}
                </span>
              </EuiToolTip>

              <span style={{ flexShrink: 0 }}>
                <EuiBadge color={isSystem ? 'danger' : 'hollow'}>PID: {node.pid}</EuiBadge>
              </span>
              <span style={{ flexShrink: 0 }}>
                <EuiBadge color={isRoot ? 'warning' : 'hollow'}>PPID: {node.ppid || 0}</EuiBadge>
              </span>
              {node.uid !== undefined && (
                <span style={{ flexShrink: 0 }}>
                  <EuiBadge color={node.uid === 0 ? 'danger' : 'default'}>
                    UID: {node.uid}
                  </EuiBadge>
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  color: '#69707D',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {new Date(node.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>

        {/* Дочерние узлы */}
        {hasChildren && isExpanded && (
          <div
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {node.children.map((child) => (
              <ProcessTreeNode
                key={`${child.pid}-${child._id}`}
                node={child}
                depth={depth + 1}
                expandedNodes={expandedNodes}
                onToggle={onToggle}
                onProcessClick={onProcessClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

ProcessTreeNode.displayName = 'ProcessTreeNode';

interface ProcessTreeProps {
  nodes: ProcessNode[];
  expandedNodes: Record<string, boolean>;
  onToggle: (id: string) => void;
  onProcessClick: (process: Process) => void;
}

export const ProcessTree: React.FC<ProcessTreeProps> = ({
  nodes,
  expandedNodes,
  onToggle,
  onProcessClick,
}) => {
  if (nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <EuiIcon type="eyeClosed" size="xl" color="subdued" />
        <EuiSpacer size="m" />
        <EuiText color="subdued">
          No processes found. Try changing the time range or filters.
        </EuiText>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {nodes.map((node) => (
        <ProcessTreeNode
          key={`${node.pid}-${node._id}`}
          node={node}
          depth={0}
          expandedNodes={expandedNodes}
          onToggle={onToggle}
          onProcessClick={onProcessClick}
        />
      ))}
    </div>
  );
};
