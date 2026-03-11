# AWS Deployment Guide

This document describes how to deploy the CyberSim Backend API to AWS
using Elastic Beanstalk, Docker, an Application Load Balancer (ALB) with
ACM TLS, and PostgreSQL on Amazon RDS.

The backend runs inside a Docker container defined by the `Dockerfile`
in the repository root.

## Quick Deployment Summary

A typical production deployment follows these steps:

1.  Create shared infrastructure (security groups, RDS database, ACM
    certificate).
2.  Create an Elastic Beanstalk environment using the Docker platform.
3.  Attach reusable security groups to the load balancer and instances.
4.  Configure environment variables in Elastic Beanstalk.
5.  Deploy the backend application bundle.
6.  Configure the load balancer HTTPS listener and health checks.
7.  Point `api.cybersim.app` to the EB environment using Cloudflare DNS.
8.  Run database migrations and seed initial data.

Once configured, future deployments only require uploading a new
application bundle.

## Overview

Production deployment consists of the following components:

-   Cloudflare DNS
-   AWS Application Load Balancer (ALB) with ACM TLS
-   Elastic Beanstalk (Docker platform)
-   PostgreSQL (Amazon RDS)
-   Environment variables configured in Elastic Beanstalk

Architecture:

    Internet
       │
    Cloudflare DNS
       │
    api.cybersim.app
       │
    HTTPS (443)
       │
    AWS Application Load Balancer
       │
    Elastic Beanstalk EC2 Instance
       │
    Docker container
       │
    Node / Express API
       │
    PostgreSQL (RDS)

Infrastructure components such as security groups and TLS certificates
should be created once and reused across environments.

### Security Group Relationship Diagram

    Internet
       │
       ▼
    cybersim-alb-public-sg
      inbound: 80, 443 from 0.0.0.0/0
       │
       ▼
    cybersim-backend-app-sg
      inbound: 8080 from cybersim-alb-public-sg
       │
       ▼
    cybersim-rds-production-sg
      inbound: 5432 from cybersim-backend-app-sg

This arrangement allows:

-   public web traffic to reach the load balancer
-   only the load balancer to reach backend instances
-   only backend instances to reach PostgreSQL

## Infrastructure Setup (One-Time Setup)

### Security Groups

Create three reusable security groups.

#### ALB Security Group

Example:

    cybersim-alb-public-sg

Inbound rules:

    80   from 0.0.0.0/0
    443  from 0.0.0.0/0

Outbound:

    Allow all

#### Backend Application Security Group

Example:

    cybersim-backend-app-sg

Inbound rules:

    8080 from cybersim-alb-public-sg

Outbound:

    Allow all

#### Database Security Group

Example:

    cybersim-rds-production-sg

Inbound rules:

    5432 from cybersim-backend-app-sg

### Create the PostgreSQL Database

Create an Amazon RDS PostgreSQL instance.

Recommended baseline configuration:

-   Engine: PostgreSQL
-   Version: 15.x
-   Instance class: small / free-tier compatible
-   Storage: 20GB
-   Availability: Single AZ
-   Public access: Disabled
-   VPC: Same VPC used for Elastic Beanstalk
-   Security group: `cybersim-rds-production-sg`

Create the database:

    cybersim

Record the connection string:

    postgres://<USER>:<PASSWORD>@<RDS-ENDPOINT>:5432/cybersim

### Create TLS Certificate (ACM)

Request a certificate in AWS Certificate Manager for:

    api.cybersim.app

Use DNS validation and wait for status:

    Issued

## Elastic Beanstalk Setup

### Create Environment

Configuration:

-   Environment tier: **Web server**
-   Platform: **Docker (Amazon Linux 2023)**
-   Environment type: **Load balanced**
-   Instance type: **t3.micro**
-   Minimum instances: **1**
-   Maximum instances: **1**

Attach instance role:

    aws-elasticbeanstalk-ec2-role

Ensure the role includes:

    AmazonSSMManagedInstanceCore

### Attach Security Groups

Load balancer security group:

    cybersim-alb-public-sg

Instance security group:

    cybersim-backend-app-sg

## Application Configuration

### Required Environment Variables

Set these in:

Elastic Beanstalk → Configuration → Software → Environment properties

    PORT=8080
    NODE_ENV=production
    DB_URL=postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>
    UI_ORIGINS=https://cso.cybersim.app,https://main.xxxxxx.amplifyapp.com

For local development you may add:

    http://localhost:3000,http://127.0.0.1:3000

### CORS Configuration

Example Express configuration:

``` javascript
const cors = require('cors');

app.use(
  cors({
    origin: process.env.UI_ORIGINS?.split(',') || '*',
  }),
);
```

### Docker Port Configuration

The app must listen on port 8080.

Example:

``` javascript
const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0');
```

Dockerfile must include:

``` dockerfile
EXPOSE 8080
```

## Load Balancer Configuration

### HTTPS Listener

Port:

    443

Certificate:

    ACM certificate for api.cybersim.app

Recommended policy:

    ELBSecurityPolicy-TLS13-1-2-2021-06

### HTTP Redirect

    HTTP :80 → HTTPS :443

### Health Checks

Path:

    /health

Expected response:

``` json
{"status":"ok"}
```

## Deployment

Create a deployment bundle:

``` bash
zip -r deploy.zip .   -x "node_modules/*"   -x "*.env*"   -x ".git/*"
```

Upload the archive when deploying a new version.

## Database Migration and Seeding

Connect to the instance via Session Manager:

``` bash
aws ssm start-session --target <instance-id>
```

Identify the container:

``` bash
docker ps
```

Enter the container:

``` bash
docker exec -it <container-id> sh
```

Run migrations:

``` bash
npm run migrate
```

Seed:

``` bash
npm run seed
```

Dataset seed:

``` bash
SEED_TAG=cso@YYYY-MM-DD.X npm run seed:dataset
```

## Deployment Validation

Verify:

    https://api.cybersim.app/health
    https://api.cybersim.app/health/db

## DNS Configuration

Cloudflare DNS:

    api.cybersim.app → CNAME → <environment><aws-string>.us-east-1.elasticbeanstalk.com

SSL mode:

    Full (strict)

## Result

A working deployment consists of:

-   Cloudflare DNS
-   AWS Application Load Balancer with ACM TLS
-   Elastic Beanstalk environment
-   Docker backend container
-   PostgreSQL RDS database
