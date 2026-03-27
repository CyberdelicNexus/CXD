// Comment system types for CXD Canvas
// Figma-style commenting with threads and resolution

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  position: { x: number; y: number };
  boardId: string | null;
  createdAt: number;
  parentId: string | null;
  resolvedAt: number | null;
  resolvedBy?: string;
  reactions?: Record<string, string[]>; // emoji -> array of authorIds who reacted
}

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}
