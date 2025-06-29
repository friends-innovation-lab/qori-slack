# SPEC-1-Qori-Architecture

## Background

Qori is an AI-enabled Slack bot designed to streamline research operations (researchops) for civic tech user-experience (UX) researchers. By leveraging structured YAML-based files—research method cards (e.g., `affinity_mapping.yaml`, `usability_test.yaml`), research briefs, research plans, discussion guides, and `insights_card.yaml`—Qori enforces standardized workflows across product teams. These YAML templates reside in a GitHub repository, where Qori retrieves and applies them to incoming research requests and artifacts.

Within Slack, researchers can:

- **Start a Study**: Use `/qori new study <folder name>` to initialize a new research project in GitHub, creating the necessary folder structures and instantiating all required YAML templates (briefs, plans, discussion guides, method cards, and `insights_card.yaml`).
- **Instantiate Templates**: Use `/qori create-template-study <template> <input>` to generate a new file from any YAML template (method cards, briefs, plans, discussion guides, `insights_card.yaml`), automatically filling its placeholders with provided inputs.
- **Ingest** research artifacts (interview transcripts, notes, media links) referenced in GitHub.
- **Import Zoom Recordings**: Automatically fetch interview video and transcript via the Zoom API for synthesis.
- **Synthesize** insights through large-language models, using logic defined in the templates’ YAML.
- **Share** structured summaries back in Slack threads and **push synthesized insights** to GitHub issues using `insights_card.yaml`.

Secondary stakeholders—designers, product managers, and developers—then consume these structured outputs directly in their channels or triage them in GitHub issues.

## Requirements

**Must** (M):

- **Slack slash commands** for:
  - `/qori new study <folder name>`: initialize a new research project in GitHub, creating folder structures and instantiating all required YAML templates (briefs, plans, discussion guides, and method cards).
  - `/qori create-template-study <template> <input>`: generate a new file from any YAML template (method cards, briefs, plans, discussion guides), automatically filling its placeholders with provided input.

- **YAML Template Management**: retrieve, parse, and instantiate YAML templates (including `insights_card.yaml`) from GitHub.
- **Artifact Ingestion**: ingest research artifacts (transcripts, notes, media links) referenced in GitHub.
- **Zoom API Integration**: fetch meeting recordings and transcripts for synthesis.
- **LLM-Based Synthesis**: synthesize insights using prompts and logic defined in YAML templates.
- **Output Delivery**: post structured summaries back into Slack threads and push synthesized insights using `insights_card.yaml` to GitHub issues.
- **Authentication & Security**: secure OAuth/token-based authentication for Slack, GitHub, and Zoom; manage secrets via environment variables.

**Should** (S):

- Schedule and post weekly digests of recent insights into designated Slack channels (#research, #ux, etc.).
- Support attachments (images, audio snippets) in Slack posts.
- Provide basic logging and monitoring for job queues and LLM calls.
- Host a full-fledged web UI beyond Slack/GitHub integrations.

**Could** (C):

- Offer a lightweight analytics dashboard (usage metrics, summary counts).
- Allow customization of LLM model choice per team or project.

**Won't** (W):

- Support other chat platforms (Teams, Discord) in MVP.

## Method

Below is the updated high-level architecture for Qori, illustrating how each component interacts to fulfill the Requirements, including Zoom integration, project scaffolding, and template instantiation. The PlantUML diagram captures event flows, services, and data stores:

```plantuml
@startuml
!define RECTANGLE class
RECTANGLE "Slack Bot\n(Node.js + Bolt)" as SlackBot
RECTANGLE "GitHub Repo\n(YAML templates & artifacts)" as GitHub
RECTANGLE "Redis / BullMQ\nJob Queue" as Queue
RECTANGLE "LangChain-JS Router" as Router
RECTANGLE "AI Workers\n(Python microservices)" as Workers
RECTANGLE "Zoom API" as ZoomAPI
RECTANGLE "Vector Store\n(pgvector / Pinecone)" as VectorStore
RECTANGLE "Postgres\n(Config, transcripts)" as Postgres

SlackBot --> Queue : enqueue(request)
Queue --> Router : dequeue()

SlackBot --> Router : slashCommand(new study)
Router --> GitHub : create(study folder & YAML templates)
Router --> SlackBot : ack(study created)

SlackBot --> Router : slashCommand(create-template)
Router --> GitHub : fetch(template)
Router --> Router : fill(template, input)
Router --> GitHub : commit(new file)
Router --> SlackBot : post(file link)

SlackBot --> Queue : enqueue(synthesis request)
Queue --> Router : dequeue()
Router --> GitHub : fetch(artifacts)
Router --> ZoomAPI : fetch(recording, transcript)
ZoomAPI --> Workers : deliver(raw audio + transcript)
Router --> Workers : dispatch(method, data)
Workers --> Postgres : store(raw transcripts)
Workers --> VectorStore : embed(transcripts)
Workers --> VectorStore : retrieve(similar context)
Workers --> Router : return(summary)
Router --> SlackBot : post(summary)
Router --> GitHub : create(issue)

@enduml
```

**Explanation of Components and Flows:**

- **Slack Bot:** Implements slash commands:
  - `/qori new study <folder name>` creates a study folder and instantiates all YAML templates in GitHub.
  - `/qori create-template-study <template> <input>` retrieves a specified YAML template, populates it with input, commits the new file, and posts a link.
  - Other commands enqueue synthesis requests.
- **Redis/BullMQ:** Queues synthesis jobs for reliable, asynchronous processing.
- **LangChain-JS Router:** Central orchestrator:
  - Handles study creation and template instantiation flows.
  - Fetches GitHub templates and artifacts.
  - Invokes the Zoom API to retrieve recordings and transcripts.
  - Dispatches method-specific requests to AI Workers.
- **Zoom API Integration:** Provides raw video/audio and transcripts of Zoom interviews to AI Workers.
- **AI Workers (Python):** Execute:
  - **Transcription Worker:** Ensures Whisper transcription if needed.
  - **LLM Worker:** Uses prompts from YAML to synthesize summaries.
- **Insights Card Handling:** Qori uses an `insights_card.yaml` template to structure synthesized insights. After synthesis, the Router fills this template and commits it to GitHub as part of the issue body, providing a standardized issue card for stakeholders.
- **Storage Layers:**
  - **Postgres:** Persists transcripts, job statuses, and configuration.
  - **Vector Store:** Maintains embeddings for retrieval-augmented generation.
- **Output Delivery:** Router posts structured summaries to Slack and commits GitHub issues using `insights_card.yaml`, closing the loop on researchops.

## Implementation

1. **Infrastructure Setup**:
   - Provision managed Redis and Postgres instances (e.g., AWS ElastiCache, RDS).
   - Set up environment for AI Workers: Docker images with Python 3.10, Whisper v3, and OpenAI SDK.
   - Deploy Node.js Slack Bot and LangChain-JS Router on a container orchestration service (e.g., AWS ECS or Kubernetes).
   - Configure OAuth apps for Slack, GitHub, and Zoom; store credentials in a secrets manager (e.g., AWS Secrets Manager).

2. **Repository and YAML Templates**:
   - Create a mono-repo with folders for `templates/` (YAML files) and `services/` (Slack Bot, Router, Workers).
   - Define schema for templates (placeholders, input formats) and implement a validation library.

3. **Slack Bot & Router**:
   - Implement slash command handlers using `@slack/bolt`.
   - Integrate Redis/BullMQ for job enqueueing.
   - Develop Router modules to fetch and instantiate templates, call Zoom API, and orchestrate AI Workers.

4. **AI Workers**:
   - Build a transcription microservice using Whisper v3.
   - Implement LLM synthesis service with retry logic and prompt templating.
   - Integrate vector store (pgvector extension on Postgres or Pinecone).

5. **CI/CD & Monitoring**:
   - Configure GitHub Actions for building and deploying services.
   - Integrate monitoring and alerting (e.g., Prometheus + Grafana) for job queue lengths, API failures, and latency.

## Milestones

- **M1** (Weeks 1–2): Infrastructure provisioning, repo setup, basic slash commands (`/qori new study`).
- **M2** (Weeks 3–4): Template instantiation flow (`/qori create-template-study`), YAML validation.
- **M3** (Weeks 5–6): Artifact ingestion, Zoom API integration, basic LLM synthesis in Slack.
- **M4** (Week 7): GitHub issue creation, weekly digest scheduling.
- **M5** (Week 8): Monitoring, logging, vector store integration.
- **M6** (Weeks 9–10): Web UI prototype (optional), final testing, and documentation.

## Gathering Results

- Track key metrics: number of studies created, templates instantiated, syntheses completed, and user engagement in Slack.
- Collect feedback from researchers on output quality and workflow improvements.
- Monitor system performance: job queue latency under peak loads, LLM call success rates, and API error rates.

## Onboarding & Discoverability

### In-Slack Template Directory

- `/qori list-templates` — lists all available YAML templates, with brief descriptions.  
- `/qori help <command>` — shows usage examples and argument details in a Slack modal.

### Interactive Modals for Complex Inputs

- For multi-step workflows (e.g., multi-phase discussion guides), launch a Slack Modal rather than relying solely on long slash-command arguments.  
- Each field in the modal validates user input (dates, required text), with inline help.

---

## Governance & Auditability

### Role-Based Access Controls (RBAC)

- Map GitHub repo permissions to user roles in Slack (e.g., “Researcher,” “PM,” “Admin”).  
- Only authorized roles can perform sensitive actions (e.g., closing issues, deleting studies).

### Immutable Audit Logs

- Log every `/qori` command invocation with `user_id`, timestamp, command, and arguments.  
- Store logs in a write-only ledger (e.g., append-only database) for compliance and traceability.

---

## Error Handling & Resilience

### Automated Retries & Dead-Letter Queue

- Configure BullMQ with an exponential backoff policy (e.g., 3 retries, doubling delay).  
- On final failure, route the job to a Dead-Letter Queue for manual investigation.

### User-Facing Error Notifications

- If synthesis, transcription, or commit fails, send a Slack message with:  
  1. A clear summary of what went wrong.  
  2. A “Retry” button that re-enqueues the job.  
  3. A link to view detailed logs (for admins).

---

## Privacy & Data Retention

### PII Detection & Redaction

- Run transcripts through a PII-redaction pipeline (names, emails, phone numbers) before embeddings or GitHub commits.  
- Log redaction summaries to an audit store but never persist raw PII.

### Configurable Retention Policies

- Implement TTL (time-to-live) settings per data type:  
  - Raw audio: 30 days  
  - Transcripts & embeddings: 90 days  
- Allow workspace admins to override defaults via `/qori config set retention`.

---

## Template Versioning & Governance

### Schema Version Metadata

- Each YAML template includes a `version:` field.  
- `/qori migrate-study` detects outdated versions and offers migration steps.

### Review & Approval Workflow

- Store templates in a dedicated GitHub “templates” repository.  
- Enforce review via pull requests and CODEOWNERS to ensure designated template owners approve changes.

---

## Quality Feedback & Analytics

### User Feedback Buttons

- Include “👍/👎” buttons on each summary post in Slack.  
- Collect feedback to gauge LLM accuracy and inform prompt refinements.

### Error & Quality Metrics Dashboard

- Track:  
  - Average synthesis latency  
  - Failure rates per template  
  - Feedback-weighted quality scores

### Automated Reports

- Send weekly email to workspace admins summarizing top-performing templates and common errors.

---

## Search & Extensibility

### In-Slack Insight Search

- `/qori search <keyword>` queries the vector store and returns relevant past insights directly in Slack.

### Additional Connectors

- Provide a connector framework to index and retrieve data from Figma, Miro, Google Docs, etc.  
- Each connector implements a standardized CRUD interface for seamless integration.

## Production Hardening & Enterprise-Grade Reliability

### 1. Observability & SLOs
- **Distributed Tracing**  
  Instrument the SlackBot (Bolt), Router, and Workers with OpenTelemetry so you can see one trace from `/qori` through Redis → Router → Worker → GitHub/Slack.  
- **Metrics**  
  - `Queue.size()`, `Queue.waitTime()` (BullMQ)  
  - Handler latencies in the Router  
  - Model call latencies in each AI Worker  

### 2. Resilience Patterns
- **Circuit Breakers**  
  Wrap calls invoked by the Router (e.g. `ZoomAPI.fetch()`, OpenAI/Claude client) to prevent cascading failures.  
- **Bulkheads**  
  Separate Worker pools (e.g. transcription vs. synthesis) to isolate high-volume jobs.  
- **Backpressure**  
  Hook into BullMQ’s `queue.add()` from SlackBot to reject or delay new jobs when Redis is at capacity.  

### 3. Idempotency & Exactly-Once
- Use a unique job ID (e.g. `${user}_${timestamp}_${command}`) as the BullMQ dedupe key.  
- Before `GitHub.create(issue)` or `SlackBot.post(summary)`, check for an existing artifact with that key (via issue title or message metadata).  

### 4. Canary / Blue-Green
- Deploy a “v2” of your Workers behind a feature flag.  
- Route a small percentage of `enqueue(synthesis request)` jobs to the new Worker pool and compare success/latency before full rollout.  

### 5. Security & Compliance
- **Least-Privilege Scopes**  
  - SlackBot only needs minimal scopes to post messages and receive slash-commands.  
  - Router’s GitHub token uses a fine-grained App installation limited to `templates/` and `studies/` folders.  
- **PII Redaction**  
  Transcripts in Postgres pass through a redaction step in the Workers before storage or `VectorStore.embed()`.  

### 6. Chaos & Load Testing
- In staging, intercept `Queue.dequeue()` to inject artificial ZoomAPI or VectorStore failures and validate retry/DLQ behavior.  
- Ramp up thousands of `/qori new study` or `/qori synthesize` calls to test autoscaling rules on Router and Workers.  

### 7. Developer DX
- Provide a single `docker-compose.yml` that brings up:  
  SlackBot (with an ngrok tunnel), Redis/BullMQ, Router, a mock ZoomAPI server, Postgres+pgvector, and a dummy VectorStore.  
- Add contract tests asserting that the UML-modeled “Router → Workers → Router” JSON payload always satisfies your schema.  
