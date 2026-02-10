# 🏛️ Stakeholder Synthesis — Architecture & Workflow

> Visual documentation for `stakeholder_synthesis.yaml` v3.0
> Generated: 2026-02-10

---

## Processing Pipeline

How a stakeholder synthesis runs from input to output:

```mermaid
flowchart TD
    A[📥 Slack Modal Form] --> B[Validate Inputs]
    B --> C[Auto-Discover Files]
    C --> D{Files Found?}
    D -->|Yes| E[Verify All Files Loaded]
    D -->|No| F[❌ Abort — No Files]
    E --> G[Combine File Content]
    G --> H[Execute AI Tasks]
    
    H --> T1[Task 1: Overview\nStakeholders\nConstraints]
    H --> T2[Task 2: Priorities\nBackstage Processes]
    H --> T3[Task 3: Service Blueprint\nResearch Questions]
    H --> T4[Task 4: Recommendations\nOpen Questions]
    
    T1 --> J[Concatenate Outputs]
    T2 --> J
    T3 --> J
    T4 --> J
    
    J --> K[Validate All Stakeholders\nRepresented]
    K --> L[Populate Template]
    L --> M[Save to Outputs]
    M --> N[📤 Slack Notification]
    M --> O[📄 GitHub Markdown File]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style H fill:#1a1a2e,stroke:#0f3460,color:#fff
    style T1 fill:#16213e,stroke:#e94560,color:#fff
    style T2 fill:#16213e,stroke:#e94560,color:#fff
    style T3 fill:#16213e,stroke:#e94560,color:#fff
    style T4 fill:#16213e,stroke:#e94560,color:#fff
    style N fill:#0f3460,stroke:#53d8fb,color:#fff
    style O fill:#0f3460,stroke:#53d8fb,color:#fff
    style F fill:#e94560,stroke:#e94560,color:#fff
```

---

## Multi-Task AI Architecture

Why 4 tasks instead of 1 — and what each produces:

```mermaid
flowchart LR
    INPUT[Combined\nStakeholder\nFiles] --> CLAUDE[Claude Sonnet\n8K max output\ntemp 0.3]
    
    CLAUDE --> T1[**Task 1**\n~2-3K tokens]
    CLAUDE --> T2[**Task 2**\n~3-4K tokens]
    CLAUDE --> T3[**Task 3**\n~2-3K tokens]
    CLAUDE --> T4[**Task 4**\n~2-3K tokens]
    
    T1 --> S1[Overview Table]
    T1 --> S2[Stakeholders Interviewed]
    T1 --> S3[Constraints & Blockers]
    
    T2 --> S4[Strategic Priorities]
    T2 --> S5[Backstage Processes\n+ Failure Modes]
    
    T3 --> S6[Service Blueprint\nImplications]
    T3 --> S7[Research Questions]
    
    T4 --> S8[Open Questions]
    T4 --> S9[Recommendations]
    T4 --> S10[Next Interviews]
    
    S1 --> FINAL[📄 Final\nSynthesis\nDocument]
    S2 --> FINAL
    S3 --> FINAL
    S4 --> FINAL
    S5 --> FINAL
    S6 --> FINAL
    S7 --> FINAL
    S8 --> FINAL
    S9 --> FINAL
    S10 --> FINAL

    style INPUT fill:#1a1a2e,stroke:#53d8fb,color:#fff
    style CLAUDE fill:#e94560,stroke:#e94560,color:#fff
    style FINAL fill:#0f3460,stroke:#53d8fb,color:#fff
```

---

## File Discovery System

How the auto-discovery finds stakeholder files:

```mermaid
flowchart TD
    START[Study Folder Selected] --> SCAN[Scan search path:\n01-planning/stakeholder-interviews/]
    
    SCAN --> P1{Match stakeholder\npatterns?}
    P1 -->|"*stakeholder* *transcript*\n*internal* *sme* *engineering*\n*product_owner* *policy*\n*design* *lead* *response*"| CORE[✅ Core Files\nPriority: Required\nWeight: 80]
    
    SCAN --> P2{Match guide\npatterns?}
    P2 -->|"*guide*"| GUIDE[📋 Interview Guides\nPriority: Optional\nWeight: 20]
    
    P1 -->|No match| SKIP1[Skip]
    P2 -->|No match| SKIP2[Skip]
    
    CORE --> MODAL[Present in Slack Modal\nfor user selection]
    GUIDE --> MODAL
    
    MODAL --> COMBINE[Combine selected\nfile content]
    COMBINE --> READY[Ready for\nAI processing]

    style CORE fill:#0f3460,stroke:#53d8fb,color:#fff
    style GUIDE fill:#16213e,stroke:#53d8fb,color:#fff
    style READY fill:#0f3460,stroke:#e94560,color:#fff
```

---

## Backstage Process Mapping Flow

How Task 2 maps each process it finds in interview data:

```mermaid
flowchart TD
    INT[Stakeholder\nInterview Data] --> IDENTIFY[Identify ALL major\nprocesses mentioned]
    
    IDENTIFY --> P[For Each Process]
    
    P --> FRONT[**Frontstage Steps**\nWhat user sees/does\n+ drop-off points]
    P --> BACK[**Backstage Steps**\nWhat happens invisibly\n+ systems involved\n+ latency/failure risk]
    P --> FAIL[**Failure Points**\nWhat breaks\nUser experience impact\nFrequency/severity]
    P --> SYS[**Systems Map**\nAPIs, databases\nvendors, integrations]
    
    FRONT --> BP[Process Map\nReady for\nService Blueprint]
    BACK --> BP
    FAIL --> BP
    SYS --> BP
    
    BP --> BLUEPRINT[Service Blueprint\nImplications\n— Task 3]

    style INT fill:#1a1a2e,stroke:#e94560,color:#fff
    style BP fill:#0f3460,stroke:#53d8fb,color:#fff
    style BLUEPRINT fill:#e94560,stroke:#e94560,color:#fff
```

---

## Constraint Triangulation

How the same constraint gets analyzed from multiple stakeholder angles:

```mermaid
flowchart TD
    CONSTRAINT[Constraint\nIdentified] --> ENG[🔧 Engineering\nTechnical angle\nSystem limitations]
    CONSTRAINT --> DES[🎨 Design\nUX impact angle\nUser experience effect]
    CONSTRAINT --> POL[📋 Policy\nCompliance angle\nRegulatory requirements]
    
    ENG --> TRI[Triangulated\nConstraint]
    DES --> TRI
    POL --> TRI
    
    TRI --> IMPACT[Quantified Impact\n+ Downstream Effects]
    TRI --> REC[Recommendations\nwith Feasibility]
    TRI --> QUESTIONS[Research Questions\nfor User Validation]

    style CONSTRAINT fill:#e94560,stroke:#e94560,color:#fff
    style TRI fill:#0f3460,stroke:#53d8fb,color:#fff
```

---

## Validation Rules

What gets checked before output is delivered:

```mermaid
flowchart LR
    OUTPUT[Generated\nOutput] --> V1{All stakeholders\nrepresented?}
    V1 -->|Yes| V2{Constraint\ntriangulation\npresent?}
    V1 -->|No| FAIL1[❌ Missing\nstakeholder insights]
    
    V2 -->|Yes| V3{Process maps have\nfrontend + backend?}
    V2 -->|No| FAIL2[❌ Single-perspective\nconstraints]
    
    V3 -->|Yes| V4{Numeric data\nincluded?}
    V3 -->|No| FAIL3[❌ Incomplete\nprocess maps]
    
    V4 -->|Yes| V5{All 4 task\noutputs present?}
    V4 -->|No| FAIL4[⚠️ Missing\nquantification]
    
    V5 -->|Yes| PASS[✅ Deliver]
    V5 -->|No| FAIL5[❌ Truncated\noutput]

    style PASS fill:#0f3460,stroke:#53d8fb,color:#fff
    style FAIL1 fill:#e94560,stroke:#e94560,color:#fff
    style FAIL2 fill:#e94560,stroke:#e94560,color:#fff
    style FAIL3 fill:#e94560,stroke:#e94560,color:#fff
    style FAIL4 fill:#e94560,stroke:#e94560,color:#fff
    style FAIL5 fill:#e94560,stroke:#e94560,color:#fff
```

---

## Output Delivery

Where the final synthesis goes:

```mermaid
flowchart LR
    FINAL[Final\nSynthesis] --> SLACK[Slack Notification\nto study channel]
    FINAL --> GH[GitHub Markdown\n01-planning/stakeholder-interviews/\nstudyname_synthesis_date.md]
    
    GH --> BLUEPRINT[Feeds → Service Blueprint\nbackstage layer]
    GH --> GUIDE[Feeds → Discussion Guide\ncreation]
    GH --> ASSESS[Feeds → Feasibility\nassessment]
    GH --> ALIGN[Feeds → Cross-team\nalignment docs]

    style FINAL fill:#e94560,stroke:#e94560,color:#fff
    style BLUEPRINT fill:#0f3460,stroke:#53d8fb,color:#fff
    style GUIDE fill:#0f3460,stroke:#53d8fb,color:#fff
    style ASSESS fill:#0f3460,stroke:#53d8fb,color:#fff
    style ALIGN fill:#0f3460,stroke:#53d8fb,color:#fff
```

---

*Architecture docs for `stakeholder_synthesis.yaml` v3.0 — Qori R&D*
