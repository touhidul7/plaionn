# PLAIONN real-data workflow test

The app reads and writes records in the Supabase project configured for this deployment. The existing **PLAIONN Client Demo** league is seed data, not a local mock and not real league data. Its records persist in that project. Keep it separate; do not rename, overwrite, or delete it to make room for a real league.

Before entering actual participant information, confirm with the project owner that this Supabase project is the intended authorized test environment. The latest hosted schema check (2026-11-09, before schedule inventory, result approval, and ice contracts) found Auth reachable and 23/26 then-expected private tables. The local scheduler, game-results, and ice-contract migrations expand the checker to 34 tables. Verify migration history before applying anything; hosted workflow and production data are not verified.

After the league-provisioning migration is applied, an existing commissioner can create a separate league from **My account**. Create and verify that league before removing **PLAIONN Client Demo**; do not enter real records into the demo tenant.

Gather the real league name, season/division/team names, approved roster data, venue/time zone, schedule, registration dates, current league-approved PDF documents, and separate test accounts for each role. Do not send passwords or Supabase secrets in a roster file or chat. Enter real data through the application or provide an authorized, sanitized import file. No demo records are automatically converted or imported.

## Suggested real-data walkthrough

| Area | What to try | Expected result |
| --- | --- | --- |
| League setup | Sign in as the commissioner and create the real season, division, and teams in League HQ; enter the agreed rules and registration window in Season settings. | Records persist after refresh in the selected Supabase project. Fees are configuration only; no charge is made. |
| Roster | Add real players and their agreed positions/jersey numbers to each team; mark a test player inactive and reactivate them. | Inactive records retain history; duplicate active jersey numbers are rejected. |
| Documents | Upload only the league-approved current waiver and any required conduct PDF. | Documents are private and versioned; acceptance is bound to the exact version and hash. |
| Registration | In a private browser, use a separate player test account to apply, accept current documents, type the signer name, and choose each optional consent. | The application is pending; typed-name acceptance and consent history are recorded separately. |
| Review and placement | As commissioner, review the application and evidence, approve it with a reason, then add the player to the correct team roster. | Approval creates league membership but does not automatically add the player to a team or make them game-eligible. |
| Eligibility | Verify the roster's eligibility reason. A player needs active roster status, approved registration, and acceptance of all current required documents. Use an override only for a documented exception and record the reason. | Eligible status is checked by the database when scoring; grants and revocations remain in audit history. |
| Schedule and officials | Enter real rink slots for each division; mark required versus optional, classify early/prime/late, add team blackouts and preferred weeknights, then generate drafts. Review the matchup/slot list and publish only after checking it. Assign accounts with the required official roles. | Conflicting slots, blackouts, weekly limits and minimum-rest rules are enforced. Generated fixtures are hidden drafts until explicit publish. The optimizer is heuristic; detailed workbook fairness dashboards and purchased-ice cost/utilization tracking are not included yet. Role memberships must be provisioned before assignment. |
| Scorekeeping and corrections | As an assigned timekeeper, record an event; as a referee/commissioner, void a test event with a reason. | Only eligible players can be scored (unless an active documented override exists); voided events remain in history and no longer affect the provisional score. |
| Mobile | Repeat a roster or schedule step on the target phone/browser. | Navigation and forms remain usable; wide tables scroll sideways. |

Use separate, authorized test accounts for commissioner, player, timekeeper, and referee roles. The current commissioner can create and manage league records. Official roles require membership provisioning before assignment; do not share accounts to simulate role boundaries.

Scores are provisional; this app does not yet approve final results or calculate official standings. Automatic live updates, offline scoring, payments/refunds, consent withdrawal, profile claiming, and video highlights remain incomplete. Typed-name records are not a statement of legal validity. Do not use this workflow for charging real money.

To report feedback, send the page, what you tried, what you expected, and a screenshot if useful.
