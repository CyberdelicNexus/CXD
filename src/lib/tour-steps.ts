export interface TourStep {
  targetId: string; // matches data-tour-id attribute
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  preAction?: string; // Action to perform before showing this step
}

export const TOUR_STEPS: Record<'canvas' | 'map' | 'plan', TourStep[]> = {
  canvas: [
    { targetId: 'canvas-toolkit', title: 'Your Toolkit', content: 'This is your toolkit. Click any tool to add elements to your canvas — cards, text, images, shapes, containers, and more.', position: 'right' },
    { targetId: 'canvas-element-sample', title: 'Canvas Elements', content: 'Drag to move, grab corners to resize, right-click for more options. Double-click cards to edit their content.', position: 'top' },
    { targetId: 'canvas-inbox', title: 'Inbox', content: 'Your inbox holds elements waiting to be placed. Drag them onto the canvas when you\'re ready to use them.', position: 'left' },
    { targetId: 'canvas-board-tool', title: 'Nested Boards', content: 'Create nested boards to organize complex projects. Double-click a board to dive inside it.', position: 'top' },
    { targetId: 'canvas-experience-sidebar', title: 'Experience Elements', content: 'Drag experience elements from here onto the canvas, or click them to view details about each experience stage.', position: 'left' },
    { targetId: 'canvas-experience-flow', title: 'Experience Flow', content: 'Map the stages of your experience here. This timeline shows how your experience flows from start to finish.', position: 'top' },
    { targetId: 'canvas-collaborate-btn', title: 'Collaborate', content: 'Invite teammates to work on this canvas together in real-time.', position: 'bottom', preAction: 'expandNavbar' },
    { targetId: 'canvas-shortcuts-btn', title: 'Keyboard Shortcuts', content: 'View all keyboard shortcuts and navigation controls here.', position: 'bottom', preAction: 'expandNavbar' },
  ],
  map: [
    { targetId: 'map-face-selector', title: 'Face Selector', content: 'Select a face of the Hypercube to explore. Each face represents a different dimension of your experience.', position: 'bottom' },
    { targetId: 'map-insights-panel', title: 'System Insights', content: 'This panel shows AI-generated insights about the current face based on the elements you\'ve tagged on your canvas.', position: 'left' },
    { targetId: 'map-chat-panel', title: 'AI Chat', content: 'Ask the AI questions about your experience design. The more elements you tag on the canvas, the richer context the AI has to work with.', position: 'left' },
    { targetId: 'map-cyberdelic-tab', title: 'Cyberdelic Wizard', content: 'The Cyberdelic wizard guides you through deeper experience design patterns and frameworks.', position: 'top' },
    { targetId: 'map-erd-button', title: 'Experience Requirements Document', content: 'When you\'re ready, generate an Experience Requirements Document — a complete presentation of your canvas work to share with stakeholders.', position: 'bottom' },
  ],
  plan: [
    { targetId: 'plan-roadmap-tab', title: 'Roadmap', content: 'Start here. Create a version roadmap to organize your project into milestones and releases.', position: 'bottom' },
    { targetId: 'plan-kanban-add-task', title: 'Add Tasks', content: 'Add tasks to track your work. Drag cards between columns to update their status.', position: 'bottom' },
    { targetId: 'plan-task-detail', title: 'Task Details', content: 'Click any task to see its full details — assign people, set dates, add descriptions, and manage subtasks.', position: 'left' },
    { targetId: 'plan-table-tab', title: 'Table View', content: 'View all your tasks in a structured table format for quick scanning and bulk editing.', position: 'bottom' },
    { targetId: 'plan-timeline-tab', title: 'Timeline', content: 'Place tasks on a timeline, drag to adjust duration, and connect dependencies between tasks.', position: 'bottom' },
    { targetId: 'plan-calendar-tab', title: 'Calendar', content: 'View tasks in month, week, or day views. In week view, drag tasks to time-block your schedule.', position: 'bottom' },
    { targetId: 'plan-archive-tab', title: 'Archive', content: 'Completed tasks can be archived here. Review past work or restore tasks when needed.', position: 'bottom' },
  ],
};
