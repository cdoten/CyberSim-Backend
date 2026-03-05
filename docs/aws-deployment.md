# AWS Deployment Guide

This document describes how to deploy the CyberSim Backend API to AWS using Elastic Beanstalk and RDS.

The backend runs inside a Docker container defined by the `Dockerfile` in the repository root.

## Overview

Production deployment consists of:

- Elastic Beanstalk (Docker platform)
- PostgreSQL (Amazon RDS)
- Environment variables configured in EB

Each environment (e.g., staging, production) should have its own:
- Elastic Beanstalk environment
- RDS database

## Elastic Beanstalk Setup

### Create Environment

1. Environment tier: **Web server**
2. Platform: **Docker (Amazon Linux 2023)**
3. Preset: **Single instance** (recommended for initial deployment)
4. Monitoring: **Basic**

The backend runs inside the Docker container defined in the repository.

## Required Environment Variables

Set these in:

Elastic Beanstalk → Configuration → Software → Environment properties

### Required

- `PORT=8080`
- `NODE_ENV=production`
- `DB_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>`

`PORT` must match the port the app listens on inside the Docker container.

### Optional

- `IMPORT_PASSWORD`
- `LOG_LEVEL`
- `UI_ORIGIN=https://<your-amplify-domain>` (recommended)

## CORS Configuration

Because the CyberSim UI is hosted separately (e.g., AWS Amplify), the backend must allow cross-origin requests.

Ensure the Express application enables CORS for the UI origin. A common pattern:

```js
const cors = require('cors');

app.use(
  cors({
    origin: process.env.UI_ORIGIN || '*',
  }),
);
```

For production, prefer setting `UI_ORIGIN` to your Amplify domain rather than `*`.

## Docker Port

Elastic Beanstalk expects the container to listen on port **8080**.

Ensure:

- The application listens on `process.env.PORT`
- The Dockerfile includes:

```dockerfile
EXPOSE 8080
```

## RDS (PostgreSQL) Setup

Recommended baseline configuration:

- Engine: PostgreSQL
- Version: 15.x
- Instance class: `db.t3.micro`
- Storage: 20GB
- Availability: Low (single AZ)
- Deletion policy: Snapshot

Each EB environment should connect to its own RDS instance.

## Database Migration

Before the backend can operate, the database schema must be created.

Run migrations after the environment is created:

```bash
npm run knex migrate:latest
```

You can run this either:

- From a machine that can reach RDS (e.g., via the SSH tunnel below), or
- From inside the Elastic Beanstalk EC2 instance/container (depending on your ops workflow)

## Database Access (SSH Tunnel)

If direct database access is required from a local machine:

1. SSH into the EB EC2 instance.
2. Create a local port forward to the RDS endpoint.

Example:

```bash
ssh -N -L 5432:<RDS_ENDPOINT>:5432 ec2-user@<EC2_PUBLIC_IP> -i <PRIVATE_KEY>
```

Then connect locally:

```bash
psql -U <USER> -h 127.0.0.1 -p 5432
```

## Deployment Validation

After deployment, verify the backend is reachable at:

- `https://<elastic-beanstalk-url>/health`
- `https://<elastic-beanstalk-url>/health/db`
- `https://<elastic-beanstalk-url>/health/airtable`

All should return HTTP 200.

## Notes

- Each environment should use isolated database credentials.
- Secrets should be managed securely (consider AWS Secrets Manager for production).
- Avoid embedding credentials directly in source control.
- After the backend is live, update the UI to point at it:
  - Set `REACT_APP_API_URL=https://<elastic-beanstalk-url>` in Amplify and redeploy the UI.
