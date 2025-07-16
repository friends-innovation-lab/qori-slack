# Technical Deployment Scenario: VA Client Ready

## Phase 1: Pre-Demo Setup (Week 1)

### VA Side Prep:
- VA provisions **air-gapped development environment** (AWS GovCloud/Azure Gov or on-premises)
- VA IT provides **infrastructure specs**: Kubernetes cluster, networking rules, security requirements
- VA security team reviews **Qori Security Package**: threat model, data flow diagrams, encryption specs

### Qori Side Delivery:
```
qori-enterprise-v1.2.3/
├── docker-compose.yml           # Local demo mode
├── kubernetes/                  # Production K8s manifests
│   ├── namespace.yaml
│   ├── postgres-deployment.yaml
│   ├── redis-deployment.yaml
│   ├── slack-bot-deployment.yaml
│   ├── ai-workers-deployment.yaml
│   └── ingress.yaml
├── config/
│   ├── default-settings.yml     # YAML templates
│   ├── security-policy.yml
│   └── compliance-audit.yml
├── scripts/
│   ├── install.sh              # One-click installer
│   ├── health-check.sh
│   └── backup.sh
└── docs/
    ├── deployment-guide.pdf
    ├── security-review.pdf
    └── admin-manual.pdf
```

## Phase 2: Demo Environment Deploy (Week 2)

### VA IT runs the installer:
```bash
# On VA's Kubernetes cluster
./scripts/install.sh --environment=demo --domain=qori-demo.va.gov

# What happens behind the scenes:
# 1. Creates isolated namespace
# 2. Deploys all microservices with proper networking
# 3. Initializes databases with sample data
# 4. Configures Slack workspace integration
# 5. Sets up monitoring/logging dashboards
# 6. Runs health checks
```

### "Unfurling" in Action:
- **Postgres** spins up with proper schemas for participants, transcripts, insights
- **Redis/BullMQ** starts with job queues configured
- **AI Workers** (LLM, Transcription, CrewAI) deploy as separate pods
- **Slack Bot** connects to VA's approved Slack workspace
- **LangChain Router** orchestrates everything with proper service discovery

## Phase 3: Pilot with Real Research Team (Week 3-4)

### Demo Scenario:
1. **VA Researcher** joins dedicated Slack channel: `#qori-pilot-housing-research`
2. **Command**: `/new-study "Veterans Housing Application Feedback"`
3. **Qori** automatically:
   - Creates GitHub repo folder structure
   - Sets up participant tracking database
   - Generates interview guide templates
   - Posts setup summary to Slack

### Real workflow test:
```
VA Researcher uploads: housing_interview_audio.mp3
→ Transcription Worker processes locally (no data leaves VA)
→ LLM Worker tags themes: "navigation issues", "document confusion"  
→ Results posted to #qori-pilot-housing-research
→ Insights auto-converted to GitHub issues for dev team
```

## Phase 4: Production Deployment Discussion (Week 5-6)

### Technical Requirements Meeting:
- **Scaling**: How many concurrent interviews/researchers?
- **Integration**: Connect to VA's existing GitHub Enterprise, ServiceNow, etc.
- **Backup/Recovery**: Integration with VA's backup systems
- **Monitoring**: Push metrics to VA's existing Splunk/Datadog
- **Updates**: How Qori delivers security patches without internet access

### Production Architecture Planning:
```yaml
# Production scaling example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: qori-ai-workers
spec:
  replicas: 5  # Scale based on VA's research volume
  template:
    spec:
      containers:
      - name: llm-worker
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi" 
            cpu: "4"
```

## Phase 5: Procurement & Implementation (Months 2-6)

### What VA Gets:
- **Software License**: Perpetual license for Qori enterprise
- **Deployment Package**: All containers, configs, documentation
- **Support Contract**: 1 year of updates, security patches, technical support
- **Training Package**: Admin training, user workshops, best practices guide

### VA's Ongoing Operation:
- **Their IT team** manages infrastructure, backups, scaling
- **Qori provides** software updates via encrypted package delivery
- **No ongoing SaaS fees**, just support/maintenance contract
- **Full data ownership** - everything stays within VA's environment

## Key Technical Enablers

### 1. Hermetic Deployment
```bash
# Everything needed is in the package
qori-deploy --offline-mode  # No external dependencies
```

### 2. Configuration Management
```yaml
# VA-specific settings
va-config.yml:
  slack_workspace: "va-research.slack.com"
  github_org: "department-of-veterans-affairs"
  ai_models: "claude-sonnet-local"  # Local model deployment
  compliance_mode: "fedramp_moderate"
```

### 3. Monitoring/Observability Built-in
- Prometheus metrics for all services
- Grafana dashboards for research analytics
- Audit logs for compliance reporting

---

**Bottom Line**: This approach lets VA **kick the tires** with minimal commitment, then **own the entire stack** once they're convinced it works.