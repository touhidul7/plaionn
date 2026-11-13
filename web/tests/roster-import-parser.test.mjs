import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRosterCsv, validateRosterBatch } from '../src/lib/roster-import.ts';

test('parseRosterCsv parses headers, trims whitespace, and maps common column names', () => {
  const csv = `
Player Name, Jersey Number, Pos
Connor McDavid, 97, C
Leon Draisaitl, 29, F
"Nurse, Darnell", 25, D
Stuart Skinner, 74, G
  `;

  const parsed = parseRosterCsv(csv);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].name, 'Connor McDavid');
  assert.equal(parsed[0].jersey, 97);
  assert.equal(parsed[0].position, 'C');

  assert.equal(parsed[2].name, 'Nurse, Darnell');
  assert.equal(parsed[2].jersey, 25);
  assert.equal(parsed[2].position, 'D');
});

test('validateRosterBatch detects batch duplicate jerseys and collisions with active roster', () => {
  const existingActiveRoster = [
    { jersey_number: 97, status: 'active', display_name: 'Existing McDavid' },
    { jersey_number: 29, status: 'inactive', display_name: 'Inactive Player' } // inactive jersey 29 is available!
  ];

  const parsedRows = [
    { name: 'Ryan Nugent-Hopkins', jersey: 93, position: 'C' }, // valid
    { name: 'Duplicate 1', jersey: 18, position: 'F' }, // batch dup
    { name: 'Duplicate 2', jersey: 18, position: 'D' }, // batch dup
    { name: 'Collides With Active', jersey: 97, position: 'F' }, // collides with McDavid
    { name: 'X', jersey: 5, position: 'D' }, // name too short
    { name: 'Valid Inactive Jersey Reuse', jersey: 29, position: 'LW' } // valid because existing 29 is inactive
  ];

  const validation = validateRosterBatch(parsedRows, existingActiveRoster, 10);
  assert.equal(validation.validRows.length, 2);
  assert.equal(validation.errorRows.length, 4);

  const errors = validation.errorRows.map(e => e.error);
  assert.ok(errors.some(e => e.includes('already taken by active roster player')));
  assert.ok(errors.some(e => e.includes('Duplicate jersey number 18 within CSV')));
  assert.ok(errors.some(e => e.includes('between 2 and 100 characters')));
});

test('validateRosterBatch rejects batch when total exceeds roster limit', () => {
  const existingActiveRoster = [
    { jersey_number: 1, status: 'active', display_name: 'Player 1' },
    { jersey_number: 2, status: 'active', display_name: 'Player 2' }
  ];
  // limit is 3, existing active is 2 -> only 1 slot remaining!
  const parsedRows = [
    { name: 'Player 3', jersey: 3, position: 'F' },
    { name: 'Player 4', jersey: 4, position: 'F' }
  ];

  const validation = validateRosterBatch(parsedRows, existingActiveRoster, 3);
  assert.equal(validation.canSubmit, false);
  assert.ok(validation.globalError?.includes('exceeds roster limit'));
});

