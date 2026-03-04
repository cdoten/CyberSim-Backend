# ndi-cybersim-api

[Postgres docker image](https://hub.docker.com/_/postgres)

Start postgres docker: docker-compose up -d

Stop postgres docker: docker-compose down

Reset database (rollback migrations → migrate → seed fixture data):

npm run reset-db

Database commands:

# Apply latest migrations

npm run migrate

# Roll back the most recent migration

npm run rollback

# Run seed scripts

npm run seed

Run tests:

npm run test

Start API:

npm run start

------------------------------------------------------------------------

# Local Development Setup

To set up the project on your local environment run the following
commands:

# Clone the project

git clone `<REPO_LINK>`{=html}

# Install dependencies

npm install

# Create local environment file

cp .env.example .env

# Start Postgres and Adminer

docker-compose up -d

# Start the API on localhost:3001

npm start

------------------------------------------------------------------------

# Database Seeding

The project uses two different types of seed data.

## Fixture Seed (default)

When running:

npm run reset-db

the database will be populated with a small deterministic fixture
dataset used for development and automated tests.

This dataset lives in the seed scripts and does not depend on Airtable.

------------------------------------------------------------------------

## Dataset Seed (versioned scenarios)

Full scenario datasets can be exported from Airtable and stored under:

seeds/datasets/`<scenario>`{=html}/`<revision>`{=html}/

Example:

seeds/datasets/cso/2026-03-03.1/

To load a dataset snapshot:

SEED_TAG=cso@2026-03-03.1 npm run reset-db:dataset

This will: 1. reset the database 2. apply migrations 3. load the
selected dataset snapshot

------------------------------------------------------------------------

# Scenario Import from Airtable

The application stores game data in PostgreSQL, but the source content
is maintained in Airtable.

To import the current Airtable data into the database:

POST /scenario/import

This endpoint:

1.  connects to Airtable
2.  reads the configured base
3.  loads the data into PostgreSQL

## Required Environment Variables

AIRTABLE_ACCESS_TOKEN AIRTABLE_BASE_ID IMPORT_PASSWORD

The request must include the configured IMPORT_PASSWORD.

This process updates the database only and does not create dataset
snapshots.

------------------------------------------------------------------------

# Dataset Export

To export a versioned dataset snapshot from Airtable into the
repository:

npm run snapshot:export

This writes a dataset to:

seeds/datasets/`<scenario>`{=html}/`<revision>`{=html}/

These snapshots can then be loaded later using the dataset seed system.

------------------------------------------------------------------------

# Basic Source Code Overview

For a more detailed explanation of the source code structure see the
wiki:

https://github.com/nditech/CyberSim-Backend/wiki

------------------------------------------------------------------------

# CyberSim Backend Deployment Guide

The CyberSim Game comprises two distinct applications:

-   Node.js backend API
-   React frontend UI

This guide covers deployment of the backend API.

Frontend deployment instructions are available here:

https://github.com/nditech/CyberSim-UI#readme

------------------------------------------------------------------------

# Environment Component Naming Convention

Environment component names follow the format:

`<ACCOUNT_ALIAS>`{=html}@`<COMPONENT_NAME>`{=html}

------------------------------------------------------------------------

# GitHub Repository

All local repository changes are pushed to branches in the GitHub
repository.

These changes are reviewed and merged into the master branch.

Repository:

https://github.com/nditech/CyberSim-Backend

------------------------------------------------------------------------

# CodePipeline

Example:

ndi@Cybersim-backend

A separate CodePipeline project is created for each production
environment.

The pipeline consists of two stages.

------------------------------------------------------------------------

## SOURCE

1.  Set the Source provider to GitHub (Version 2)
2.  Connect to repository:

nditech/CyberSim-Backend

3.  Branch name should be:

master

4.  Enable automatic builds on push.

------------------------------------------------------------------------

## BUILD

The build stage can be skipped.

------------------------------------------------------------------------

## DEPLOY

Deploy using:

AWS Elastic Beanstalk

Select the Cybersim application and environment.

------------------------------------------------------------------------

# Elastic Beanstalk

Example:

ndi@Cybersimgame-env

Each game instance runs in its own Elastic Beanstalk environment.

The Node application runs inside a Docker container defined by the
Dockerfile in the repository.

Once deployment completes, the API becomes live.

------------------------------------------------------------------------

## Environment Variables

Required variables:

PORT NODE_ENV DB_URL

Definitions:

PORT --- must match the port exposed by the container (currently 8080).

NODE_ENV --- production \| development \| test

DB_URL ---
postgres://`<USERNAME>`{=html}:`<PASSWORD>`{=html}@`<HOST>`{=html}:`<PORT>`{=html}/`<DB_NAME>`{=html}

Optional variables:

IMPORT_PASSWORD LOG_LEVEL

LOG_LEVEL values:

fatal \| error \| warn \| info \| debug \| trace

------------------------------------------------------------------------

# Airtable Handbook

## Purchased Mitigations

Mitigations are grouped by category in Airtable.

To adjust ordering:

1.  Open the purchase_mitigations table
2.  Group by category
3.  Reorder items within each category

This ordering is reflected in the application.

------------------------------------------------------------------------

## Locations

The game supports exactly two locations:

hq local

Do not modify the location_code values.

Changing these values will break application logic.

------------------------------------------------------------------------

## Dictionary

The dictionary table allows you to customize terminology such as
replacing the words "poll" or "budget".
