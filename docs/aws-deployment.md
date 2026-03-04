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
2. Platform: **Docker (Amazon Linux 2)**
3. Preset: **Single instance**
4. Monitoring: **Basic**

The backend runs inside the Docker container defined in the repository.


## Required Environment Variables

Set these in:

Elastic Beanstalk → Configuration → Software → Environment properties

### Required

- `PORT=8080`
- `NODE_ENV=production`
- `DB_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>`

`PORT` must match the port exposed in the Docker container.

### Optional

- `IMPORT_PASSWORD`
- `LOG_LEVEL`

## RDS (PostgreSQL) Setup

Recommended baseline configuration:

- Engine: PostgreSQL
- Version: 15.x
- Instance class: `db.t3.micro`
- Storage: 20GB
- Availability: Low (single AZ)
- Deletion policy: Snapshot

Each EB environment should connect to its own RDS instance.

## Database Access (SSH Tunnel)

If direct database access is required from a local machine:

1. SSH into the EB EC2 instance.
2. Create a local port forward to the RDS endpoint.

Example:
	
	ssh -N -L 5432:<RDS_ENDPOINT>:5432 ec2-user@<EC2_PUBLIC_IP> -i <PRIVATE_KEY>

Then connect locally:

	psql -U <USER> -h 127.0.0.1 -p 5432

## Deployment Validation

After deployment, verify:

- `GET /health`
- `GET /health/db`
- `GET /health/airtable`

## Notes

- Each environment should use isolated database credentials.
- Secrets should be managed securely (consider AWS Secrets Manager for production).
- Avoid embedding credentials directly in source control.
