import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { SeasonLeaderboards } from "@/components/leaderboards";
import { SeasonAwardsShowcase } from "@/components/season-awards-showcase";
import type { SkaterLeader, GoalieLeader } from "@/lib/leaderboards-schema";

export const dynamic = "force-dynamic";

export default async function LeadersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ season: requestedSeason }, data] = await Promise.all([
    searchParams,
    getLeagueData(),
  ]);

  const selectedSeason =
    data.seasons.find((season) => season.id === requestedSeason) ??
    data.seasons[0];

  if (!selectedSeason) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">INDIVIDUAL STATISTICS</p>
            <h1>Player &amp; Goalie Leaders</h1>
            <p>{data.league.name}</p>
          </div>
          <Link className="button" href="/standings">
            Standings
          </Link>
        </div>
        <section className="panel empty">
          <h2>No season found.</h2>
          <p>
            {data.user
              ? "Create a season and record approved games in League HQ to populate leaderboards."
              : "Statistics will be posted once the season begins."}
          </p>
        </section>
      </>
    );
  }

  const { supabase } = await getLeagueContext();

  const [skatersRes, goaliesRes] = await Promise.all([
    supabase.rpc("get_season_skater_leaders", { target_season: selectedSeason.id }),
    supabase.rpc("get_season_goalie_leaders", { target_season: selectedSeason.id }),
  ]);

  const skaters: SkaterLeader[] =
    !skatersRes.error && Array.isArray(skatersRes.data)
      ? (skatersRes.data as SkaterLeader[])
      : [];

  const goalies: GoalieLeader[] =
    !goaliesRes.error && Array.isArray(goaliesRes.data)
      ? (goaliesRes.data as GoalieLeader[])
      : [];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INDIVIDUAL STATISTICS</p>
          <h1>Player &amp; Goalie Leaders</h1>
          <p>{data.league.name} · Official Season Statistics &amp; Awards</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href="/standings">
            ← Team Standings
          </Link>
          <Link className="button" href="/schedule">
            Schedules &amp; Scores
          </Link>
        </div>
      </div>

      <section className="panel">
        <form action="/leaders" method="get" className="filter-bar">
          <label>
            Season
            <select name="season" defaultValue={selectedSeason.id}>
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button primary">View Leaders</button>
        </form>
      </section>

      {/* Skater & Goalie Leaderboards */}
      <SeasonLeaderboards skaters={skaters} goalies={goalies} />

      {/* Season Honors & Trophies */}
      <SeasonAwardsShowcase seasonId={selectedSeason.id} />
    </>
  );
}
