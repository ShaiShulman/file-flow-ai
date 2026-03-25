# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

File Flow AI is a full-stack application for automatically organizing files and subfolders, focused on legal documents. It uses an AI agent (LangGraph + AWS Bedrock Claude models) to categorize, move, and manage files through a chat interface.

## Development Commands

### Frontend (Next.js + React 19 + TypeScript)
```bash
cd frontend
pnpm install          # install dependencies (uses pnpm)
pnpm dev              # start dev server (Next.js 15)
pnpm build            # production build
pnpm lint             # ESLint via next lint
```

### Backend (Python + FastAPI)
```bash
cd backend
pip install -r requirements.txt     # install dependencies
python server.py                    # start FastAPI server on 0.0.0.0:8000
python server.py --reload           # dev mode with auto-reload
python server.py --port 9000        # custom port
```

### Backend Tests (pytest)
```bash
cd backend
pytest                              # run all tests
pytest tests/test_api.py            # run single test file
pytest tests/test_api.py::test_name # run single test
```

## Architecture

### Backend: LangGraph Agent System

The core is a **stateful LangGraph state machine** in [graph.py](backend/graph.py) with this flow:

```
START → assistant → route_tools → safe_tools/sensitive_tools → process_output → assistant → ... → END
```

- **Assistant node** — LLM reasoning step (Bedrock Claude 3.5 Sonnet), bound with all tools
- **route_tools** — Conditional router that checks if tool calls are safe or sensitive
- **safe_tools** — Read-only operations: `list_items`, `change_directory`, `analyze_document`, category CRUD
- **sensitive_tools** — Mutations: `delete_item`, `move_item`, `copy_item`, `create_item`
- **process_output** — Post-processes tool results (extracts affected files, actions, metadata)
- **MemorySaver** — In-memory checkpointing for session persistence

Key state fields ([state.py](backend/state.py)): `messages`, `working_directory`, `affected_files`, `file_metadata`, `actions`, `analysis_tokens`

### Backend: API Layer

[api.py](backend/api.py) — FastAPI app with session-based agent management:
- `POST /sessions` / `POST /sessions/{id}` — Create session (each gets isolated agent instance)
- `POST /sessions/{id}/run` — Send message to agent, returns response + affected files + folder structure
- `GET /categories`, `POST /categories/{name}`, `DELETE /categories/{name}` — Category CRUD
- Sessions are stored in-memory (no database)

[agent_runner.py](backend/agent_runner.py) — Wraps graph execution, manages per-session state and working directories.

### Frontend: Feature-Based Organization

[app/page.tsx](frontend/app/page.tsx) — Main page composing all features within a `SessionProvider`.

Feature modules in [features/](frontend/features/):
- **session/** — React Context (`context.tsx`) + hooks for global session state (session ID, working directory, affected files). All backend sync goes through here.
- **chat/** — Chat interface component that sends messages to the agent via API client and displays responses
- **file-explorer/** — Tree-based folder/file browser with change indicators
- **categories/** — Category management synced with backend
- **api/client.ts** — Singleton API client class for all backend communication. Base URL from `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:8000`)

UI built with **shadcn/ui** (Radix primitives + Tailwind CSS). Components in [components/ui/](frontend/components/ui/). Config in [components.json](frontend/components.json).

### Data Flow

1. User uploads files → extracted to `uploads/` directory with UUID-based folders
2. Frontend creates a session via API → backend creates agent instance with working directory set to upload folder
3. User chats → messages sent to `/sessions/{id}/run` → agent processes via LangGraph → returns response, affected files, folder structure
4. Frontend updates file explorer tree and change indicators from agent response
5. User can download organized files as ZIP

## Configuration

### Backend ([config.py](backend/config.py))
- `BEDROCK_INSTRUCTIONS_MODEL_ID` — Main LLM (Claude 3.5 Sonnet)
- `BEDROCK_TEXT_MODEL_ID` — Fast operations LLM (Claude 3.5 Haiku)
- `WORKING_DIRECTORY` — Default workspace at `~/folder_bot_workspace`
- `RECURSION_LIMIT = 500` — Max graph steps
- `DEBUG_LLM` / `DEBUG_GRAPH` — Debug flags
- Requires AWS credentials configured for Bedrock access (us-east-1)

### Frontend ([frontend/.env](frontend/.env))
- `NEXT_PUBLIC_API_URL` — Backend API URL
- `UPLOADS_FOLDER` — Path to uploads directory

## Key Patterns

- **Tool stratification**: Safe (read-only) vs sensitive (mutations) tools are routed separately in the graph. This separation is architectural, not just organizational.
- **Session isolation**: Each session gets its own agent instance, working directory, and LangGraph thread. Sessions are in-memory only.
- **Message filtering**: [message_utils.py](backend/message_utils.py) filters `affected_files` and `actions` from prompt messages before sending to LLM to save tokens.
- **Action tracking**: All file operations produce `ActionInfo` records ([action_types.py](backend/action_types.py)) accumulated in state via custom reducers.
- **Categories**: Stored in [categories.json](backend/categories.json), managed via `CategoriesManager`. Legal document categories with keyword phrases for matching.
- **Path aliases**: Frontend uses `@/*` mapping to project root in tsconfig.

# Development Process

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Testing Requirements

Every feature or non-trivial change **must** include tests. This is not optional.

### What to write

1. **Unit tests** — Test the new code in isolation using temp databases and temp filesystems. Place in `backend/tests/test_<feature>.py`. Follow the existing pattern: `@pytest.fixture` for temp DB, class-based test grouping, descriptive test names.

2. **Live server integration tests** — Test the feature end-to-end against the running backend over HTTP. Place in `backend/tests/test_<feature>_live.py`. These should:
   - Use `requests` to call actual API endpoints
   - Auto-detect the server URL from `SERVER_URL` env var (default `http://localhost:8000`)
   - Skip gracefully if the server is unreachable
   - Auto-discover a valid session from the database (don't hardcode session IDs)
   - Clean up any test artifacts (temp files, test data) via fixtures
   - Include a smoke test group verifying existing endpoints still work

3. **Frontend build verification** — Run `pnpm build` after frontend changes to catch type errors and broken imports.

### Test structure to follow

- **Group tests by concern** using classes: `TestFeatureX`, `TestEdgeCases`, `TestExistingFeaturesNotBroken`
- **Cover the happy path, error handling, edge cases, and backwards compatibility**
- **Test stability/idempotency** — call the same endpoint twice and assert consistent results where applicable
- **Test isolation** — verify data from one session/context doesn't leak into another

### Running tests

```bash
cd backend
py -3 tests/run_all_tests.py              # all unit + live server tests
py -3 tests/run_all_tests.py --skip-live   # unit tests only
py -3 -m pytest tests/test_<file>.py -v    # single test file
```

When adding a new test file, also add it to `tests/run_all_tests.py` so it runs in the full suite.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
