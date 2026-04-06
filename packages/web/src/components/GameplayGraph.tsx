import type { GameplayGraphEdgeView, GameplayGraphNodeView } from '../api/ApiClient';

interface GameplayGraphProps {
  nodes: GameplayGraphNodeView[];
  edges: GameplayGraphEdgeView[];
  currentNodeId: string;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 88;
const EDGE_OFFSET_X = NODE_WIDTH / 2;
const EDGE_OFFSET_Y = NODE_HEIGHT / 2;

export function GameplayGraph({
  nodes,
  edges,
  currentNodeId,
  selectedNodeId = null,
  onSelectNode,
}: GameplayGraphProps) {
  const orderedNodes = [...nodes].sort((left, right) => left.mobileOrder - right.mobileOrder);
  const width = Math.max(...nodes.map((node) => node.desktop.x)) + NODE_WIDTH + 48;
  const height = Math.max(...nodes.map((node) => node.desktop.y)) - Math.min(...nodes.map((node) => node.desktop.y)) + NODE_HEIGHT + 140;
  const topOffset = Math.abs(Math.min(...nodes.map((node) => node.desktop.y))) + 24;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="c-gameplay-graph">
      <div className="c-gameplay-graph__desktop" aria-label="Gameplay graph">
        <div className="c-gameplay-graph__surface" style={{ width: `${width}px`, height: `${height}px` }}>
          <svg className="c-gameplay-graph__svg" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            {edges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) {
                return null;
              }
              const x1 = from.desktop.x + EDGE_OFFSET_X + 24;
              const y1 = from.desktop.y + EDGE_OFFSET_Y + topOffset;
              const x2 = to.desktop.x + EDGE_OFFSET_X + 24;
              const y2 = to.desktop.y + EDGE_OFFSET_Y + topOffset;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={`${edge.from}:${edge.to}`}>
                  <line className="c-gameplay-graph__edge" x1={x1} y1={y1} x2={x2} y2={y2} />
                  {edge.label ? (
                    <text className="c-gameplay-graph__edge-label" x={midX} y={midY - 6}>
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const isCurrent = node.id === currentNodeId;
            const isSelected = selectedNodeId === node.id;
            const classes = [
              'c-gameplay-graph__node',
              isCurrent ? 'is-current' : '',
              isSelected ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const content = (
              <>
                <span className="c-gameplay-graph__node-kicker t-small">{node.shortLabel}</span>
                <span className="c-gameplay-graph__node-title">{node.label}</span>
                <span className="c-gameplay-graph__node-description t-small">{node.description}</span>
              </>
            );

            const style = {
              left: `${node.desktop.x + 24}px`,
              top: `${node.desktop.y + topOffset}px`,
              width: `${NODE_WIDTH}px`,
              minHeight: `${NODE_HEIGHT}px`,
            };

            if (onSelectNode) {
              return (
                <button
                  key={node.id}
                  type="button"
                  className={classes}
                  style={style}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-pressed={isSelected}
                  onClick={() => onSelectNode(node.id)}
                >
                  {content}
                </button>
              );
            }

            return (
              <div key={node.id} className={classes} style={style} aria-current={isCurrent ? 'step' : undefined}>
                {content}
              </div>
            );
          })}
        </div>
      </div>

      <ol className="c-gameplay-graph__mobile" aria-label="Gameplay stages">
        {orderedNodes.map((node) => {
          const isCurrent = node.id === currentNodeId;
          const isSelected = selectedNodeId === node.id;
          const classes = [
            'c-gameplay-graph__stage',
            isCurrent ? 'is-current' : '',
            isSelected ? 'is-selected' : '',
          ]
            .filter(Boolean)
            .join(' ');

          if (onSelectNode) {
            return (
              <li key={node.id}>
                <button
                  type="button"
                  className={classes}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-pressed={isSelected}
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className="c-gameplay-graph__stage-order t-small">{String(node.mobileOrder).padStart(2, '0')}</span>
                  <span className="c-gameplay-graph__stage-main">
                    <span className="c-gameplay-graph__stage-title">{node.label}</span>
                    <span className="c-gameplay-graph__stage-description t-small">{node.description}</span>
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li key={node.id}>
              <div className={classes} aria-current={isCurrent ? 'step' : undefined}>
                <span className="c-gameplay-graph__stage-order t-small">{String(node.mobileOrder).padStart(2, '0')}</span>
                <span className="c-gameplay-graph__stage-main">
                  <span className="c-gameplay-graph__stage-title">{node.label}</span>
                  <span className="c-gameplay-graph__stage-description t-small">{node.description}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
