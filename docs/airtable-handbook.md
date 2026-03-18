# Airtable Handbook

## Overview

This handbook explains how CyberSim uses Airtable to manage scenario content, and how to connect, verify, and safely modify that content.

Airtable serves as the source of truth for scenario design, allowing non-developers to edit injections, responses, mitigations, and other game elements without changing code. The backend imports this content into PostgreSQL before each simulation run.

Because Airtable credentials and configuration are not immediately obvious in the UI, this guide also includes step-by-step instructions for:

* locating your Airtable Base ID
* creating a Personal Access Token (PAT)
* verifying that the backend can successfully connect to Airtable

If you are setting up a new scenario or debugging an import issue, start with the credential and verification sections before modifying content.

## Scenario Import

To import current Airtable data into the database:

    POST /scenario/import

This requires:

- AIRTABLE_ACCESS_TOKEN
- AIRTABLE_BASE_ID
- IMPORT_PASSWORD

## Finding Your Airtable Credentials

To connect Airtable to CyberSim, you need 

- AIRTABLE_BASE_ID (The unique identifier of the Airtable "base" or database/spreadsheet for the Cybersim)
- AIRTABLE_ACCESS_TOKEN (Personal Access Token / PAT)
- IMPORT_PASSWORD (manually configured in the app's environment)

These are not prominently exposed in Airtable’s UI, so to capture them follow the steps below.

### Finding the Base ID

#### Option A: From the URL

1. Open your Airtable base
2. Look at the URL:

    https://airtable.com/appXXXXXXXXXXXXXX/...

The part starting with `app` is your Base ID.

Example:

    AIRTABLE_BASE_ID=appUBqXDEAK06rYeC

#### Option B: From the API docs

1. Go to https://airtable.com/developers/web/api/introduction
2. Select your base
3. Look for URLs like:

    https://api.airtable.com/v0/appXXXXXXXXXXXXXX/TableName

The `appXXXXXXXXXXXXXX` portion is your Base ID.

#### Common confusion

- app... → Base ID (correct)
- tbl... → Table ID
- viw... → View ID

### Creating an Access Token (PAT)

CyberSim connects to Airtable using a Personal Access Token (PAT), which is a secure credential tied to your Airtable account. Unlike older API keys, PATs are scoped and limited, meaning you explicitly control what the token can access. This improves security and ensures that each scenario only has access to its own data.

#### Steps

1. Go to https://airtable.com/create/tokens
2. Click “Create new token”

#### Recommended configuration

**Name** - Give the token a descriptive name so you can recognize it later:

    CyberSim - <scenario name>

**Scopes** - define what actions the token is allowed to perform. Without the right scopes, the import process will fail.

For CyberSim, select:

– data.records:read → allows the backend to read scenario content
– (optional) schema.bases:read → allows reading table structure (useful for debugging)


**Access** - define which specific Airtable bases the token can interact with. If you do not add the base here, the token will not work.

- Choose “Specific bases”

- Click “Add a base”

Select your scenario base

This ensures the token can only access the intended scenario data.


#### Save the token

After creating the token, copy it and store it as:

    AIRTABLE_ACCESS_TOKEN=patXXXXXXXXXXXXXX

This token must be available to the CyberSim backend as an environment variable.
Environment variables are how the application securely receives secrets like API credentials without hardcoding them into the codebase.

* **Local development:** add it to your .env file in the backend project
* **Production (AWS Elastic Beanstalk):** add it under Configuration → Environment properties

⚠️ Do not commit tokens to GitHub or include them in shared files.

## Verifying Your Airtable Connection

Before running a full import, verify the connection.

### Backend health check

Start the backend and visit:

    http://localhost:3001/health/airtable

or:

    https://<your-api-host>/health/airtable

#### Expected success response

    {
      "ok": true,
      "baseId": "appXXXXXXXXXXXXXX",
      "tables": [...]
    }

#### Common errors

Missing variables:

    {
      "ok": false,
      "message": "Missing AIRTABLE_ACCESS_TOKEN or AIRTABLE_BASE_ID"
    }

401 error:

- Invalid token

403 error:

- Token lacks access to base

404 error:

- Incorrect Base ID

### Optional direct test

    curl https://api.airtable.com/v0/meta/bases/YOUR_BASE_ID/tables \
      -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

## Dataset Snapshots

To export a versioned dataset snapshot into the repository:

    npm run snapshot:export

Snapshots are stored under:

    seeds/datasets/<scenario>/<revision>/


Snapshots allow scenarios to be versioned and reproduced later.


## Airtable Content Rules

### Purchased Mitigations

Mitigations are grouped by category.

To adjust ordering:

1. Open the `purchase_mitigations` table.
2. Group by `category`.
3. Drag and reorder within each category.

The order in Airtable determines display order in the application.


### Locations

The application supports exactly two locations:

- `hq`
- `local`

⚠️ Do not modify the `location_code` values.  
Changing these will break application logic.

You may change display names without altering `location_code`.

### Dictionary

The dictionary table allows terminology customization (e.g., replacing "poll" or "budget").

To add or modify terminology:

- Edit the synonym column in the dictionary table.