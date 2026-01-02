# Kanori

Kanori is a productivity web application designed to help users bring order to their daily lives by integrating kanban task management, time blocking, focused work sessions, and note-taking into a single, cohesive system. Inspired by the need for a mindful, all-in-one productivity tool, Kanori aims to turn chaos into flow, making it easier for users to manage tasks, track progress, and reflect on their achievements.

## Video Demo

[https://www.youtube.com/watch?v=lY0hmQH6Bxs](https://www.youtube.com/watch?v=lY0hmQH6Bxs)

## Live 

https://kanori.vercel.app

## Project Overview

Kanori is structured around pages, each dedicated to a core productivity function. The main pages are:

- **Dashboard**: Features a kanban board for task management, allowing users to organize tasks into columns such as “To Do,” “Doing,” “Today,” and “Done.” This visual approach helps users track progress and prioritize work.
- **Time**: Implements time blocking and daily planning, letting users allocate specific periods for tasks and visualize their day as a timeline.
- **Notes**: Provides a simple, fast note-taking interface, supporting the creation, editing, and organization of notes. Notes can be color-coded for better categorization.
- **Focus Log**: Tracks focused work sessions, visualizes focus history, and helps users reflect on their productivity patterns.

Each page is designed to feel like a native mobile app, with smooth navigation and a responsive layout. The app uses Vue 3, Pinia for state management, and Element Plus for UI components, ensuring a modern and maintainable codebase. This app has PWA so it can be installed on mobile phones and works like a native mobile app.

## File Structure and Key Files

- **src/App.vue**: The root component, responsible for the main layout, navigation, and authentication state. It manages the app shell, header, and routing between pages.
- **src/main.ts**: The entry point of the application. It sets up the Vue app, installs Pinia and Element Plus, configures the router, and mounts the app to the DOM.
- **src/router/index.ts**: Defines the routes for each main page (Dashboard, Time, Notes, Focus Log, Login, Register) and handles authentication guards to protect private routes.
- **src/types.ts**: Contains TypeScript interfaces and types for core entities such as `Task`, `FocusSession`, `Block`, `Note`, and paginated responses. This ensures type safety and consistency across the app.

### Views

- **src/views/Dashboard.vue**: Hosts the kanban board, displaying tasks in columns by status. It fetches tasks on mount and delegates rendering to the `TaskBoard` component.
- **src/views/Time.vue**: Displays the daily timeline using the `Timeline` component, allowing users to visualize and plan their day.
- **src/views/Notes.vue**: Manages the notes page, handling note fetching, creation, editing, and error states. It uses `NotesGrid`, `NoteCreateModal`, and `NoteEditModal` for UI.
- **src/views/FocusLog.vue**: Shows a summary of focus sessions, using `FocusMap` for visualizing focus data and `FocusLogList` for listing sessions.

### Components

- **TaskBoard.vue**: Renders the kanban board, organizing tasks into columns and supporting drag-and-drop, editing, and removal.
- **TaskColumn.vue**: Represents a single column in the kanban board, filtering tasks by status.
- **TaskCard.vue**: Individual task card UI  shows task title, progress, estimated minutes, and item-level actions.
- **Timeline.vue**: Implements the time blocking visualization, showing tasks and blocks on a timeline, and supporting editing and navigation.
- **NotesGrid.vue**: Displays notes in a draggable grid, supporting reordering and selection.
- **NoteCard.vue**: Single note display  renders note title, content preview, background color, and emits select events.
- **NoteCreateModal.vue**: Note creation modal  UI and form handling for creating a new note, emits created note on success.
- **NoteEditModal.vue**: Note editing modal  UI and form handling for editing an existing note, emits updates back to the parent.
- **Focus.vue**: Higher-level focus UI  composes focus controls and displays.
- **FocusNow.vue**: Live focus session control  start/pause/resume timers, mark success, collect notes for the session, and interact with the focus store.
- **FocusMap.vue**: Focus-history visualization  charting component that shows focus activity by day/week/month.
- **FocusLogList.vue**: Focus sessions list  displays recent sessions, durations, success flags and allows selecting sessions for details.
- **DaySummary.vue**: Displays a day's summary  total focused minutes and summary text; used in timeline and day lists.

### Stores

- **src/stores/auth.ts**: Authentication store (Pinia) manages user object, access/refresh tokens, login/logout flows, token persistence and hydration, and clears user-scoped state on logout.
- **src/stores/tasks.ts**: Tasks store  holds task list, loading/error state, provides `byStatus` computed filtering, and implements fetch/create/update/remove operations against API.
- **src/stores/blocks.ts**: Blocks store  manages time-block objects for the timeline, provides fetch/create/update/delete and sorting routines.
- **src/stores/dayBounds.ts**: Day bounds store  stores user day start/end boundaries and exposes helpers to interpret day ranges for the timeline.
- **src/stores/daySummaries.ts**: Day summary store  fetches and holds daily summary entries (e.g., summary text and total focused minutes).
- **src/stores/focusSessions.ts**: Focus sessions store  manages focus session list, active session bookkeeping, pause/resume logic, and interactions with the API.
- **src/stores/columns.ts**: Column meta store  stores column color settings and other column-related metadata used on the kanban board.

### API

- **src/api/client.ts**: HTTP wrapper and API endpoint definitions  centralizes request logic, base URL, and helper methods used by other API modules.
- **src/api/auth.ts**: Authentication API calls  login, register, user info endpoints and any auth-related request wrappers.
- **src/api/tokens.ts**: Token storage helpers  read/write access and refresh tokens (local storage), and small helpers used by auth and client logic.
- **src/api/notes.ts**: Notes API client  functions to fetch, create, update, delete notes from the backend.
- **src/api/setting.ts**: Settings API client  fetch/update app settings (e.g., column colors, day bounds).

## Design Decisions

Several design choices were debated during development:

- **Page-based Navigation**: The app is organized by focused pages so each major area (tasks, time, notes, focus) feels like a distinct workspace, reducing cognitive load for users.
- **Pinia for State Management**: Pinia was chosen for its simplicity, modularity, and TypeScript ergonomics.
- **Element Plus**: Element Plus provides a consistent component set that speeds up UI development while allowing custom styling where needed.
- **TypeScript**: Strong typing across the codebase reduces runtime surprises and improves maintainability.
- **Authentication Guards**: Router guards ensure private pages are only accessible when authenticated, improving security and UX.

## Conclusion

Kanori is a thoughtfully designed productivity app that brings together multiple productivity paradigms into a single, seamless experience. Its modular architecture, clear separation of concerns, and modern tech stack make it both powerful and maintainable. This README documents the app structure and responsibilities so contributors can quickly locate and understand each piece.

## Project Setup

```sh
bun install

bun dev
