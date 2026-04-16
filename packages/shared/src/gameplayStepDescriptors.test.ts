import { describe, expect, it } from 'vitest';
import { GAMEPLAY_NODE_IDS } from './contracts/gameplay.js';
import { gameplayLoopGraphEdges } from './gameplayLoopGraph.js';
import { gameplayStepDescriptorByNodeId, gameplayStepDescriptors } from './gameplayStepDescriptors.js';

describe('gameplayStepDescriptors', () => {
  it('defines a descriptor for every gameplay node', () => {
    expect(gameplayStepDescriptors).toHaveLength(GAMEPLAY_NODE_IDS.length);
    for (const nodeId of GAMEPLAY_NODE_IDS) {
      expect(gameplayStepDescriptorByNodeId[nodeId].nodeId).toBe(nodeId);
    }
  });

  it('keeps next-node semantics aligned with the gameplay graph', () => {
    for (const nodeId of GAMEPLAY_NODE_IDS) {
      const descriptorNextNodeIds = [...gameplayStepDescriptorByNodeId[nodeId].nextNodeIds].sort();
      const graphNextNodeIds = gameplayLoopGraphEdges
        .filter((edge) => edge.from === nodeId)
        .map((edge) => edge.to)
        .sort();
      expect(descriptorNextNodeIds).toEqual(graphNextNodeIds);
    }
  });
});
