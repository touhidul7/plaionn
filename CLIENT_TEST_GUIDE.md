# PLAIONN Hockey — Client Walkthrough & Verification Guide

This guide takes you step-by-step through testing the PLAIONN platform using either the pre-seeded **Client Demo League** or by creating your own league.

---

## 1. Getting Started & Sign In

### For Guests, Fans & Prospective Players (No Account Required)
- Open `http://127.0.0.1:3000/` (or your deployed URL).
- Explore the **Home** page, live **Game Schedule** (`/schedule`), official **Standings Table** (`/standings`), and **Team Directory** (`/teams`).
- Fans and players can view published fixtures, venue locations, game scores, and standings without having to create an account or sign in.

### For League Commissioners, Referees & Staff
1. Open the application at `http://127.0.0.1:3000/login`.
2. Enter your email and password.
   - If you are signing in for the first time, click **"New here? Create an account"**.
   - Supabase will create your account and immediately redirect you to **My Account** (`/account`).
3. On the **My Account** screen, you will see two clear options:
   - **Option A — Explore Client Demo League:** Click **"Open Demo League as Commissioner →"** to immediately open the pre-configured league (*Premier division*, *Northline HC* vs *Harbour Wolves*, seeded rosters, and scheduled match).
   - **Option B — Create your league:** Enter your own league name (e.g. *Metro Adult Hockey League*) and click **"Create league →"** to start fresh as the commissioner.

---

## 2. Interactive Step-by-Step Walkthrough

| Step | Area | What to Try | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **0** | **Public Fan Experience** | Open `/schedule` or `/standings` in an incognito window without signing in. | Public fixtures, scores, venues, and standings are visible immediately with clean fan navigation and a "Sign in" shortcut. |
| **1** | **League HQ** | Visit `/league`. Review your seasons, divisions, and teams. As commissioner, you can create new seasons, divisions, or teams. | Data updates and persists to Supabase. Teams appear in the competition structure. |
| **2** | **Season Settings** | Click **"Season settings"** in League HQ. Configure period length, clock mode (stop/run), standings points (Win, Tie, Overtime Loss), roster limits, and tiebreaker criteria. | Settings are saved with strict revision protection and audit history. |
| **3** | **Team Rosters** | Visit `/teams` and click **"Manage roster →"** on any team. Add players with jersey numbers and positions (`F`, `D`, `G`). Toggle players between active and inactive. | Inactive players retain historical records. Duplicate active jersey numbers are prevented. |
| **4** | **Player Eligibility** | On the team roster screen, inspect the **Game eligibility** panel. Players need an active roster slot and approved registration. | The system shows eligibility status. Commissioners can grant or revoke audited exceptions with a documented reason. |
| **5** | **Game Scheduling** | Visit `/schedule`. View upcoming fixtures. Commissioners can add venues, rinks, define ice slot inventory, and generate draft schedules. | Conflicting rink bookings, minimum rest times, and blackout dates are validated. Fixtures stay as drafts until explicitly published. |
| **6** | **Live Scorekeeping** | On any scheduled game in `/schedule`, click **"Scorekeeping"** (or `/schedule/[gameId]/scorekeeping`). Record goals, assists, and penalties with period and clock times. | Provisional scores update in real time. Voiding an event requires a recorded reason and recalculates the score without destroying audit history. |
| **7** | **Live Scoreboard & Game Center** | In a separate tab or device, open `/schedule/[gameId]/live`. | The live scoreboard polls every 3 seconds, showing period, score, and live event feed for league members and fans. |
| **8** | **Game Result Approval & Standings** | When the game concludes, the timekeeper clicks **"Submit official final result"**. In a separate account (or as commissioner), review the game sheet and click **"Approve game result"**. Then visit `/standings`. | The game result is permanently locked and verified. The official standings table (`/standings`) immediately recalculates rank, GP, W, L, T, OTL, GF, GA, GD, and PTS based on your league rules. |
| **9** | **Billing & Invoicing** | Visit `/league/billing`. Create team invoices (e.g. registration fees), record offline payments (e-Transfer, Cash, Cheque) with transaction references, and view team fee summaries. | Invoices calculate remaining balances. Overpayment beyond the outstanding balance is automatically blocked. All payment transactions are audited. |
| **10** | **Game Attendance & Player RSVP** | On any scheduled game in `/schedule`, click **"RSVP"** (or `/schedule/[gameId]/rsvp`). Players or captains select availability (Attending, Tentative, Out) and optional notes. | Headcount chips immediately update showing confirmed skaters, goalies (with alert if zero goalies confirmed), and tentative roster counts. |
| **11** | **Rink Mode (Offline Scorekeeping)** | On `/schedule/[gameId]/scorekeeping`, toggle your browser offline (or disconnect Wi-Fi) and log game events. | The system switches to "🟠 Rink Mode (Offline)", safely queuing events locally in browser storage. Upon reconnecting, events are automatically synced to the server without duplicate event IDs. |
| **12** | **Player Scoring Race & Goalie Stats** | Visit `/standings` to view both the Team Standings and the new **Skater Scoring Race** & **Goaltending Leaders** leaderboards. | Top skaters are ranked by Points (Goals + Assists) with PIM, and goaltenders are ranked by GAA and Shutouts computed from approved game sheets. |
| **13** | **Bulk Roster Import from CSV** | On `/teams/[entryId]`, click **"Bulk Import Roster from CSV"**. Upload a `.csv` file or click **"Paste Sample CSV"**. Review the real-time preview table with green validity chips and error reasons, then click **"Confirm & Import"**. | Roster players are validated against the season limit and existing active jersey numbers, created in the league, and assigned to the active team roster in one atomic transaction. |
| **14** | **Playoff Tournament Brackets** | Visit `/playoffs` (or click **🏆 Playoffs** in navigation). As commissioner, generate a 2, 4, or 8-team single elimination or best-of-3 bracket seeded directly from regular season standings. Update series scores and declare series winners. | The bracket tree automatically maps seeds (#1 vs #4, #2 vs #3) and advances series winners into subsequent rounds and the Championship Final. |
| **15** | **Discipline & Suspensions** | Visit `/league/discipline` (via League HQ). Review the **Official Disciplinary Ledger**. As commissioner, record major infractions and suspensions. As player, submit an appeal statement. As commissioner, review and uphold, reduce, or overturn the suspension. | Suspended players are dynamically flagged across the system (`is_player_suspended`), rendering them ineligible for game rosters until their suspension is served or overturned. |
| **16** | **Spare & Emergency Goalie Pool** | Visit `/spares` (or click **🥅 Spares** in navigation). Filter by position (Goalies, Defense, Forwards). As a player, register availability and skill level. As commissioner or captain, dispatch game day call-up requests with temporary jersey numbers. As the spare, accept or decline the call-up. | Available substitutes and emergency goalies are instantly discoverable. Suspended players are blocked from receiving call-ups. Accepted call-ups appear on the game day roster. |
| **17** | **League Announcements & Broadcasts** | Visit `/announcements` (or click **📢 Notices** in navigation). As commissioner, broadcast urgent weather alerts, rink delays, or team-scoped locker room notices. Configure priorities (`urgent`, `important`, `standard`) and auto-expiration timers. | Urgent broadcasts pin to the top with pulsing alerts. Locker room notices are scoped directly to the designated team. All active announcements are visible to fans and players. |
| **18** | **Tactical Lineup Board** | On any scheduled game in `/schedule`, click **"Lineup"** (or `/schedule/[gameId]/lineup`). As captain, drag and drop players into forward lines (F1, F2, F3), defensive pairings (D1, D2, D3), and starting/backup goaltenders. | Lineups reflect player availability from RSVPs, warn if suspended or ineligible players are selected, and persist for official matchday rosters. |
| **19** | **Player Hub Dashboard** | Visit `/dashboard` (or click **👤 Player Hub** in navigation). View your personal career statistics (G, A, PTS, PIM), upcoming match cards with 1-click RSVP buttons, active team rosters, outstanding dues balances, and signed league documents. | Unified personal view combines everything relevant to the signed-in player across all teams and leagues. |
| **20** | **Privacy, Data Export & Consent** | Visit `/account/privacy` (via Account menu). Click **"Download JSON Archive"** to export all personal records. Revoke optional filming or marketing consents, or request account anonymization. | Structured personal data is exported cleanly; revocations are instantly saved while preserving immutable game sheet history. |
| **21** | **System Health & Ledger Audits** | Visit `/league/health` (via League HQ). Review real-time diagnostic cards for Financial Ledger Invariants (`total = paid + balance`), scoresheet review alerts, dispatch queue health, and recent security audit trails. | The system proves 100% ledger invariant health with zero unassigned funds or overpayment anomalies. |
| **22** | **Mobile Navigation Experience** | Open the application on a mobile device (or toggle responsive mobile mode in browser dev tools). | Enjoy a sleek 5-item bottom tab bar (Home, Schedule, Standings, Notices, More) with an accessible slide-up menu sheet for all additional league destinations. |

---

## 3. Database Migrations

The project includes SQL migrations executed in the Supabase project:
1. `202611160001_onboarding_and_demo_access.sql`: Self-service league creation and 1-click commissioner demo access.
2. `202611160002_billing_and_invoices.sql`: Team & player invoices, payment logging, and balance tracking.
3. `202611160003_public_fan_access.sql`: Public guest access for schedules, standings, game center, and league overview without requiring sign-in.
4. `202611160004_game_attendance_rsvp.sql`: Game attendance, player RSVPs, headcount tracking, and goalie availability alerts.
5. `202611160005_player_and_goalie_stats.sql`: Season player scoring race & goaltending leaderboards computed from approved game events.
6. `202611160006_bulk_roster_import.sql`: Bulk roster import from CSV with duplicate checks, position validation, and limit guards.
7. `202611160007_playoff_brackets.sql`: Standings-seeded tournament brackets, single elimination & best-of-3 series trees, and automated winner advancement.
8. `202611160008_discipline_and_suspensions.sql`: Disciplinary incidents, misconduct suspensions, player eligibility enforcement, player appeals, and commissioner rulings.
9. `202611160009_spare_goalie_callups.sql`: Spare player & goalie pool discovery, game day call-up requests, and player responses.
10. `202611160010_announcements_and_messaging.sql`: Priority broadcasts (urgent/important/standard), team locker room notices, expiration timers, and public feeds.
11. `202611160011` through `202611160038`: Advanced Phase 2-4 features, video highlight packages, cross-league rankings, enterprise KPI rollups, multi-sport engines, system health diagnostics, sliding-window rate limits, and dispatch queue monitoring.

---

## 4. Reporting Feedback

If you encounter any unexpected behavior during testing, please note:
1. The page URL.
2. The user account role you were signed in with.
3. What you clicked and what message or screen was shown.
