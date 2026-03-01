# File Flow AI - Refactor & Feature Spec

## Overview

Refactor and extend the existing File Flow AI system to fully implement the PRD requirements. The system organizes legal files and subfolders via an AI agent/chat interface, with full action history, metadata management, cost tracking, script export, and SQLite persistence.

---

## 1. SQLite Persistence Layer

### Requirements
- Replace in-memory session storage with SQLite database
- Persist full session state: chat messages, action history, file metadata, categories, folder state
- Build persistence layer now; session list/dashboard UI is a **future enhancement** (not in this scope)
- One active session at a time in the UI (DB stores historical sessions for later retrieval)

### Schema (core tables)
- **sessions**: id, created_at, working_directory, status
- **messages**: id, session_id, role, content, tokens_in, tokens_out, cost, duration_ms, created_at
- **actions**: id, session_id, action_type, source_path, dest_path, timestamp, reverted (boolean)
- **file_metadata**: id, session_id, file_path, metadata_json (dynamic user-defined fields), category, updated_at
- **categories**: id, name, keywords_json, created_at
- **metadata_fields**: id, session_id, field_name, field_type (for user-defined field definitions)

---

## 2. Action History & Revert

### Requirements
- Replace mock ChangesList with real action history from backend
- Actions persisted in SQLite via the `actions` table
- **View mode**: Grouped by file (primary view). Click a file to see its full operation history
- **Revert scope**: File operations only (move, copy, delete, rename). Metadata/category changes are NOT reverted
- **Revert edge cases**: Fail gracefully with an error message if original path no longer exists or file is gone
- No hidden backup/trash folder - simple revert of the file system operation

### Backend
- API endpoint: `GET /sessions/{id}/actions` - returns action history
- API endpoint: `POST /sessions/{id}/actions/{action_id}/revert` - reverts a specific action
- ActionInfo records already exist; extend to include `reverted` flag and `revertable` boolean

### Frontend
- ChangesList component: replace mock data with real API data
- Group actions by file path, expand/collapse per file
- Each action shows: type, timestamp, source → destination
- "Revert" button on each revertable action

---

## 3. Metadata System

### Requirements
- Replace mock MetadataEditor with real backend-synced metadata
- **User-defined fields**: Users can add/remove custom metadata field definitions per session (e.g., "Priority", "Case Number", "Parties")
- Core fields: category, date, plus any user-defined fields
- Metadata can be set via UI or through chat
- **Auto-save with undo**: Changes sent to backend immediately on edit, with a brief "Undo" toast notification

### Backend
- Store metadata per file in SQLite `file_metadata` table as dynamic JSON
- Store field definitions in `metadata_fields` table
- API endpoints:
  - `GET /sessions/{id}/metadata/{file_path}` - get file metadata
  - `PUT /sessions/{id}/metadata/{file_path}` - update file metadata (auto-save)
  - `GET /sessions/{id}/metadata-fields` - get defined fields for session
  - `POST /sessions/{id}/metadata-fields` - add a new metadata field definition
  - `DELETE /sessions/{id}/metadata-fields/{field_name}` - remove a field definition
- Agent tools for metadata: `set_metadata`, `get_metadata` (for chat-based metadata operations)

### Frontend
- MetadataEditor: shows metadata for selected file in bottom panel
- Field management UI: add/remove custom fields
- Auto-save on edit with undo toast (e.g., shadcn/ui toast, 5-second undo window)
- **Tooltip on hover**: Quick metadata preview when hovering files in file explorer

---

## 4. File Explorer Enhancements

### Requirements
- **Icons + colors** for change type indicators:
  - Green + add icon: newly created files
  - Red + delete icon: deleted files
  - Yellow/orange + move icon: moved files
  - Blue + edit icon: modified/renamed files
- Replace current asterisk-only indicators
- Hover tooltip showing file metadata preview (category, date, key fields)

---

## 5. Cost & Analytics

### Requirements
- **Inline per-message stats**: Show input tokens, output tokens, estimated USD cost, and wall-clock time on each chat message
- **Dedicated Analytics tab**: 4th tab in bottom panel ("Analytics") with:
  - Total tokens used (input/output breakdown)
  - Total estimated cost
  - Total time
  - Per-action breakdown table
  - Session-level aggregates

### Backend
- Already tracks `analysis_tokens` in state
- Extend to track: input_tokens, output_tokens, duration_ms per LLM call
- Add pricing config (configurable rates per model)
- API endpoint: `GET /sessions/{id}/stats` - returns aggregated stats
- Store per-message token/cost data in `messages` table

### Frontend
- Chat message component: add compact stats footer (tokens, cost, time)
- New Analytics tab component in bottom panel

---

## 6. Token Optimization

### Requirements
- **Sliding window pruning**: Keep last N messages plus system context in the LLM context window
- Drop older messages beyond the window
- Simple, predictable behavior - no smart selection or summarization
- Configure window size (e.g., last 20 messages)

### Backend
- Implement sliding window in message filtering before LLM calls
- Extend existing `message_utils.py` with window-based pruning
- Make window size configurable in `config.py`

---

## 7. Script Export

### Requirements
- Generate batch file (Windows) or PowerShell script containing all file operations performed
- User enters base folder path via text input dialog - script uses hardcoded paths
- Export includes:
  - Script file with move/copy/delete/rename commands
  - JSON manifest mapping files to categories and metadata
- ZIP download includes organized files + metadata manifest

### Backend
- API endpoint: `POST /sessions/{id}/export-script` with body `{ base_path: string, format: "batch" | "powershell" }`
- Returns generated script content
- API endpoint: `GET /sessions/{id}/manifest` - returns JSON manifest

### Frontend
- Export dialog: text input for base folder path, format selection (batch/PowerShell)
- Download button for script
- ZIP download includes files + manifest JSON in root

---

## 8. Download ZIP Enhancement

### Requirements
- ZIP includes organized folder structure + metadata manifest JSON in root
- Manifest contains: file paths, categories, metadata, action history summary

---

## 9. Cleanup

### Requirements
- Remove ALL mock data from frontend components:
  - `changes/data.ts` - mock change records
  - `metadata/data.ts` - mock metadata
  - Any other mock/placeholder data
- Components show only real data from backend
- No demo mode

---

## 10. Bulk Operations

### Requirements
- Agent executes bulk file operations immediately without confirmation dialogs
- Real-time progress feedback in chat as operations execute
- User can abort mid-operation (existing abort support)
- No threshold-based confirmation gates

---

## 11. Categories

### Requirements
- Categories already have full CRUD in backend and frontend
- Ensure categories are persisted in SQLite (migrate from JSON file)
- Categories queryable via chat (already supported by agent tools)
- Manual override in UI with auto-save + undo toast

---

## Implementation Priority Order

1. **SQLite Persistence Layer** - Foundation for everything else
2. **Action History & Revert** - Core feature, depends on persistence
3. **Metadata System** - User-defined fields, auto-save, tooltip
4. **Cost & Analytics** - Per-message stats, analytics tab
5. **File Explorer Enhancements** - Icons + colors, hover tooltips
6. **Token Optimization** - Sliding window pruning
7. **Script Export** - Batch/PS script generation + manifest
8. **Download ZIP Enhancement** - Include manifest in ZIP
9. **Cleanup** - Remove all mock data
10. **Bulk Operations** - Ensure agent handles bulk ops with progress

---

## Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence | SQLite | Lightweight, no external dependency |
| Revert scope | File ops only | Simpler, less error-prone |
| Revert failure | Fail gracefully | No hidden backup complexity |
| Metadata fields | User-defined, dynamic | Flexible for different use cases |
| Save behavior | Auto-save + undo toast | Fast workflow, safe with undo |
| History view | Grouped by file | Easier to track per-file changes |
| Cost display | Inline + Analytics tab | Quick glance + detailed analysis |
| Token optimization | Sliding window | Simple, predictable |
| Script path | Text input, hardcoded | Simple for end users |
| Manifest format | JSON | Structured, programmatic |
| Auto-categorize | User-triggered | User controls workflow |
| Change indicators | Icons + colors | Maximum visual clarity |
| Bottom panel | 4 tabs (+ Analytics) | Dedicated analytics space |
| Mock data | Remove all | Clean production code |
| Bulk operations | Execute immediately | No friction, abort available |
| Session management | Persist now, list UI later | Foundation first |
| Metadata access | Panel + hover tooltip | Quick preview + full edit |
| ZIP contents | Files + manifest | Complete export package |
| Chat persistence | Full session resume | Complete state restoration |
| Inline stats | Tokens + cost + time | Full transparency |
