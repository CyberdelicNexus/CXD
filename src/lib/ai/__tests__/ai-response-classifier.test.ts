/**
 * AI Response Classifier Tests
 *
 * Tests the heuristic-based classification of AI chat responses
 * into actionable tasks and notes.
 */

import { describe, it, expect } from '@jest/globals';
import { classifyResponse } from '../ai-response-classifier';

describe('AI Response Classifier', () => {
  describe('Task Detection', () => {
    it('should extract tasks from numbered lists with action verbs', () => {
      const response = `Here are the next steps:

1. Add a VR headset specification to the Reality Planes section
2. Create a sensory palette document for the experience
3. Update the State Mapping to include flow state transitions`;

      const result = classifyResponse(response);

      expect(result.type).toBe('tasks');
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].title).toContain('Add a VR headset');
      expect(result.tasks[1].title).toContain('Create a sensory palette');
      expect(result.tasks[2].title).toContain('Update the State Mapping');
    });

    it('should extract tasks from bullet lists with action verbs', () => {
      const response = `Next Steps:
- Define the target audience demographics
- Build a prototype of the AR interface
- Test the haptic feedback system with users`;

      const result = classifyResponse(response);

      expect(result.type).toBe('tasks');
      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].title).toContain('Define the target audience');
      expect(result.tasks[1].title).toContain('Build a prototype');
    });

    it('should extract tasks from markdown checkboxes', () => {
      const response = `Action Items:
- [ ] Configure the spatial audio system
- [ ] Map the state transitions in the experience flow
- [ ] Review accessibility guidelines for VR experiences`;

      const result = classifyResponse(response);

      expect(result.type).toBe('tasks');
      expect(result.tasks).toHaveLength(3);
    });

    it('should not extract tasks from lists without action verbs', () => {
      const response = `Here are some observations:
1. The experience feels immersive
2. Users reported feeling present
3. The sensory design is coherent`;

      const result = classifyResponse(response);

      expect(result.tasks).toHaveLength(0);
    });

    it('should detect tasks under common task headings', () => {
      const response = `## Recommendations
1. Add biometric tracking to monitor emotional state
2. Create a post-experience integration ritual
3. Define the desired trait outcomes`;

      const result = classifyResponse(response);

      expect(result.tasks).toHaveLength(3);
    });

    it('should handle mixed content with tasks and explanatory text', () => {
      const response = `Your Reality Planes setup looks good, but there are a few gaps.

The AR components need more definition.

## Next Steps
1. Specify which AR framework you'll use
2. Document the hand tracking requirements

Let me know if you need help with any of these.`;

      const result = classifyResponse(response);

      expect(result.type).toBe('tasks_and_note');
      expect(result.tasks).toHaveLength(2);
      expect(result.noteContent.length).toBeGreaterThan(0);
    });
  });

  describe('Effort Estimation', () => {
    it('should estimate small effort for simple actions', () => {
      const response = `1. Add haptic feedback
2. Toggle VR mode
3. Enable biofeedback`;

      const result = classifyResponse(response);

      expect(result.tasks[0].estimatedEffort).toBe('small');
    });

    it('should estimate large effort for research tasks', () => {
      const response = `1. Research multiple VR frameworks across platforms
2. Coordinate with several stakeholders on the design`;

      const result = classifyResponse(response);

      expect(result.tasks[0].estimatedEffort).toBe('large');
      expect(result.tasks[1].estimatedEffort).toBe('large');
    });

    it('should estimate medium effort for content creation', () => {
      const response = `1. Create a detailed sensory palette document
2. Write the narrative structure for the experience
3. Develop the state transition map`;

      const result = classifyResponse(response);

      expect(result.tasks[0].estimatedEffort).toBe('medium');
      expect(result.tasks[1].estimatedEffort).toBe('medium');
    });
  });

  describe('Face Detection', () => {
    it('should detect Reality Planes keywords', () => {
      const response = `Next Steps:
1. Add VR and AR components to support mixed reality
2. Define the physical space requirements`;

      const result = classifyResponse(response);

      expect(result.sourceFaces).toContain('realityPlanes');
    });

    it('should detect Sensory Domains keywords', () => {
      const response = `Recommendations:
1. Design the visual and auditory palette
2. Add haptic feedback at key moments
3. Consider olfactory cues for state transitions`;

      const result = classifyResponse(response);

      expect(result.sourceFaces).toContain('sensoryDomains');
    });

    it('should detect Presence keywords', () => {
      const response = `1. Enhance embodiment through proprioceptive feedback
2. Increase social presence with shared spaces
3. Improve environmental presence through spatial audio`;

      const result = classifyResponse(response);

      expect(result.sourceFaces).toContain('presence');
    });

    it('should detect State Mapping keywords', () => {
      const response = `1. Map the emotional states in the journey
2. Define state transitions using breathwork
3. Add altered state induction techniques`;

      const result = classifyResponse(response);

      expect(result.sourceFaces).toContain('stateMapping');
    });

    it('should detect Trait Mapping keywords', () => {
      const response = `1. Define the lasting behavioral changes
2. Create integration practices for trait development
3. Map how temporary states become lasting traits`;

      const result = classifyResponse(response);

      expect(result.sourceFaces).toContain('traitMapping');
    });

    it('should detect Context & Meaning keywords', () => {
      const response = `1. Develop the narrative world and story arc
2. Design the magic moment of transcendence
3. Create symbolic meaning architecture`;

      const result = classifyResponse(response);

      expect(result.sourceFaces).toContain('contextAndMeaning');
    });

    it('should inherit source faces from options', () => {
      const response = `1. Create a prototype`;

      const result = classifyResponse(response, {
        sourceFaces: ['realityPlanes', 'sensoryDomains'],
      });

      expect(result.sourceFaces).toContain('realityPlanes');
      expect(result.sourceFaces).toContain('sensoryDomains');
    });

    it('should detect faces in task content and merge with source faces', () => {
      const response = `1. Add VR headset support and haptic feedback`;

      const result = classifyResponse(response, {
        sourceFaces: ['presence'],
      });

      // Should have source face + detected faces
      expect(result.sourceFaces).toContain('presence');
      expect(result.sourceFaces).toContain('realityPlanes'); // VR keyword
      expect(result.sourceFaces).toContain('sensoryDomains'); // haptic keyword
    });
  });

  describe('Note Extraction', () => {
    it('should extract note content from explanatory paragraphs', () => {
      const response = `Your Reality Planes configuration shows a strong foundation in AR/VR integration. The mixed reality approach will allow for seamless transitions between physical and digital spaces.

However, I notice that the haptic feedback layer is underdeveloped. This could limit the embodied presence in the VR portions of the experience.

Consider how the sensory design needs to adapt based on which reality plane is active at each moment.`;

      const result = classifyResponse(response);

      expect(result.noteContent.length).toBeGreaterThan(100);
      expect(result.noteContent).toContain('Reality Planes');
      expect(result.noteContent).toContain('haptic feedback');
    });

    it('should not extract very short responses as notes', () => {
      const response = `Looks good!`;

      const result = classifyResponse(response);

      expect(result.noteContent).toBe('');
    });

    it('should exclude task sections from note content', () => {
      const response = `Your sensory design is coherent and well-balanced.

## Next Steps
1. Add olfactory cues
2. Test haptic timing

The visual-auditory pairing shows good cross-modal correspondence.`;

      const result = classifyResponse(response);

      expect(result.noteContent).not.toContain('Next Steps');
      expect(result.noteContent).not.toContain('Add olfactory');
      expect(result.noteContent).toContain('sensory design');
      expect(result.noteContent).toContain('cross-modal');
    });

    it('should cap note content at 2000 characters', () => {
      const longResponse = `Here is a very long explanation. `.repeat(200);

      const result = classifyResponse(longResponse);

      expect(result.noteContent.length).toBeLessThanOrEqual(2003); // 2000 + '...'
    });
  });

  describe('Content Classification', () => {
    it('should classify as "tasks" when only tasks present', () => {
      const response = `1. Add VR support
2. Create sensory palette`;

      const result = classifyResponse(response);

      expect(result.type).toBe('tasks');
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.noteContent).toBe('');
    });

    it('should classify as "note" when only note content present', () => {
      const response = `Your Reality Planes configuration is well thought out. The mix of VR and AR will create interesting transition opportunities. The spatial audio design complements the visual elements nicely.`;

      const result = classifyResponse(response);

      expect(result.type).toBe('note');
      expect(result.tasks).toHaveLength(0);
      expect(result.noteContent.length).toBeGreaterThan(0);
    });

    it('should classify as "tasks_and_note" when both present', () => {
      const response = `Your current State Mapping shows a good arc from exploration to integration.

However, the transition mechanics between states need more definition.

## Recommendations
1. Define specific breathwork patterns for each state transition
2. Add somatic anchoring techniques
3. Create a state measurement protocol

These additions will make the state induction more reliable and reproducible.`;

      const result = classifyResponse(response);

      expect(result.type).toBe('tasks_and_note');
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.noteContent.length).toBeGreaterThan(0);
    });
  });

  describe('Task Description Extraction', () => {
    it('should include elaboration text in task description', () => {
      const response = `1. Create a sensory palette document
   This should map visual, auditory, and haptic intensities across each experience stage`;

      const result = classifyResponse(response);

      expect(result.tasks[0].description).toContain('sensory palette');
      expect(result.tasks[0].description).toContain('intensities');
    });

    it('should truncate very long task titles', () => {
      const veryLongTitle = `1. ${'Create a comprehensive and detailed '.repeat(10)}document`;

      const result = classifyResponse(veryLongTitle);

      expect(result.tasks[0].title.length).toBeLessThanOrEqual(103); // 100 + '...'
    });

    it('should truncate very long task descriptions', () => {
      const taskWithLongDesc = `1. Create document\n${'With many details. '.repeat(100)}`;

      const result = classifyResponse(taskWithLongDesc);

      expect(result.tasks[0].description.length).toBeLessThanOrEqual(503); // 500 + '...'
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty responses', () => {
      const result = classifyResponse('');

      expect(result.tasks).toHaveLength(0);
      expect(result.noteContent).toBe('');
    });

    it('should handle responses with only whitespace', () => {
      const result = classifyResponse('   \n\n   ');

      expect(result.tasks).toHaveLength(0);
      expect(result.noteContent).toBe('');
    });

    it('should handle responses with only headings', () => {
      const response = `## Next Steps\n\n## Recommendations`;

      const result = classifyResponse(response);

      expect(result.tasks).toHaveLength(0);
    });

    it('should handle malformed markdown lists', () => {
      const response = `1.Missing space after period
2. Properly formatted task`;

      const result = classifyResponse(response);

      // Only the properly formatted task should be detected
      expect(result.tasks.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Subtask Detection', () => {
    it('should detect indented subtasks', () => {
      const response = `1. Create VR prototype
   - Add hand tracking
   - Configure spatial audio
2. Test with users`;

      const result = classifyResponse(response);

      // Should have parent tasks and subtasks
      const subtasks = result.tasks.filter(t => t.isSubtask);
      expect(subtasks.length).toBeGreaterThan(0);
    });

    it('should link subtasks to parent via parentIndex', () => {
      const response = `1. Main task one
   - Subtask A
   - Subtask B
2. Main task two`;

      const result = classifyResponse(response);

      const subtaskA = result.tasks.find(t => t.title.includes('Subtask A'));
      expect(subtaskA?.isSubtask).toBe(true);
      expect(subtaskA?.parentIndex).toBeDefined();
    });
  });
});
