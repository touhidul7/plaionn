# PLAIONN Sports Network — User Roles & Permissions Matrix

This document defines the 6 official user roles and their exact operational permissions across the PLAIONN platform.
A ready-to-import CSV version is available at [users_and_permissions.csv](file:///d:/Development/Plionn/docs/users_and_permissions.csv).

---

## 1. Role Definitions

| Role | Scope | Description |
| :--- | :--- | :--- |
| **Super Admin** | Platform-Wide | Full root control over the entire platform, all leagues, infrastructure, global settings, and user account creation/deletion. |
| **Regular Admin** | Platform-Wide | Operational oversight across the entire platform and all leagues, multi-league rollups, and system monitoring. |
| **League Admin (Commissioner)** | League-Scoped | Full administrative governance over their specific league: seasons, divisions, teams, schedules, payments, waivers, and discipline. |
| **Team Admin / Manager (Captain)** | Team-Scoped | Manages their specific team: active roster, jersey numbers, tactical line assignments, attendance RSVPs, and team fee obligations. |
| **Player** | Personal-Scoped | Registers for seasons, signs electronic waivers, views personal career stats, submits attendance RSVPs, and manages privacy consents. |
| **Timekeeper / Referee** | Game-Scoped | Accesses the rink-side scorekeeping console, logs goals/penalties/stints, and submits/approves verified game sheets. |

---

## 2. Granular Permissions Breakdown

| Capability / Action | Super Admin | Regular Admin | League Admin | Team Admin | Player | Timekeeper |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Platform & League Management** | | | | | | |
| Create & Delete User Accounts | **✓** | ✕ | ✕ | ✕ | ✕ | ✕ |
| Create New Leagues & Assign Commissioners | **✓** | **✓** | ✕ | ✕ | ✕ | ✕ |
| Cross-League Enterprise Analytics & Rollups | **✓** | **✓** | ✕ | ✕ | ✕ | ✕ |
| White-Label Domain & Branding Customization | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| View System Health & Ledger Invariant Audits | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| **League Operations & Scheduling** | | | | | | |
| Configure Season Settings & Tiebreakers | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Define Arenas, Rinks & Ice Inventory | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Input Team Blackout Dates | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Generate & Publish Draft Schedules | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Post Season Postponements & Urgent Notices | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Post Team Locker Room Announcements | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Generate Playoff Elimination Brackets | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| **Rosters & Registration** | | | | | | |
| Publish Season Registration Windows | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Upload & Version Legal Waivers (GoHighLevel) | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Review & Approve Player Applications | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Create Team Rosters & Set Active Status | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Bulk Import Rosters via CSV | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Grant Season Eligibility Overrides | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Register as Free Agent or Spare Goalie | **✓** | **✓** | **✓** | **✓** | **✓** | ✕ |
| Dispatch Game-Day Spare Call-Up Requests | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| **Matchday & Game Scoring** | | | | | | |
| Build Tactical Lineups (Forward & Defense Lines) | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Submit Game Attendance RSVP | **✓** | **✓** | **✓** | **✓** | **✓** | ✕ |
| Rink-Side Live Scorekeeping (Goals & Penalties) | **✓** | **✓** | **✓** | ✕ | ✕ | **✓** |
| Offline Scorekeeping with Auto-Sync | **✓** | **✓** | **✓** | ✕ | ✕ | **✓** |
| Void Erroneous Game Events (with Stated Reason) | **✓** | **✓** | **✓** | ✕ | ✕ | **✓** |
| Submit Official Final Game Sheet | **✓** | **✓** | **✓** | ✕ | ✕ | **✓** |
| Independent Referee Scoresheet Approval | **✓** | **✓** | **✓** | ✕ | ✕ | **✓ (Referee)** |
| Reopen Approved Match with Stated Reason | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Award Official Three Stars of the Game | **✓** | **✓** | **✓** | ✕ | ✕ | **✓** |
| **Financials & Invoicing** | | | | | | |
| Create League & Team Invoices | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Select Payment Model (Individual, Offline, Manager) | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Record Offline Payments (e-Transfer, Cheque, Cash) | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| View Team Billing Summary & Ledger Balances | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Pay Team Fees on Behalf of Team | **✓** | **✓** | **✓** | **✓ (Own Team)** | ✕ | ✕ |
| Pay Individual Registration Fee Online | **✓** | **✓** | **✓** | **✓** | **✓** | ✕ |
| Export Officials Payroll Accounting CSV | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| **Discipline & Governance** | | | | | | |
| Log Infractions & Major Penalty Suspensions | **✓** | **✓** | **✓** | ✕ | ✕ | **✓ (Report)** |
| Submit Written Suspension Appeal | ✕ | ✕ | ✕ | **✓** | **✓** | ✕ |
| Adjudicate & Rule on Suspension Appeals | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Appoint Auxiliary Commissioners & Referees by Email | **✓** | **✓** | **✓** | ✕ | ✕ | ✕ |
| Export Personal GDPR/CCPA Data Archive (JSON) | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| Revoke Marketing, Filming, or Public Consents | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
