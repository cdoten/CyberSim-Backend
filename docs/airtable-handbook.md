# Airtable Handbook

This document describes how to safely modify scenario content in Airtable for use in CyberSim.

The backend stores game data in PostgreSQL, but source content is maintained in Airtable.

## Scenario Import

To import current Airtable data into the database:

    POST /scenario/import


This requires:

- `AIRTABLE_ACCESS_TOKEN`
- `AIRTABLE_BASE_ID`
- `IMPORT_PASSWORD`

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