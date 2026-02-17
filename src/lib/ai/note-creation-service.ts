/**
 * AI Note Creation Service
 *
 * Creates notes from AI chat responses in the Canvas Inbox.
 */

import { v4 as uuidv4 } from 'uuid';
import { marked } from 'marked';
import type { CanvasElement, HypercubeFaceTag } from '@/types/canvas-elements';
import { FACE_DISPLAY_NAMES } from '@/lib/display-utils';

export interface NoteCreationOptions {
  chatMessageId: string;
  sourceInsightId?: string;
  sourceFaces: string[];
}

export interface NoteCreationResult {
  success: boolean;
  noteId?: string;
  error?: string;
}

/**
 * Create a note from AI-extracted content
 *
 * @param noteContent - The note content text
 * @param options - Creation options including provenance metadata
 * @param syncAddElement - Collaboration context function to add elements
 * @returns Result with success status and note ID
 */
export async function createNoteFromAI(
  noteContent: string,
  options: NoteCreationOptions,
  syncAddElement: (element: CanvasElement) => void
): Promise<NoteCreationResult> {
  try {
    // Validate note has content
    if (!noteContent || noteContent.trim().length === 0) {
      return {
        success: false,
        error: 'Note content is required',
      };
    }

    // Extract title from first line or first sentence
    // Remove markdown heading syntax (##, ###, etc.) from title
    const firstLine = noteContent.split('\n')[0];
    const cleanTitle = firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    const noteTitle = cleanTitle.length > 50
      ? cleanTitle.substring(0, 47) + '...'
      : cleanTitle;

    // Convert markdown to HTML for rich text display
    const noteBodyHtml = await marked.parse(noteContent, {
      async: true,
      breaks: false, // Use standard markdown (double line breaks for paragraphs)
      gfm: true, // GitHub Flavored Markdown
    });

    // Convert face keys to hypercube tags (map camelCase keys to display names)
    const hypercubeTags: HypercubeFaceTag[] = options.sourceFaces
      .filter(face =>
        ['realityPlanes', 'sensoryDomains', 'presence', 'stateMapping', 'traitMapping', 'contextAndMeaning', 'intentionCore'].includes(face)
      )
      .map(face => FACE_DISPLAY_NAMES[face] as HypercubeFaceTag)
      .filter(Boolean); // Remove any undefined values

    // Create freeform note element - identical structure to user-created notes
    // The 🤖 emoji indicates AI source; otherwise it's a standard editable note
    const noteElement: CanvasElement = {
      id: uuidv4(),
      type: 'freeform',
      cardType: 'note',
      noteTitle,
      noteBody: noteBodyHtml, // Store as HTML for rich text display
      content: '', // Empty for notes (noteBody is used instead)
      x: 0, // Position doesn't matter for inbox items
      y: 0,
      width: 300, // Match regular note width
      height: 300, // Match regular note height
      zIndex: Date.now() + Math.random(), // Unique z-index
      emoji: '🤖', // AI-generated indicator
      hypercubeTags,
      inInbox: true, // Mark as inbox item - not yet placed on canvas
      style: {
        bgColor: "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
        textColor: "#ffffff",
      },
    } as CanvasElement;

    // Add to canvas via collaboration sync
    console.log('[NoteCreationService] Creating AI note:', {
      id: noteElement.id,
      title: noteTitle,
      cardType: noteElement.cardType,
      inInbox: noteElement.inInbox,
      hypercubeTags: noteElement.hypercubeTags,
    });

    syncAddElement(noteElement);

    return {
      success: true,
      noteId: noteElement.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
