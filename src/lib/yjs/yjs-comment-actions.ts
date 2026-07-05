/**
 * Yjs Comment Actions
 *
 * CRDT operations for canvas comments. Comments live in a Y.Map keyed by
 * comment id so concurrent adds/removes from collaborators merge cleanly.
 * Fields are plain scalars (content is write-once, position/reactions are
 * last-writer-wins per field), so no Y.Text is needed.
 */

import * as Y from 'yjs';
import type { Comment } from '@/types/comment-types';

// ─── Serializers ─────────────────────────────────────────────────────────────

export function commentToYMap(comment: Comment): Y.Map<unknown> {
  const yComment = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(comment)) {
    if (value !== undefined) {
      yComment.set(key, value);
    }
  }
  return yComment;
}

export function yMapToComment(yComment: Y.Map<unknown>): Comment {
  const obj: Record<string, unknown> = {};
  yComment.forEach((value, key) => {
    obj[key] = value;
  });
  return obj as unknown as Comment;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/** Add or fully replace a comment. */
export function yjsSetComment(doc: Y.Doc, comment: Comment): void {
  doc.transact(() => {
    const yComments = doc.getMap('comments');
    yComments.set(comment.id, commentToYMap(comment));
  }, 'local');
}

/** Partially update a single comment. */
export function yjsUpdateComment(doc: Y.Doc, commentId: string, updates: Partial<Comment>): void {
  yjsUpdateComments(doc, [{ id: commentId, updates }]);
}

/** Partially update multiple comments in one transaction (e.g., resolve a thread). */
export function yjsUpdateComments(
  doc: Y.Doc,
  changes: Array<{ id: string; updates: Partial<Comment> }>
): void {
  doc.transact(() => {
    const yComments = doc.getMap('comments');
    for (const { id, updates } of changes) {
      const yComment = yComments.get(id);
      if (yComment instanceof Y.Map) {
        for (const [key, value] of Object.entries(updates)) {
          if (key === 'id') continue;
          if (value === undefined) {
            yComment.delete(key);
          } else {
            yComment.set(key, value);
          }
        }
      }
    }
  }, 'local');
}

/** Delete a root comment and all of its replies. */
export function yjsDeleteCommentThread(doc: Y.Doc, rootId: string): void {
  doc.transact(() => {
    const yComments = doc.getMap('comments');
    const toDelete: string[] = [];
    yComments.forEach((yComment, id) => {
      if (!(yComment instanceof Y.Map)) return;
      if (id === rootId || yComment.get('parentId') === rootId) {
        toDelete.push(id);
      }
    });
    for (const id of toDelete) {
      yComments.delete(id);
    }
  }, 'local');
}
