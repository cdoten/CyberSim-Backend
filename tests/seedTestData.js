// tests/seedTestData.js
module.exports = async function seedTestData(db) {
  // IMPORTANT: delete in FK-safe order if you keep deletes here.
  // If you're already calling resetAllTables(), you can omit these del() calls.

  // INJECTIONS
  await db('injection').insert([
    {
      id: 'I1',
      title: 'Injection 1',
      description: 'Injection 1',
      trigger_time: 120000,
      location: 'local',
      type: 'Table',
      recipient_role: 'LB role',
      asset_code: '1',
      poll_change: -0.5,
      systems_to_disable: ['S1'],
      skipper_mitigation: 'M1',
      recommendations: 'Placeholder recommendation 1',
      followup_injection: 'I2',
    },
    {
      id: 'I2',
      title: 'Injection 2',
      description: 'Injection 2',
      trigger_time: 240000,
      location: 'hq',
      type: 'Table',
      recipient_role: 'Hq role',
      asset_code: '2',
      poll_change: -0.5,
      systems_to_disable: [],
      skipper_mitigation: null,
      recommendations: 'Placeholder recommendation 2',
    },
    {
      id: 'I3',
      title: 'Injection 3',
      description: 'Injection 3',
      trigger_time: 340000,
      location: 'hq',
      type: 'Table',
      recipient_role: 'Hq role',
      asset_code: '3',
      poll_change: null,
      systems_to_disable: [],
      skipper_mitigation: 'M2',
      recommendations: 'Placeholder recommendation 3',
    },
  ]);

  // MITIGATIONS
  await db('mitigation').insert([
    {
      id: 'M1',
      description: 'Mitigation 1',
      category: 'Operation',
      cost: 1000,

      // legacy columns if they still exist in schema
      is_hq: true,
      is_local: true,
      hq_cost: 500,
      local_cost: 1000,
    },
    {
      id: 'M2',
      description: 'Mitigation 2',
      category: 'Operation',
      cost: 1200,

      is_hq: false,
      is_local: true,
      hq_cost: null,
      local_cost: 1200,
    },
  ]);

  // RESPONSES
  await db('response').insert([
    {
      id: 'RP1',
      description: 'Change office lock at LB',
      cost: 0,
      location: 'local',
      mitigation_type: null,
      mitigation_id: null,
      systems_to_restore: ['S2'],
      required_mitigation: 'M1',
      required_mitigation_type: 'local',
    },
    {
      id: 'RP2',
      description: 'Change office lock at LB',
      cost: 0,
      location: 'local',
      mitigation_type: 'local',
      mitigation_id: 'M2',
      systems_to_restore: [],
      required_mitigation: null,
      required_mitigation_type: null,
    },
  ]);

  // SYSTEMS
  await db('system').insert([
    { id: 'S1', name: 'Party website', description: '', type: 'party' },
    { id: 'S2', name: 'DB', description: '', type: 'hq' },
  ]);

  // INJECTION_RESPONSE (join table)
  await db('injection_response').insert([
    { response_id: 'RP1', injection_id: 'I1' },
    { response_id: 'RP2', injection_id: 'I2' },
  ]);

  // ROLES
  await db('role').insert([
    { id: 'R1', name: 'Candidate 1' },
    { id: 'R2', name: 'Candidate 2' },
  ]);

  // ACTIONS
  await db('action').insert([
    {
      id: 'A1',
      description: 'Hold national campaign rally',
      type: 'hq',
      cost: 1000,
      budget_increase: 0,
      poll_increase: 5,
      required_systems: ['S1', 'S2'],
    },
    {
      id: 'A2',
      description: 'Hold national campaign rally',
      type: 'local',
      cost: 1000,
      budget_increase: 0,
      poll_increase: 5,
      required_systems: [],
    },
  ]);

  // ACTION_ROLE (join table)
  await db('action_role').insert([
    { action_id: 'A1', role_id: 'R1' },
    { action_id: 'A1', role_id: 'R2' },
    { action_id: 'A2', role_id: 'R2' },
  ]);

  // CURVEBALLS
  await db('curveball').insert([
    {
      id: 'C4',
      description: 'Disaster',
      budget_change: -1000,
      poll_change: -10,
    },
    { id: 'C7', description: 'Miracle', budget_change: 1500, poll_change: 10 },
    { id: 'C8', description: 'Oh My God', lose_all_budget: true },
  ]);
};
