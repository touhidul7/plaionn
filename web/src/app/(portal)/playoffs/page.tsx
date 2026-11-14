import Link from "next/link";
import { getLeagueData } from "@/lib/league";
import { getLeagueContext } from "@/lib/supabase/session";
import { PlayoffBracketView } from "@/components/playoff-bracket";
import type { PlayoffTournamentDetails } from "@/lib/playoffs-schema";

export const dynamic = "force-dynamic";

export default async function PlayoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; division?: string }>;
}) {
  const [{ season: requestedSeason, division: requestedDivision }, data] =
    await Promise.all([searchParams, getLeagueData()]);

  const selectedSeason =
    data.seasons.find((s) => s.id === requestedSeason) ?? data.seasons[0];

  if (!selectedSeason) {
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">POSTSEASON</p>
            <h1>Playoff Brackets</h1>
            <p>{data.league.name}</p>
          </div>
          <Link className="button" href="/schedule">
            Schedule
          </Link>
        </div>
        <section className="panel empty">
          <h2>No season found.</h2>
          <p>
            {data.user
              ? "Create a season and divisions in League HQ to set up playoff brackets."
              : "Playoff brackets will be available once the season is announced."}
          </p>
        </section>
      </>
    );
  }

  const seasonDivisions = data.divisions.filter(
    (d) => d.season_id === selectedSeason.id
  );

  const selectedDivision =
    seasonDivisions.find((d) => d.id === requestedDivision) ?? seasonDivisions[0];

  const { supabase, canManage } = await getLeagueContext();

  let tournament: PlayoffTournamentDetails | null = null;

  if (selectedDivision) {
    const { data: bracketData, error } = await supabase.rpc(
      "get_division_playoff_bracket",
      { target_division: selectedDivision.id }
    );

    if (!error && bracketData && bracketData.length > 0) {
      tournament = bracketData[0] as PlayoffTournamentDetails;
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">POSTSEASON CHAMPIONSHIP</p>
          <h1>Playoff Tournament Brackets</h1>
          <p>{data.league.name} · Live Series &amp; Elimination Trees</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link className="button" href="/standings">
            Standings
          </Link>
          <Link className="button" href="/schedule">
            Schedule
          </Link>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: "24px" }}>
        <form action="/playoffs" method="get" className="filter-bar">
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

          {seasonDivisions.length > 0 && (
            <label>
              Division
              <select name="division" defaultValue={selectedDivision?.id}>
                {seasonDivisions.map((division) => (
                  <option key={division.id} value={division.id}>
                    {division.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button type="submit" className="button primary">View Bracket</button>
        </form>
      </section>

      {selectedDivision ? (
        <PlayoffBracketView
          tournament={tournament}
          divisions={seasonDivisions.map((d) => ({ id: d.id, name: d.name }))}
          canManage={canManage}
        />
      ) : (
        <section className="panel empty">
          <h2>No divisions in this season.</h2>
          <p>Add divisions in League HQ to generate playoff tournament brackets.</p>
        </section>
      )}
    </>
  );
}

