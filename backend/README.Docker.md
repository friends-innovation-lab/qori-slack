# Docker Setup for Qori Slack AI Bot

This guide explains how to run Qori using Docker.

## Prerequisites

- Docker and Docker Compose installed
- `.env` file configured (see `.env.example`)

## Quick Start

### Development

```bash
# Start all services (backend, postgres, redis)
docker-compose -f docker-compose-dev.yml up --build

# Start in detached mode
docker-compose -f docker-compose-dev.yml up -d

# View logs
docker-compose -f docker-compose-dev.yml logs -f qori-backend

# Stop services
docker-compose -f docker-compose-dev.yml down

# Stop and remove volumes (clears database)
docker-compose -f docker-compose-dev.yml down -v
```

### Production

```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f qori-backend

# Stop services
docker-compose down
```

## Services

### qori-backend
- **Port**: 3000
- **Command**: `npm run dev` (dev) or `npm run prod` (production)
- **Volumes**: Source code mounted for hot reload in development

### postgres
- **Port**: 5432
- **Database**: Configured via `DB_NAME` env variable
- **Volumes**: Persistent data storage

### redis
- **Port**: 6379
- **Volumes**: Persistent data storage with AOF enabled

## Environment Variables

Copy `.env.example` to `.env` and configure:

- **Slack**: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- **GitHub**: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
- **AI**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **Database**: `DB_NAME`, `DB_USER`, `DB_PASSWORD`

## Database Migrations

Run migrations inside the container:

```bash
# Development
docker-compose -f docker-compose-dev.yml exec qori-backend npm run db:migrate

# Production
docker-compose exec qori-backend npm run db:migrate
```

## Health Checks

- Backend: `http://localhost:3000/health`
- PostgreSQL: Automatically checked via healthcheck
- Redis: Automatically checked via healthcheck

## Troubleshooting

### Container won't start
- Check logs: `docker-compose logs qori-backend`
- Verify `.env` file exists and has all required variables
- Ensure ports 3000, 5432, 6379 are not in use

### Database connection errors
- Wait for postgres healthcheck to pass (takes ~10-30 seconds)
- Verify `DB_HOST=postgres` in docker-compose (not `localhost`)
- Check database credentials in `.env`

### Hot reload not working
- Ensure `docker-compose-dev.yml` is used (not `docker-compose.yml`)
- Check that source code volume is mounted correctly
- Restart container: `docker-compose restart qori-backend`

## Building Images

```bash
# Build development image
docker build -f Dockerfile.dev -t qori-backend:dev .

# Build production image
docker build -f Dockerfile -t qori-backend:prod .
```

