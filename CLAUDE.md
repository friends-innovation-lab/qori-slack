# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Qori?

Qori is an AI-powered research operations platform for VA (Veterans Affairs) UX research teams. Users interact through Slack slash commands (e.g., `/qori-plan`, `/qori-analyze`) which open Block Kit modals, collect input, run chained LLM tasks defined in YAML configs, and store generated documents in GitHub repositories.

## Architecture

**Two-language stack, not yet fully integrated:**

- **Backend (Node.js):** `backend/` — Express + Slack Bolt app. Handles slash commands, modal submissions, LLM orchestration via LangChain, and GitHub document storage via Octokit. Uses Sequelize (PostgreSQL) + Redis/Bull for queuing.
- **Sam Agent (Python):** `sam/` — Support assistant using the Anthropic SDK directly. Has its own Slack handler (`SamSlackHandler`) but is **not finished or functional** — it was started as a help desk agent but never completed.

**Config-driven AI pipeline:** The intelligence layer lives in YAML files, not in application code. Each YAML defines input variables, chained `ai_generation_tasks` (sequential LLM calls), output templates (Handlebars-style `{{ai_generated.*}}`), and delivery options. **Important:** at runtime the backend fetches YAML templates from the GitHub repo (e.g., `beta-test/YAML Templates/`), not from the local `config/prompts/` directory. The local copies appear to be reference/development versions.

**Model resolution:** All `/qori-*` commands go through `backend/src/helpers/langchain.js:99-114`, which creates a `ChatAnthropic` instance. Model is `ANTHROPIC_MODEL_NAME` env var, falling back to `claude-sonnet-4-20250514`. The `llm_config` blocks in YAML prompt files (some say `gpt-4o`) are parsed but **never read** — dead config.

**RAG pipeline (currently disabled for alpha):** `backend/src/helpers/ragV2.js` contains a vector search Q&A pipeline using OpenAI (`gpt-4o-mini` + embeddings) and Supabase as the vector store. It is gated on env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`) — if any are missing, the server boots cleanly and RAG commands respond with a "not available yet" message. The RAG command handlers in `events.js` (`/civicmind ask-study`, `/civicmind create-template-study`, `/ask-study` modal, `/civicmind ask`) are disabled and return a user-friendly message. See "How to re-enable RAG" below.

**Note on `config/command-mapping.json`:** This file exists and maps slash commands to modal/prompt files, but the backend does not reference it at runtime. It may have been intended as a routing config but was never wired up. Treat it as documentation of intent, not live config.

## Build and Run Commands

All commands run from `backend/`:

```bash
cd backend
npm install
npm run dev          # Dev server with nodemon (port 3000)
npm run build        # Babel compile src/ → dist/
npm start            # Run compiled dist/bin/www.js
npm run lint         # ESLint (airbnb-base)
npm run lint:fix     # ESLint autofix
npm test             # Mocha + Chai tests
npm run db:migrate   # Sequelize migrations
```

**Docker (all services):**
```bash
cd backend
docker-compose up    # Starts app (3000), postgres (5432), redis (6379)
```

**Sam agent** — `sam/requirements.txt` was generated from imports (versions unpinned, need verification). Run directly: `python sam/sam-agent.py`

**Environment:** Copy `backend/.env.example` to `backend/.env`. Required variables: Slack tokens (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`), `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO`, `ANTHROPIC_API_KEY`, database credentials. See `.env.example` for the full list with descriptions.

## Key Directories

- `config/modals/` — Slack Block Kit modal JSON definitions, organized by command (plan/, analyze/, outreach/, etc.)
- `config/prompts/` — Local copies of YAML workflow configs (~25 files). Note: backend fetches these from GitHub at runtime, not locally
- `config/command-mapping.json` — Maps commands to modal/prompt files, but is **not used by the backend at runtime** (see Architecture section)
- `sam/` — Unfinished Python support agent with its own config, prompts, and escalation rules
- `study-template/` — Canonical folder structure copied into GitHub for each new study (00-brief through 07-implementation)
- `docs/learn/` — Static HTML/Tailwind GitHub Pages documentation site
- `beta-test/` — **Active test data. DO NOT modify without asking.**

## Important Conventions

- **Modals must be valid Slack Block Kit JSON.** Test against the Block Kit Builder spec.
- **YAML prompts are the primary place to edit AI behavior.** Each file defines `ai_generation_tasks` (chained prompts), `input_variables` (typed), and `output_template` (Markdown with Handlebars vars).
- **Claude-only at runtime (for now).** The main `/qori-*` pipeline uses Claude via `langchain.js`. RAG (which used OpenAI) is disabled for alpha. The `llm_config` blocks in YAML prompt files are dead config — never read.
- **Sam's allowed config paths** are restricted: only `config/prompts/*.yaml` and `config/modals/**/*.json`. Sam cannot modify `sam-config.yaml`.

## Key Principles

- Minimal UI — use Slack's native Block Kit components, not custom interfaces
- "Don't bloat" — only add features that solve real researcher problems
- Privacy first — PII redaction is built into workflows
- Match real VA researcher workflows, not idealized processes

## General Rule

When something is ambiguous, document the observation rather than the interpretation. "X and Y both exist, reason unclear" is more useful than a guess presented as fact.

Roadmap and planned work are tracked separately (TBD) — do not assume anything about future direction from this file.

## How to Re-enable RAG

The RAG pipeline is disabled for alpha. To bring it back:

1. **Provision Supabase:** Create a project at supabase.com. In the SQL editor, create a `documents` table with vector columns matching the schema expected by `@langchain/community/vectorstores/supabase` (pgvector extension required).
2. **Set env vars:** Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENAI_API_KEY` to your `.env`. The `ragV2.js` pipeline will initialize automatically when all three are present.
3. **Re-enable command handlers:** In `backend/src/helpers/slack/events.js`, restore the RAG call sites that were replaced with "not available yet" messages. The original code is preserved in git history (commit before the disable change).
4. **Index documents:** Use the `/civicmind sync` command to populate the Supabase vector store with study documents from GitHub.

## Open Questions

These are from a codebase audit. Tanzeel (original backend developer) is no longer on the project, so answers come from code investigation.

1. **RAG / Supabase (resolved for now):** RAG is disabled for alpha. `rag.js` is dead code (fully commented out). `ragV2.js` is preserved but gated on env vars. Hardcoded Supabase credentials were removed from source but remain in git history (repo is private; accepted risk).
2. **ChromaDB: dead dependency.** Listed in `package.json` but never imported in any source file. Safe to remove.
3. **Sam Python dependencies:** `sam/requirements.txt` was generated from imports in `sam-agent.py` (anthropic, slack_sdk, pyyaml). There may be missing transitive dependencies or version constraints that aren't captured.
4. **No CI/CD pipeline exists.** Deployment docs in `docs/internal/deployment.md` describe scripts and processes that don't appear to be implemented yet.
5. **YAML templates fetched from GitHub, not local `config/prompts/`.** The backend fetches prompt YAMLs from the GitHub repo at runtime (e.g., `beta-test/YAML Templates/research_plan.yaml`), not from the local `config/prompts/` directory. The original intent was for `config/prompts/` to be the source of truth for easy updates — this needs to be reconciled.
6. **`command-mapping.json` is not used at runtime.** The backend never loads this file. Slash command routing is handled directly in `events.js`.
