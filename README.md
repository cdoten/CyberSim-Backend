# CyberSim Backend API

This repository contains the backend API for CyberSim, a tabletop
simulation platform designed to help organizations practice responding
to complex digital crises.

The backend manages game state, scenario data, database persistence, and
Airtable imports.

For a high-level overview of CyberSim, see the CyberSim UI repository:
https://github.com/`<ORG_OR_USER>`{=html}/CyberSim-UI

## Architecture

-   Runtime: Node.js
-   Framework: Express
-   Database: PostgreSQL
-   Query Builder: Knex
-   Containerized via Docker
-   Designed for AWS Elastic Beanstalk deployment

## Requirements

-   Node.js (v22 recommended)
-   Docker + Docker Compose (for local Postgres)
-   PostgreSQL (production)

## Local Development

### 1. Clone the repository

    git clone <REPO_LINK>
    cd CyberSim-Backend

### 2. Install dependencies

    npm install

### 3. Create local environment file

    cp .env.example .env

Adjust values in `.env` as needed.

### 4. Start local Postgres (Docker)

This project uses a custom Docker Compose file for development:

    docker compose -f docker-compose-dev.yaml up -d

To stop containers:

    docker compose -f docker-compose-dev.yaml down
    
### 5. Initialize database

Reset database (rollback → migrate → seed fixture data):

    npm run reset-db

### 6. Start the API

    npm start

API runs at:

http://localhost:3001

## Health Endpoints

-   `GET /health` -- Application status\
-   `GET /health/db` -- Database connectivity check\
-   `GET /health/airtable` -- Airtable configuration check

These endpoints are useful during deployment and infrastructure
validation.

## Database & Seeding

The project supports two types of seed data.

### Fixture Seed (Default)

    npm run reset-db

This will:

1.  Roll back migrations\
2.  Apply latest migrations\
3.  Load deterministic fixture data

Used for local development and automated tests.\
This dataset does not depend on Airtable.

### Dataset Snapshots (Versioned Scenarios)

Scenario datasets exported from Airtable can be stored under:

    seeds/datasets/<scenario>/<revision>/

Example:

    seeds/datasets/cso/2026-03-03.1/

Load a dataset snapshot:

    SEED_TAG=cso@2026-03-03.1 npm run reset-db:dataset

This will:

1.  Reset the database\
2.  Apply migrations\
3.  Load the selected dataset snapshot


### Export Dataset Snapshot from Database

To export a versioned dataset snapshot from the application database into the repository:

    npm run snapshot:export

This writes a dataset to:

    seeds/datasets/<scenario>/<revision>/

### Individual Database Commands

Apply latest migrations:
    npm run migrate

Roll back the most recent migration:
    npm run rollback

Run seed scripts:
    npm run seed

## Scenario Import from Airtable

The application stores game data in PostgreSQL, but source content is
maintained in Airtable.

To import current Airtable data into the database:

    POST /scenario/import

### Required Environment Variables

-   `AIRTABLE_ACCESS_TOKEN`
-   `AIRTABLE_BASE_ID`
-   `IMPORT_PASSWORD`

The request must include the configured `IMPORT_PASSWORD`.

This process updates the database but does not create versioned dataset
snapshots.

## Environment Variables

### Required (Production)

-   `PORT`
-   `NODE_ENV`
-   `DB_URL`

#### DB_URL format

    postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB_NAME>

#### NODE_ENV values

-   `production`
-   `development`
-   `test`

### Optional

-   `IMPORT_PASSWORD`
-   `LOG_LEVEL`

#### LOG_LEVEL options

-   `fatal`
-   `error`
-   `warn`
-   `info`
-   `debug`
-   `trace`

## Deployment (AWS Elastic Beanstalk)

The application runs inside a Docker container defined by the
`Dockerfile` in this repository.

Recommended Elastic Beanstalk settings:

-   Environment tier: Web server
-   Platform: Docker (Amazon Linux 2)
-   Preset: Single instance
-   Monitoring: Basic

### Required Environment Variables

-   `PORT` (must match container exposed port; currently `8080`)
-   `NODE_ENV=production`
-   `DB_URL=<connection_string>`

After deployment, validate:

-   `/health`
-   `/health/db`
-   `/health/airtable`

## Testing

Run automated tests:

    npm run test

## Project Structure

-   `/src` -- Application source code\
-   `/migrations` -- Database schema migrations\
-   `/seeds` -- Fixture data and dataset snapshots\
-   `/docker-compose.yml` -- Local Postgres configuration\
-   `/Dockerfile` -- Production container definition

## Troubleshooting

### Database connection issues

-   Verify `DB_URL`
-   Confirm Postgres is running locally (`docker-compose ps`)
-   Check security group rules in production

### Port mismatch on Elastic Beanstalk

Ensure:

-   Container exposes port `8080`
-   `PORT=8080` is set in EB environment variables

## Credits

CyberSim was originally developed by Rising Stack for the National
Democratic Institute (NDI), with support from Microsoft and the National Endowment 
for Democracy (NED), as part of broader efforts to strengthen civic resilience in the 
digital age. We are grateful for further support from the National Civic 
League and Aspen Institute.