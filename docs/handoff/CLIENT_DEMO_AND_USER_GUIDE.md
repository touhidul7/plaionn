# PLAIONN Hockey Network — Complete Client Demonstration & User Guide

Welcome to the **PLAIONN Hockey Network**. This guide provides an executive walkthrough of every core section of the platform: what each module does, how to use it in daily operations, and how to test it during demonstration.

---

## 1. Public Fan & Community Experience

### A. League Homepage & Schedule (`/` and `/schedule`)
* **How it works:** Provides fans, families, and players with an immediate overview of upcoming fixtures, past scores, division standings, and announcements without requiring a login.
* **How to use it:** Visitors can filter matches by season, division, or specific team, and click any matchup to view the live scoreboard and venue directions.
* **How to test it:** Open `/schedule` in an incognito window. Verify you can view all fixtures, filter by division, and check venue rink locations without signing in.

### B. Live Game Center (`/schedule/[gameId]/live`)
* **How it works:** Real-time game tracking console showing current period, running score, goal/penalty timeline, and the official Three Stars of the Game.
* **How to use it:** Fans follow the match live from their phone or computer. The page automatically updates with live events.
* **How to test it:** Open a scheduled match on your phone while scoring events on another screen. Watch goals and penalties appear within seconds.

### C. Official Season Standings & Leaderboards (`/standings` and `/leaders`)
* **How it works:** Automatically calculates standings points and ranks teams using your league's official tiebreaker criteria (Wins, Head-to-Head, Goal Differential). Also displays individual Skater Scoring Races (Goals, Assists, Points, Penalty Minutes) and Goaltender Records (Goals Against Average, Shutouts).
* **How to use it:** Review regular season rankings, playoff seeding cutoffs, and individual scoring races.
* **How to test it:** View `/standings` and `/leaders`. Notice that statistics are derived strictly from officially approved games.

---

## 2. Player Experience

### A. Unified Player Hub (`/dashboard`)
* **How it works:** A single personal command center for registered players. Shows personal career statistics, upcoming game cards with 1-click RSVP buttons, active team rosters, outstanding dues balances, and signed league documents.
* **How to use it:** Players check their next game time, mark their attendance, and check if they owe any registration fees.
* **How to test it:** Sign in as a player and visit `/dashboard`. Click **"Attending"** on an upcoming game card and verify your response updates instantly.

### B. Personal Privacy & Data Export (`/account/privacy`)
* **How it works:** Full personal privacy control center. Allows players to download a complete copy of their records, manage filming and marketing permissions, or request account anonymization.
* **How to use it:** Go to Account → Privacy & Data Control. Click **"Download JSON Archive"** or toggle marketing consents.
* **How to test it:** Click **"Download JSON Archive"** to receive an immediate file download containing your profile, match history, and document acceptances.

### C. Notification Preferences (`/account/notifications`)
* **How it works:** Enables players to choose how they receive league alerts (SMS, Push notifications, Email) with automatic sleep quiet hours (22:00 to 08:00).
* **How to use it:** Toggle delivery channels on or off according to personal preference.
* **How to test it:** Change notification channels and save; preferences are instantly applied across all league broadcasts.

---

## 3. Team Captain Experience

### A. Team Roster Management (`/teams/[entryId]`)
* **How it works:** Captains manage their active roster, assign uniform jersey numbers, set player positions (Forward, Defense, Goalie), and review player fee contributions.
* **How to use it:** Add new players, set active/inactive status, or upload a complete roster via CSV.
* **How to test it:** Visit your team page and click **"Bulk Import Roster from CSV"**. Click **"Paste Sample CSV"** and confirm; the entire roster will be created and assigned in one step.

### B. Tactical Lineup Board (`/schedule/[gameId]/lineup`)
* **How it works:** Interactive drag-and-drop tactical whiteboard allowing captains to assemble forward lines (F1, F2, F3), defensive pairings (D1, D2, D3), and starting goaltenders.
* **How to use it:** Drag confirmed players into their line positions before game time.
* **How to test it:** Visit any upcoming game, click **"Lineup"**, and assign players to lines. Notice that players who RSVP'd "Attending" are highlighted for quick selection.

### C. Attendance & Goalie Alert (`/schedule/[gameId]/rsvp`)
* **How it works:** Real-time headcount monitor displaying confirmed skaters and goaltenders. Displays an automatic red alert banner if zero goaltenders have confirmed attendance.
* **How to use it:** Captains monitor bench depth leading up to game night to know if emergency spare call-ups are required.
* **How to test it:** On a scheduled fixture, click **"RSVP"**. Switch goaltender attendance to "Out" and verify the emergency goalie warning appears immediately.

---

## 4. Game Officials Experience (Referees & Timekeepers)

### A. Rink-Side Scorekeeping Console (`/schedule/[gameId]/scorekeeping`)
* **How it works:** Tablet-optimized scorekeeping console designed for off-ice timekeepers. Features large touch buttons to log goals, primary/secondary assists, penalties, and period times.
* **How to use it:** Select the scoring team, choose the goal scorer and assist from dropdowns, and tap **"Record Goal"**.
* **How to test it:** Open `/schedule/[gameId]/scorekeeping`. Log a goal with a primary assist and verify the provisional score counter increments.

### B. Rink Mode (Offline Synchronization)
* **How it works:** Ensures zero data loss even if the ice arena loses internet connectivity. Events are stored securely in browser memory and automatically synchronized to the cloud once connectivity resumes.
* **How to use it:** Operates completely automatically. When offline, an orange **"Rink Mode"** badge appears.
* **How to test it:** Disconnect your internet connection (or toggle Offline mode in browser developer tools). Continue entering a goal. Reconnect the internet; notice the event queue synchronizes automatically without duplicating records.

### C. Independent Game Sheet Review & Approval
* **How it works:** Enforces fair governance by requiring two separate eyes on every scoresheet: timekeepers submit the completed game sheet, and a referee or commissioner performs final review and approval.
* **How to use it:** After final buzzer, tap **"Submit official final result"**. As referee, review the event ledger and tap **"Approve game result"**.
* **How to test it:** Submit a game sheet as timekeeper, then switch to a referee account to approve it. Notice that the official standings immediately update upon approval.

---

## 5. League Commissioner Experience

### A. League HQ & Season Setup (`/league` and `/league/settings`)
* **How it works:** Central administrative command center for creating seasons, divisions, teams, and venues. Configure rules such as period lengths, stop/run clock, point values (Win, Tie, Overtime Loss), and tiebreaker priority orders.
* **How to use it:** Set up new competition brackets, configure roster capacity limits, and set season registration opening/closing dates.
* **How to test it:** In `/league/settings`, update your points per win from 2 to 3 and save. Standings immediately reflect the new scoring formula.

### B. Automated Fair Schedule Generator (`/schedule`)
* **How it works:** Intelligent scheduling engine that generates balanced round-robin fixtures while respecting arena ice time availability, team blackout dates, rest intervals, and preferred game nights.
* **How to use it:** Enter arena ice slot blocks, input blackout dates requested by teams, and click **"Generate draft schedule"**. Review draft fixtures before publishing.
* **How to test it:** Add a team blackout date for Friday night. Generate a draft schedule and verify the system never schedules that team on their blackout date.

### C. Fee Invoicing & Ledger Settlements (`/league/billing`)
* **How it works:** Financial management dashboard for issuing team or individual invoices, tracking online card settlements, and recording offline payments (e-Transfers, cheques, cash).
* **How to use it:** Issue a registration invoice to a team. When payment is received, record the transaction reference and amount.
* **How to test it:** Create a team invoice for $1,200. Record an offline payment of $500. Verify the remaining balance updates to $700, and verify that attempting to record an overpayment beyond $700 is automatically blocked.

### D. Emergency Goalie & Spare Player Marketplace (`/spares`)
* **How it works:** Community substitute pool allowing unattached players and goalies to register their availability. Captains and commissioners can dispatch urgent call-up requests with temporary jersey numbers.
* **How to use it:** When a team is missing a goalie, visit `/spares`, find an available netminder, and tap **"Request Call-Up"**.
* **How to test it:** Submit a spare availability profile, then send a call-up request from a team entry. Confirm the request and verify the spare appears on the matchday roster.

### E. Free Agent Discovery & Open Team Tryouts (`/free-agents`)
* **How it works:** Connects prospective players seeking teams with captains looking to fill open roster spots. Players register by skill level, and captains post open tryout positions.
* **How to use it:** Browse candidate players and click **"Add to Team"** to automatically place them on the active roster.
* **How to test it:** Create a free agent profile, submit an application to a team vacancy, and approve the placement as commissioner.

### F. Priority League Announcements (`/announcements`)
* **How it works:** Multi-channel broadcast tool for publishing urgent weather cancellations, rink delays, or team-scoped locker room notices with automatic expiration timers.
* **How to use it:** Compose an alert, select priority level (**Urgent**, **Important**, **Standard**), and publish. Urgent alerts pulse at the top of every screen.
* **How to test it:** Create an urgent alert with a 24-hour expiration. Open the public homepage and notice the highlighted alert banner at the top of the screen.

### G. Playoff Tournament Brackets (`/playoffs`)
* **How it works:** Automated postseason championship trees seeded directly from regular season standings. Supports single-elimination and best-of-3 series with automatic winner advancement.
* **How to use it:** Click **"Generate Bracket"** to create a 2, 4, or 8-team tournament seeded #1 vs #4, #2 vs #3. Record series game scores to advance winners into the Championship Final.
* **How to test it:** View `/playoffs`. Update the series score for the semifinal round and watch the winning team automatically advance to the Championship round.

### H. Disciplinary Incident Ledger & Appeals (`/league/discipline`)
* **How it works:** Transparent governance center for tracking major penalties, automatic game suspensions, player written appeals, and commissioner rulings.
* **How to use it:** Log a misconduct infraction with suspension duration. The system automatically locks the player from game rosters until the suspension is resolved.
* **How to test it:** Record a suspension for a player. Attempt to add them to a game lineup; verify the system blocks them with an ineligibility alert.

### I. System Health & Financial Invariant Diagnostics (`/league/health`)
* **How it works:** Real-time operational diagnostic center. Continuously validates that all financial collections equal payments plus remaining balances, checks for unscored match sheets, monitors message dispatch queues, and reviews security rate limit events.
* **How to use it:** Review the diagnostic cards to confirm zero accounting anomalies across your league.
* **How to test it:** Open `/league/health`. Verify all diagnostic indicators report green with 100% accounting ledger balance.

---

## 6. Modern Mobile Experience
* **How it works:** When accessed on a smartphone or mobile browser, the interface transforms into a sleek native mobile application.
* **Bottom Tab Bar:** 5 quick-access tabs:
  1. **Home:** Daily fixtures and scores.
  2. **Schedule:** Filterable competition calendar.
  3. **Standings:** Division ranking tables.
  4. **Notices:** Urgent league announcements.
  5. **More:** Opens the slide-up navigation sheet.
* **Slide-Up Menu Sheet:** Smooth animated menu providing 1-tap access to all secondary destinations (Player Hub, League HQ, Leaders, Rankings, Playoffs, Teams, Spares, and Account).
* **How to test it:** Resize your desktop browser window to mobile width (or open on your phone). Tap each bottom tab and explore the slide-up "More" menu sheet.
