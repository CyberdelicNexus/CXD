/**
 * Data migration utility to fix duplicate Experience Flow stage IDs
 * Run this once to clean up projects with duplicate stage IDs
 */

import { v4 as uuidv4 } from 'uuid';
import type { CXDProject } from '@/types/cxd-schema';

export function fixDuplicateStageIds(project: CXDProject): CXDProject {
  const stages = project.experienceFlowStages || [];
  const seenIds = new Set<string>();
  const fixedStages = stages.map((stage) => {
    if (seenIds.has(stage.id)) {
      // Duplicate ID found, generate a new one
      console.warn(`[fixDuplicateStageIds] Duplicate stage ID found: ${stage.id}, replacing with new UUID`);
      return { ...stage, id: uuidv4() };
    }
    seenIds.add(stage.id);
    return stage;
  });

  return {
    ...project,
    experienceFlowStages: fixedStages,
  };
}
