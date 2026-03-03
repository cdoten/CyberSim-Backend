// migrations/20260303000100_cleanup_legacy_columns.js

exports.up = async (knex) => {
  // --- MITIGATION: remove legacy split-cost columns ---
  const mitigationHasHqCost = await knex.schema.hasColumn(
    'mitigation',
    'hq_cost',
  );
  const mitigationHasLocalCost = await knex.schema.hasColumn(
    'mitigation',
    'local_cost',
  );

  if (mitigationHasHqCost || mitigationHasLocalCost) {
    await knex.schema.alterTable('mitigation', (tbl) => {
      if (mitigationHasHqCost) {
        tbl.dropColumn('hq_cost');
      }
      if (mitigationHasLocalCost) {
        tbl.dropColumn('local_cost');
      }
    });
  }

  // --- RESPONSE: remove unused legacy columns ---
  const responseHasLocation = await knex.schema.hasColumn(
    'response',
    'location',
  );
  const responseHasMitigationType = await knex.schema.hasColumn(
    'response',
    'mitigation_type',
  );

  if (responseHasLocation || responseHasMitigationType) {
    await knex.schema.alterTable('response', (tbl) => {
      if (responseHasLocation) {
        tbl.dropColumn('location');
      }
      if (responseHasMitigationType) {
        tbl.dropColumn('mitigation_type');
      }
    });
  }

  // --- INJECTION: remove unused legacy column ---
  const injectionHasSkipperMitigationType = await knex.schema.hasColumn(
    'injection',
    'skipper_mitigation_type',
  );

  if (injectionHasSkipperMitigationType) {
    await knex.schema.alterTable('injection', (tbl) => {
      tbl.dropColumn('skipper_mitigation_type');
    });
  }
};

exports.down = async (knex) => {
  // Re-add columns as nullable (for reversibility)

  const mitigationHasHqCost = await knex.schema.hasColumn(
    'mitigation',
    'hq_cost',
  );
  const mitigationHasLocalCost = await knex.schema.hasColumn(
    'mitigation',
    'local_cost',
  );

  if (!mitigationHasHqCost || !mitigationHasLocalCost) {
    await knex.schema.alterTable('mitigation', (tbl) => {
      if (!mitigationHasHqCost) {
        tbl.integer('hq_cost');
      }
      if (!mitigationHasLocalCost) {
        tbl.integer('local_cost');
      }
    });
  }

  const responseHasLocation = await knex.schema.hasColumn(
    'response',
    'location',
  );
  const responseHasMitigationType = await knex.schema.hasColumn(
    'response',
    'mitigation_type',
  );

  if (!responseHasLocation || !responseHasMitigationType) {
    await knex.schema.alterTable('response', (tbl) => {
      if (!responseHasLocation) {
        tbl.text('location');
      }
      if (!responseHasMitigationType) {
        tbl.text('mitigation_type');
      }
    });
  }

  const injectionHasSkipperMitigationType = await knex.schema.hasColumn(
    'injection',
    'skipper_mitigation_type',
  );

  if (!injectionHasSkipperMitigationType) {
    await knex.schema.alterTable('injection', (tbl) => {
      tbl.text('skipper_mitigation_type');
    });
  }
};
