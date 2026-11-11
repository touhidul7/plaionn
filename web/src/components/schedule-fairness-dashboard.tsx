import {buildScheduleFairness,type ScheduleAuditInput} from "@/lib/schedule-fairness";

function metric(value:number){return value.toLocaleString("en-CA");}

export function ScheduleFairnessDashboard({input}:{input:ScheduleAuditInput}){
 const divisions=buildScheduleFairness(input);
 return <section aria-labelledby="schedule-audit-title">
  <div className="section-heading"><h2 id="schedule-audit-title">Schedule fairness and validation</h2><span>Calculated from this league&apos;s saved schedule and ice inventory</span></div>
  {divisions.length?divisions.map(division=><details className="panel schedule-audit" key={division.divisionId} open>
   <summary><strong>{division.seasonName} · {division.divisionName}</strong><span>{division.gameCount} games · {division.warnings.filter(item=>item.severity==="error").length} errors · {division.warnings.filter(item=>item.severity==="warning").length} warnings</span></summary>
   <div className="metrics audit-metrics">
    <article className="panel"><p>Games scheduled</p><strong>{metric(division.gameCount)}</strong><span>{division.teams.length} teams</span></article>
    <article className="panel"><p>Required ice used</p><strong>{metric(division.usedRequiredSlots)} / {metric(division.requiredSlots)}</strong><span>{division.usedSlots} of {division.totalSlots} total slots booked</span></article>
    <article className="panel"><p>Home / away spread</p><strong>{metric(division.homeAwaySpread)}</strong><span>Maximum difference per team</span></article>
    <article className="panel"><p>Weekly load spread</p><strong>{metric(division.weeklyLoadSpread)}</strong><span>Games per team in each week</span></article>
    <article className="panel"><p>Time-tier spread</p><strong>{metric(division.tierSpread)}</strong><span>Games per team and tier</span></article>
    <article className="panel"><p>Arena spread</p><strong>{metric(division.arenaSpread)}</strong><span>Games per team and arena</span></article>
   </div>
   <div className="section-heading"><h3>Team summary</h3></div>
   {division.teams.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Team</th><th scope="col">GP</th><th scope="col">Home</th><th scope="col">Away</th><th scope="col">H–A</th>{division.tiers.map(tier=><th scope="col" key={tier}>{tier==="unclassified"?"No tier":tier}</th>)}{division.arenas.map(arena=><th scope="col" key={arena.id}>{arena.name}</th>)}</tr></thead><tbody>{division.teams.map(team=><tr key={team.entryId}><td><strong>{team.label}</strong></td><td>{team.games}</td><td>{team.home}</td><td>{team.away}</td><td>{team.homeAway>0?"+":""}{team.homeAway}</td>{division.tiers.map(tier=><td key={tier}>{team.tiers[tier]}</td>)}{division.arenas.map(arena=><td key={arena.id}>{team.arenas[arena.id]??0}</td>)}</tr>)}</tbody></table></div>:<p className="empty">Add teams to this division to see the schedule balance.</p>}
   <div className="section-heading"><h3>Opponent matrix</h3><span>Each cell is games played</span></div>
   {division.teams.length>1?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Team</th>{division.teams.map(team=><th scope="col" key={team.entryId}>{team.label}</th>)}</tr></thead><tbody>{division.teams.map((team,row)=><tr key={team.entryId}><th scope="row">{team.label}</th>{division.teams.map((opponent,column)=><td key={opponent.entryId}>{row===column?"—":division.opponentMatrix[row]?.[column]??0}</td>)}</tr>)}</tbody></table></div>:<p>Add at least two teams to compare opponents.</p>}
   <div className="section-heading"><h3>Weekly team load</h3></div>
   {division.weeks.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Week of</th>{division.teams.map(team=><th scope="col" key={team.entryId}>{team.label}</th>)}</tr></thead><tbody>{division.weeks.map(week=><tr key={week}><th scope="row">{week}</th>{division.teams.map(team=><td key={team.entryId}>{team.weekly[week]??0}</td>)}</tr>)}</tbody></table></div>:<p>No games to compare by week.</p>}
   <div className="section-heading"><h3>Validation</h3><span>{division.warnings.length?`${division.warnings.length} item${division.warnings.length===1?"":"s"} to review`:"No schedule issues found"}</span></div>
   {division.warnings.length?<ul className="audit-warnings">{division.warnings.map((warning,index)=><li className={"audit-"+warning.severity} key={warning.severity+warning.message+index}><strong>{warning.severity.toUpperCase()}</strong> {warning.message}</li>)}</ul>:<p className="notice" role="status">No visible schedule issues found{input.canValidateBlackouts?".":"; team-blackout checks are visible to commissioners only."}</p>}
   {division.gamesOnNonPreferredWeekdays!==null&&<p className="field-help">Preferred-night check: {division.preferredWeekdayGames} game(s) on a preferred weekday; {division.gamesOnNonPreferredWeekdays} on other days. This is a soft preference, not a blocking rule.</p>}
  </details>):<p className="panel empty">Create a division to see its schedule analysis.</p>}
  <p className="field-help">Fairness spreads are descriptive comparisons, not proof of an optimal schedule. Draft games are included only when your league permissions allow them to be read.</p>
 </section>;
}
