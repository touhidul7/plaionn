import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLeagueContext } from "@/lib/supabase/session";
import { PlayerForm, RosterForm, EligibilityCard } from "@/components/roster-forms";
import { RosterCsvImportModal } from "@/components/roster-csv-import";
import { teamEligibilitySchema, type PlayerOption, type RosterRow } from "@/lib/roster-schema";

export const dynamic = "force-dynamic";

export default async function TeamRosterPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { supabase, league, canManage } = await getLeagueContext();
  const { entryId } = await params;
  if (!z.uuid().safeParse(entryId).success) notFound();

  const entry = await supabase
    .from("team_entries")
    .select("id,team_id,division_id")
    .eq("id", entryId)
    .eq("league_id", league.id)
    .maybeSingle();

  if (entry.error) throw new Error("Unable to load this team.");
  if (!entry.data) notFound();

  const team = await supabase
    .from("teams")
    .select("name")
    .eq("id", entry.data.team_id)
    .eq("league_id", league.id)
    .single();

  if (team.error) throw new Error("Unable to load this team.");

  const division = await supabase
    .from("divisions")
    .select("season_id,name")
    .eq("id", entry.data.division_id)
    .eq("league_id", league.id)
    .single();

  if (division.error) throw new Error("Unable to load this division.");

  const [roster, links, settings, eligibilityResult, billingSummary] = await Promise.all([
    supabase
      .from("roster_memberships")
      .select("id,player_id,jersey_number,position,status,revision")
      .eq("team_entry_id", entryId)
      .eq("league_id", league.id)
      .order("id")
      .returns<RosterRow[]>(),
    supabase.from("league_players").select("player_id").eq("league_id", league.id),
    supabase
      .from("season_settings")
      .select("roster_limit")
      .eq("season_id", division.data.season_id)
      .eq("league_id", league.id)
      .maybeSingle(),
    supabase.rpc("list_team_eligibility", { target_entry: entryId }),
    supabase.rpc("get_team_billing_summary", { target_entry: entryId }),
  ]);

  if (roster.error || links.error || settings.error || eligibilityResult.error) {
    return (
      <main id="main" className="public-portal-container">
        <section className="panel empty">
          <h1>Roster setup is pending.</h1>
          <p>Check that the roster and eligibility migrations have been applied before managing this team.</p>
          <Link href="/teams" className="button">
            Back to teams
          </Link>
        </section>
      </main>
    );
  }

  const eligibility = teamEligibilitySchema.safeParse(eligibilityResult.data);
  if (!eligibility.success) {
    return (
      <main id="main" className="public-portal-container">
        <section className="panel empty">
          <h1>Eligibility data unavailable.</h1>
          <p>The database returned an unexpected eligibility response. Contact your administrator.</p>
          <Link href="/teams" className="button">
            Back to teams
          </Link>
        </section>
      </main>
    );
  }

  const overrides = roster.data.length
    ? await supabase
        .from("player_eligibility_overrides")
        .select(
          "id,roster_membership_id,reason,granted_by,granted_at,revoked_by,revoked_at,revocation_reason"
        )
        .in(
          "roster_membership_id",
          roster.data.map((row) => row.id)
        )
        .eq("league_id", league.id)
        .order("granted_at", { ascending: false })
    : { data: [], error: null };

  if (overrides.error) {
    return (
      <section className="panel">
        <h1>Eligibility history unavailable.</h1>
        <p>Reload the page or contact your administrator.</p>
      </section>
    );
  }

  const playerIds = links.data.map((p) => p.player_id);
  const playerResult = playerIds.length
    ? await supabase
        .from("players")
        .select("id,display_name")
        .in("id", playerIds)
        .order("display_name")
        .returns<PlayerOption[]>()
    : { data: [] as PlayerOption[], error: null };

  if (playerResult.error) throw new Error("Unable to load the player list.");
  const players = playerResult.data!;
  const available = players.filter((p) => !roster.data.some((r) => r.player_id === p.id));
  const sorted = [...roster.data].sort(
    (a, b) => a.status.localeCompare(b.status) || (a.jersey_number ?? 100) - (b.jersey_number ?? 100)
  );
  const active = roster.data.filter((r) => r.status === "active").length;

  const billing = Array.isArray(billingSummary.data) && billingSummary.data.length
    ? billingSummary.data[0]
    : null;

  return (
    <main id="main" className="public-portal-container">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{division.data.name} · TEAM ROSTER</p>
          <h1>{team.data.name}</h1>
          <p>
            {active} active / {settings.data?.roster_limit ?? "not configured"} maximum ·{" "}
            {roster.data.length - active} inactive
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link className="button" href="/league/billing">
            League Billing
          </Link>
          <Link className="button" href="/teams">
            All teams
          </Link>
        </div>
      </div>

      {billing && billing.total_billed_cents > 0 && (
        <div className="panel" style={{ marginBottom: "20px" }}>
          <h2>Team Fee & Payment Status</h2>
          <div style={{ display: "flex", gap: "24px", marginTop: "12px", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Total Invoiced</span>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
                ${(Number(billing.total_billed_cents) / 100).toFixed(2)} {billing.currency}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Paid</span>
              <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px", color: "var(--lime)" }}>
                ${(Number(billing.total_paid_cents) / 100).toFixed(2)} {billing.currency}
              </p>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Outstanding Balance</span>
              <p
                style={{
                  margin: 0,
                  fontWeight: "bold",
                  fontSize: "18px",
                  color: Number(billing.balance_cents) > 0 ? "#ffd27a" : "var(--lime)",
                }}
              >
                ${(Number(billing.balance_cents) / 100).toFixed(2)} {billing.currency}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="notice">
        Eligibility requires an active roster slot, approved season registration, and acceptance of
        all current documents.
      </p>

      {!settings.data && (
        <p>
          <Link
            className="text-link"
            href={"/league/settings?season=" + division.data.season_id}
          >
            Set the season roster limit before activating players →
          </Link>
        </p>
      )}

      {/* 1. Public Verified Roster Table */}
      <section className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: "32px" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ fontSize: "16px", margin: 0 }}>Official Active Roster</h2>
        </div>
        {sorted.length ? (
          <table className="table" style={{ width: "100%", margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: "70px" }}>#</th>
                <th>Player Name</th>
                <th>Position</th>
                <th style={{ textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const pName = players.find((p) => p.id === r.player_id)?.display_name ?? "Player";
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: "var(--lime)" }}>
                      {r.jersey_number ? `#${r.jersey_number}` : "—"}
                    </td>
                    <td style={{ fontWeight: 800 }}>
                      <Link href={`/players/${r.player_id}`} className="text-link">
                        {pName}
                      </Link>
                    </td>
                    <td>{r.position ? r.position.toUpperCase() : "SKATER"}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="badge" style={{ fontSize: "10px" }}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
            No players assigned to this roster yet.
          </div>
        )}
      </section>

      {/* 2. Commissioner Management Controls (Only visible to managers) */}
      {canManage && (
        <>
          <RosterCsvImportModal
            entryId={entryId}
            existingRoster={roster.data.map((r) => ({
              jersey_number: r.jersey_number,
              status: r.status,
              display_name: players.find((p) => p.id === r.player_id)?.display_name ?? "Player",
            }))}
            rosterLimit={settings.data?.roster_limit ?? 25}
          />

          <div className="roster-create">
            <PlayerForm />
            <RosterForm
              key={available.map((p) => p.id).join(",")}
              entryId={entryId}
              players={available}
            />
          </div>

          <div className="section-heading">
            <h2>Manage Player Numbers &amp; Status</h2>
            <span>Deactivate players to retain their history</span>
          </div>

          {sorted.length ? (
            <div className="roster-list">
              {sorted.map((row) => (
                <RosterForm
                  key={row.id + ":" + row.revision}
                  entryId={entryId}
                  players={players}
                  row={row}
                />
              ))}
            </div>
          ) : null}

          <div className="section-heading">
            <h2>Game eligibility</h2>
            <span>Commissioner overrides require a reason and remain audited</span>
          </div>

          <div className="roster-list">
            {eligibility.data.map((row) => (
              <EligibilityCard key={row.roster_membership_id} entryId={entryId} eligibility={row} />
            ))}
          </div>

          {!!overrides.data.length && (
            <section className="panel">
              <h2>Eligibility override history</h2>
              {overrides.data.map((override) => (
                <div className="list-row" key={override.id}>
                  <strong>
                    {players.find(
                      (player) =>
                        player.id ===
                        roster.data.find((row) => row.id === override.roster_membership_id)?.player_id
                    )?.display_name ?? "Player"}
                  </strong>
                  <p>
                    Granted {override.granted_at} by {override.granted_by.slice(0, 8)}:{" "}
                    {override.reason}
                  </p>
                  {override.revoked_at && (
                    <p>
                      Revoked {override.revoked_at} by {override.revoked_by?.slice(0, 8)}:{" "}
                      {override.revocation_reason}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
