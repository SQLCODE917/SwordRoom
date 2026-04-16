import { readGameplayStepDescriptor, type GameplayNodeId } from '@starter/shared';
import type { GameplayView } from '../api/ApiClient';
import { readGmActionMeta } from '../data/gmControlModel';
import { GameplayGraph } from './GameplayGraph';
import { GameplayRulesInfo } from './GameplayRulesInfo';

interface GMGraphPanelProps {
  gameplay: GameplayView;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: GameplayNodeId) => void;
}

export function GMGraphPanel({ gameplay, selectedNodeId, onSelectNode }: GMGraphPanelProps) {
  const selectedId = (selectedNodeId as GameplayNodeId | null) ?? gameplay.session.currentNodeId;
  const selectedNode = gameplay.graph.nodes.find((node) => node.id === selectedId) ?? gameplay.graph.nodes[0] ?? null;

  if (!selectedNode) {
    return null;
  }

  const descriptor = readGameplayStepDescriptor(selectedNode.id as GameplayNodeId);
  const nextNodes = descriptor.nextNodeIds
    .map((nodeId) => gameplay.graph.nodes.find((node) => node.id === nodeId))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));

  return (
    <section className="c-gm-panel" aria-label="Whole gameplay graph">
      <div className="l-row">
        <h2 className="t-h4">Whole Graph</h2>
        <span className="t-small">Inspect any step without changing the live gameplay state.</span>
      </div>

      <GameplayGraph
        nodes={gameplay.graph.nodes}
        edges={gameplay.graph.edges}
        currentNodeId={gameplay.session.currentNodeId}
        selectedNodeId={selectedId}
        onSelectNode={(nodeId) => onSelectNode(nodeId as GameplayNodeId)}
      />

      <article className="c-gm-node-inspector">
        <div className="c-gameplay-card__eyebrow t-small">Selected Step</div>
        <h3 className="t-h4">{selectedNode.label}</h3>
        <p className="t-small">{selectedNode.description}</p>

        <div className="c-gm-node-inspector__group">
          <h4 className="t-h4">Possible Next Steps</h4>
          <ul className="c-gm-node-inspector__list">
            {nextNodes.map((node) => (
              <li key={node.id} className="t-small">
                <strong>{node.label}</strong>: {node.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="c-gm-node-inspector__group">
          <h4 className="t-h4">GM Actions</h4>
          <ul className="c-gm-node-inspector__list">
            {descriptor.gmActionIds.map((actionId) => {
              const meta = readGmActionMeta(actionId);
              return (
                <li key={actionId} className="t-small">
                  <strong>{meta.label}</strong>: {meta.description}
                </li>
              );
            })}
          </ul>
        </div>

        <GameplayRulesInfo topicId={descriptor.infoTopicId} />
      </article>
    </section>
  );
}
