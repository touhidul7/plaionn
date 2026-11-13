import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

test('billing invoices enforce commissioner/finance access, audit payments, and balance calculations', async () => {
  const db = new PGlite();
  const league = id(10), commissioner = id(2), player = id(3);
  const season = id(4), division = id(5), team = id(6), entry = id(7);

  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);

    await db.exec(await readFile(new URL('../supabase/migrations/202610260001_league_foundation.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610270001_season_settings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610280001_rosters.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202610310002_registration.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/202611160002_billing_and_invoices.sql', import.meta.url), 'utf8'));

    await db.query('insert into auth.users(id) values($1),($2)', [commissioner, player]);
    await db.query("insert into leagues(id, name) values($1, 'Billing Test League')", [league]);
    await db.query("insert into league_memberships values($1, $2, 'commissioner'), ($1, $3, 'player')", [league, commissioner, player]);
    await db.query("insert into seasons(id, league_id, name) values($1, $2, '2026-2027 Season')", [season, league]);
    await db.query("insert into divisions(id, league_id, season_id, name) values($1, $2, $3, 'Div 1')", [division, league, season]);
    await db.query("insert into teams(id, league_id, name) values($1, $2, 'Blizzards')", [team, league]);
    await db.query("insert into team_entries(id, league_id, team_id, division_id) values($1, $2, $3, $4)", [entry, league, team, division]);

    await db.exec('set role authenticated');
    const as = user => db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);

    // 1. Player cannot create invoice
    await as(player);
    await assert.rejects(
      db.query("select create_team_invoice($1, 'Team Registration Fee', 100000, null)", [entry]),
      e => e.code === '42501'
    );

    // 2. Commissioner creates invoice for $1,000.00 CAD (100,000 cents)
    await as(commissioner);
    const invoiceRes = await db.query(
      "select create_team_invoice($1, 'Team Registration Fee', 100000, '2026-12-01'::date) as id",
      [entry]
    );
    const invoiceId = invoiceRes.rows[0].id;
    assert.ok(invoiceId);

    // Verify invoice fields
    const inv = (await db.query("select * from league_invoices where id = $1", [invoiceId])).rows[0];
    assert.equal(inv.amount_cents, 100000);
    assert.equal(inv.amount_paid_cents, 0);
    assert.equal(inv.status, 'issued');

    // 3. Record partial payment of $400.00 (40,000 cents) via e-Transfer
    const pay1 = await db.query(
      "select record_invoice_payment($1, 40000, 'etransfer', 'ETR-99881', 'Deposit received') as rev",
      [invoiceId]
    );
    assert.equal(pay1.rows[0].rev, 2);

    const invAfterPay1 = (await db.query("select * from league_invoices where id = $1", [invoiceId])).rows[0];
    assert.equal(invAfterPay1.amount_paid_cents, 40000);
    assert.equal(invAfterPay1.status, 'partially_paid');

    // 4. Overpayment check: attempting to pay 70,000 cents when 60,000 is left must fail
    await assert.rejects(
      db.query("select record_invoice_payment($1, 70000, 'cash', '', 'Excess payment')", [invoiceId]),
      e => e.code === '22023'
    );

    // 5. Record remaining payment of $600.00 (60,000 cents)
    const pay2 = await db.query(
      "select record_invoice_payment($1, 60000, 'cash', 'RECEIPT-01', 'Final balance cash at rink') as rev",
      [invoiceId]
    );
    assert.equal(pay2.rows[0].rev, 3);

    const invAfterPay2 = (await db.query("select * from league_invoices where id = $1", [invoiceId])).rows[0];
    assert.equal(invAfterPay2.amount_paid_cents, 100000);
    assert.equal(invAfterPay2.status, 'paid');

    // 6. Paid invoice cannot accept further payments
    await assert.rejects(
      db.query("select record_invoice_payment($1, 1000, 'cash', '', 'Extra')", [invoiceId]),
      e => e.code === 'P0001'
    );

    // 7. Verify team billing summary
    await as(player); // League members can check billing summary
    const summary = (await db.query("select * from get_team_billing_summary($1)", [entry])).rows[0];
    assert.equal(Number(summary.total_billed_cents), 100000);
    assert.equal(Number(summary.total_paid_cents), 100000);
    assert.equal(Number(summary.balance_cents), 0);
    assert.equal(Number(summary.invoice_count), 1);

    // 8. Anonymous access rejected
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query("select * from league_invoices"), e => e.code === '42501');
    await assert.rejects(db.query("select * from get_team_billing_summary($1)", [entry]), e => e.code === '42501');

  } finally {
    await db.close();
  }
});
