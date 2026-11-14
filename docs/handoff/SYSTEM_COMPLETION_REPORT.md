# PLAIONN Hockey Network: Complete Platform Delivery & Operations Guide

## 1. Executive Summary & Delivery Status
The PLAIONN Hockey Network digital operating platform has been built, hardened, verified, and packaged for production deployment. The system encompasses all four phases specified in the blueprint:
- **Phase 1: League OS MVP** — Multi-tenant league infrastructure, team rosters, conflict-free schedule generation, live scorekeeping, independent official review, and official tiebroken standings.
- **Phase 2: Engagement & Operational Expansion** — Player hub, tactical lineup boards, notification preferences with sleep-quiet hours, spare goalie dispatching, free agent placement, referee rate card payroll, and merchandise orders.
- **Phase 3: Licensed Video & Story Highlights** — Media streaming, multi-camera angles, automated event-derived highlight clips, and mobile-friendly vertical story reels.
- **Phase 4: Commercial & Network Expansion** — Cross-league power rankings, multi-league enterprise KPI rollups, tournament pool brackets, sponsor analytics, custom white-label branding, and multi-sport rule engines.

---

## 2. Platform Architecture & Route Map

### Core League & Public Portals
| Route | Capability | Primary Audience |
| --- | --- | --- |
| `/` | League overview, upcoming fixtures, hero stats, and sponsor showcase | Public / Fans |
| `/dashboard` | Player Hub: personal career stats, game RSVPs, dues balances, and waivers | Players |
| `/schedule` | Fixture schedule, rink availability, blackout management, and generator | All / Commissioners |
| `/schedule/[gameId]/live` | Real-time live scoreboard, Three Stars of the Game, and stream status | All / Fans |
| `/schedule/[gameId]/scorekeeping` | Rink-side scorekeeper console with offline sync and event logging | Timekeepers / Refs |
| `/schedule/[gameId]/lineup` | Tactical interactive lineup board (forward lines, defense, starter goalie) | Captains |
| `/schedule/[gameId]/rsvp` | Attendance RSVP board with goalie status and bench headcount | Players / Captains |
| `/standings` | Official season standings with tiebreakers (wins, head-to-head, GD) | All |
| `/leaders` | Skater scoring race (G, A, PTS, PIM) and goalie records (GAA, SV%, SO) | All |
| `/playoffs` | Live championship series tournament trees and game score updates | All |
| `/teams` | League team directory and rosters | All |
| `/teams/[entryId]` | Captain team roster management, player creation, and eligibility overrides | Captains / Commissioners |
| `/free-agents` | Unattached player discovery, team vacancies, and roster placement | Players / Captains |
| `/spares` | Emergency goalie discovery board and game-day sub call-up dispatching | Captains / Spares |
| `/tournaments` | Multi-pool tournament brackets and cross-league round-robin pools | All |
| `/rankings` | Network-wide team power ratings, ELO calculations, and skill tier filters | All |
| `/announcements` | League priority notices, emergency alerts, and team messages | All |

### Commissioner Governance Portals
| Route | Capability |
| --- | --- |
| `/league` | League HQ operational command center |
| `/league/settings` | Season configuration, roster limits, period lengths, and tiebreakers |
| `/league/registrations` | Player registration windows, review queue, and waiver versioning |
| `/league/billing` | Team and player invoicing, offline settlements, and payment ledgers |
| `/league/officials` | Official rate cards, assignment crew sheets, and payroll CSV exports |
| `/league/discipline` | Penalty incident log, suspension rules, and player appeal resolution |
| `/league/communications` | Broadcast messaging center, delivery logging, and quiet hours enforcement |
| `/league/crm` | Division waitlists, renewal campaigns, and player retention analytics |
| `/league/merchandise` | Uniform colors, custom nameplates, jersey sizes, and supplier ledger |
| `/league/archive` | Historical season records, past champions, and player identity matching |
| `/league/sponsors` | Sponsor banner placements, impression/click tracking, and campaign ROI |
| `/league/branding` | Custom league colors, vanity CNAME domain routing, and banner styling |
| `/league/governance` | Franchise owner delegation, manager roles, and granular permissions |
| `/league/migration` | Migration wizard for TeamSnap, Pointstreak, GoalLine, and LeagueApps CSVs |
| `/league/network` | Multi-league rollup reporting and executive KPI enterprise analytics |
| `/league/health` | Financial ledger invariant checks, unscored match alerts, and rate limits |

---

## 3. Security, Invariants & Compliance

1. **Financial Ledger Invariants:**
   - Every invoice enforces: `total_amount = paid_amount + remaining_balance`.
   - Overpayment beyond remaining balance is strictly rejected.
   - All settlements record immutable audit trails with transaction references.

2. **Game Result & Standings Integrity:**
   - Scoresheets require independent approval (submitters cannot self-approve).
   - Reopening an approved match requires a stated commissioner reason and automatically re-evaluates official standings.
   - Stat leaderboards strictly separate verified game sheet facts from advanced rink-side tracking.

3. **Data Privacy & GDPR/CCPA Compliance:**
   - Full personal data export in structured JSON format (`/account/privacy`).
   - 1-click revocation of filming, public profile, and marketing consents.
   - Right-to-be-forgotten personal redaction while preserving immutable match sheet history.

4. **Rate Limiting & Credential Protection:**
   - Sliding-window rate limiters guard registrations, document uploads, and data exports.
   - Security audit logger automatically scrubs API keys, tokens, and passwords from logs.

---

## 4. Production Deployment Checklist
- [x] Run automated test suite: `node --test web/tests/pilot-e2e-cycle.test.mjs`
- [x] Run security guardrail test: `node --test web/tests/security-guardrails.test.mjs`
- [x] Run projection rebuild test: `node --test web/tests/projection-rebuilds.test.mjs`
- [x] Compile Next.js production build: `npm --prefix web run build`
- [x] Verify mobile and desktop responsive navigation across all viewports.
