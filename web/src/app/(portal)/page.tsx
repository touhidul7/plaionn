import Link from "next/link";
import { getLeagueData } from "@/lib/league";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getLeagueData();

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR LEAGUE STARTS HERE</p>
          <h1>Every game. Every moment.</h1>
          <p>One home for your league, your teams, and the hockey ahead.</p>
        </div>
        {data.user ? (
          <Link className="button primary" href="/league">
            Set up your league ↗
          </Link>
        ) : (
          <Link className="button primary" href="/schedule">
            View Schedule ↗
          </Link>
        )}
      </div>

      <section className="hero">
        <span className="badge">{data.league.name.toUpperCase()}</span>
        <h2>Every game. Every moment.</h2>
        <p>Follow live games, verified team rosters, schedule updates, and official standings.</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <Link className="button" href="/schedule">
            Game Schedule →
          </Link>
          <Link className="button" href="/standings">
            Standings Table →
          </Link>
          {data.user ? (
            <Link className="button" href="/league">
              League HQ →
            </Link>
          ) : (
            <Link className="button" href="/login">
              Sign In →
            </Link>
          )}
        </div>
        <div className="rink" aria-hidden="true" />
      </section>

      <div className="metrics">
        {[
          [data.seasons.length, "Seasons", "Created in League HQ"],
          [data.divisions.length, "Divisions", "Your competition groups"],
          [data.teams.length, "Teams", "Ready for roster setup"],
          ["Supabase", "Database", "Persistent records"],
        ].map(([value, label, caption]) => (
          <article key={label} className="panel">
            <p>{label}</p>
            <strong>{value}</strong>
            <span>{caption}</span>
          </article>
        ))}
      </div>

      <div className="section-heading">
        <h2>From the rink</h2>
        <span>Building your hockey home</span>
      </div>

      <div className="cards">
        <article className="panel">
          <p className="eyebrow">LEAGUE OPERATIONS</p>
          <h2>A season, organized.</h2>
          <p>Create your competition structure and keep your teams in one place.</p>
          <Link className="text-link" href="/league">
            Manage league →
          </Link>
        </article>

        <article className="panel">
          <p className="eyebrow">YOUR CLUBS</p>
          <h2>Bring teams together.</h2>
          <p>See the clubs registered in your league.</p>
          <Link className="text-link" href="/teams">
            View teams →
          </Link>
        </article>

        <article className="panel">
          <p className="eyebrow">GAME DAY</p>
          <h2>Room for every matchup.</h2>
          <p>Schedule matchups, assign officials, and record provisional goals and penalties.</p>
          <Link className="text-link" href="/schedule">
            View schedule →
          </Link>
        </article>
      </div>
    </>
  );
}
