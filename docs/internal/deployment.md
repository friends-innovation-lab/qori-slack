# Qori Deployment Guide

How to deploy and maintain the Qori platform.

---

## Environments

| Environment | Purpose | Branch |
|-------------|---------|--------|
| Development | Testing new features | `develop` |
| Staging | Pre-production validation | `staging` |
| Production | Live system | `main` |

---

## Prerequisites

### Required Access
- GitHub repository access
- Slack workspace admin
- Cloud platform credentials
- LLM API keys (Anthropic, OpenAI)

### Environment Variables

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_ORG=your-org

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Application
NODE_ENV=production
LOG_LEVEL=info
```

---

## Deployment Steps

### 1. Configuration Updates

When updating modals or prompts:

```bash
# Pull latest changes
git pull origin main

# Review changes
git diff HEAD~1 --name-only

# Verify JSON/YAML validity
npm run validate

# Deploy config changes
npm run deploy:config
```

### 2. Backend Deployment

```bash
# Build
npm run build

# Run tests
npm test

# Deploy to staging
npm run deploy:staging

# Verify staging
npm run verify:staging

# Deploy to production
npm run deploy:production
```

### 3. Slack App Updates

For changes to slash commands or permissions:

1. Go to api.slack.com/apps
2. Select the Qori app
3. Update slash commands, scopes, or event subscriptions
4. Reinstall app to workspace

---

## Rollback Procedures

### Config Rollback

```bash
# Find previous version
git log --oneline config/

# Checkout specific file
git checkout <commit> -- config/prompts/feature.yaml

# Or revert entire commit
git revert <commit>

# Push rollback
git push origin main
```

### Backend Rollback

```bash
# List deployments
npm run deployments:list

# Rollback to previous
npm run rollback:production

# Verify
npm run verify:production
```

---

## Monitoring

### Health Checks

```bash
# Check service status
npm run health

# Check Slack connection
npm run health:slack

# Check GitHub connection
npm run health:github

# Check LLM providers
npm run health:llm
```

### Logs

```bash
# View recent logs
npm run logs

# Follow logs
npm run logs:follow

# Filter by level
npm run logs -- --level=error

# Sam-specific logs
tail -f logs/sam-conversations.log
```

### Alerts

Alerts are configured for:
- Service downtime
- Error rate > 5%
- Response time > 10s
- LLM API failures

Alert channels:
- #qori-alerts (Slack)
- PagerDuty (urgent)

---

## Maintenance

### Regular Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| Log rotation | Daily | `npm run logs:rotate` |
| Dependency updates | Weekly | `npm audit && npm update` |
| Security scan | Weekly | `npm run security:scan` |
| Backup configs | Daily | Automatic via GitHub |

### Database Maintenance

```bash
# Backup database
npm run db:backup

# Vacuum/optimize
npm run db:optimize

# Check integrity
npm run db:check
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
npm run logs -- --since=10m

# Verify environment
npm run env:verify

# Check dependencies
npm run deps:check
```

### Slack Integration Issues

1. Verify bot token is valid
2. Check app is installed in workspace
3. Verify slash command URLs are correct
4. Check event subscriptions

### GitHub Integration Issues

1. Verify token has repo scope
2. Check org/repo permissions
3. Verify webhook configuration
4. Test API connectivity

### LLM Provider Issues

1. Check API key validity
2. Verify quota/billing status
3. Check rate limiting
4. Test with smaller requests

---

## Security

### Secret Rotation

Rotate secrets quarterly or immediately if compromised:

1. Generate new secret
2. Update in secret manager
3. Deploy with new secret
4. Revoke old secret
5. Verify functionality

### Access Review

Monthly review of:
- Team access to repositories
- Slack app permissions
- API key usage
- Admin accounts

### Incident Response

1. Identify scope of issue
2. Contain if security-related
3. Notify relevant parties
4. Document in incident log
5. Remediate
6. Post-mortem review

---

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Backend Developer | Tanzeel | Primary |
| Product Lead | [TBD] | Secondary |
| Security | [TBD] | Security issues |

---

## Reference

- [Architecture](architecture.md)
- [Database Schema](database-schema.md)
- [Common Tasks](common-tasks.md)
