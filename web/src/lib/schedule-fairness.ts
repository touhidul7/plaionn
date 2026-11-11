import {Temporal} from "@js-temporal/polyfill";

export type AuditEntry={id:string;teamId:string;divisionId:string;label:string};
export type AuditVenue={id:string;name:string;time_zone:string};
export type AuditRink={id:string;name:string;venue_id:string};
export type AuditGame={
 id:string;home_entry_id:string;away_entry_id:string;rink_id:string;starts_at:string;ends_at:string;
 status:"draft"|"scheduled"|"cancelled";ice_slot_id:string|null;generated_schedule:boolean;
};
export type AuditSlot={
 id:string;division_id:string;rink_id:string;starts_at:string;ends_at:string;local_date:string;
 time_tier:"early"|"prime"|"late";is_required:boolean;
};
export type AuditRule={
 division_id:string;start_date:string;end_date:string;round_robins:number;max_games_per_week:number;
 min_rest_hours:number;preferred_weekdays:number[];
};
export type AuditBlackout={division_id:string;team_entry_id:string;blackout_date:string};
type AuditTier="early"|"prime"|"late"|"unclassified";
export type ScheduleAuditInput={
 entries:AuditEntry[];
 divisions:{id:string;name:string;season_name:string}[];
 venues:AuditVenue[];
 rinks:AuditRink[];
 games:AuditGame[];
 slots:AuditSlot[];
 rules:AuditRule[];
 blackouts:AuditBlackout[];
 canValidateBlackouts:boolean;
};
export type AuditWarning={severity:"error"|"warning"|"info";message:string};
export type TeamFairnessRow={
 entryId:string;label:string;games:number;home:number;away:number;homeAway:number;
 tiers:Record<AuditTier,number>;
 arenas:Record<string,number>;weekly:Record<string,number>;
};
export type DivisionScheduleAudit={
 divisionId:string;divisionName:string;seasonName:string;gameCount:number;requiredSlots:number;usedRequiredSlots:number;
 totalSlots:number;usedSlots:number;homeAwaySpread:number;tierSpread:number;arenaSpread:number;weeklyLoadSpread:number;
 tiers:("early"|"prime"|"late"|"unclassified")[];arenas:{id:string;name:string}[];
 weeks:string[];teams:TeamFairnessRow[];opponentMatrix:number[][];warnings:AuditWarning[];
 preferredWeekdayGames:number;gamesOnNonPreferredWeekdays:number|null;
};

const spread=(values:number[])=>values.length?Math.max(...values)-Math.min(...values):0;
const weekStart=(date:string)=>Temporal.PlainDate.from(date).subtract({days:Temporal.PlainDate.from(date).dayOfWeek-1}).toString();
const overlaps=(a:AuditGame,b:AuditGame)=>Date.parse(a.starts_at)<Date.parse(b.ends_at)&&Date.parse(a.ends_at)>Date.parse(b.starts_at);

export function buildScheduleFairness(input:ScheduleAuditInput):DivisionScheduleAudit[]{
 const entriesById=new Map(input.entries.map(entry=>[entry.id,entry]));
 const venues=new Map(input.venues.map(venue=>[venue.id,venue]));
 const rinks=new Map(input.rinks.map(rink=>[rink.id,rink]));
 const slotsById=new Map(input.slots.map(slot=>[slot.id,slot]));
 const rulesByDivision=new Map(input.rules.map(rule=>[rule.division_id,rule]));
 const blackouts=new Set(input.blackouts.map(item=>`${item.division_id}:${item.team_entry_id}:${item.blackout_date}`));
 return input.divisions.map(division=>{
  const teams=input.entries.filter(entry=>entry.divisionId===division.id);
  const teamIndex=new Map(teams.map((team,index)=>[team.id,index]));
  const divisionSlots=input.slots.filter(slot=>slot.division_id===division.id);
  const rule=rulesByDivision.get(division.id);
  const games=input.games.filter(game=>{
   const home=entriesById.get(game.home_entry_id);
   return game.status!=="cancelled"&&home?.divisionId===division.id;
  });
  const warnings:AuditWarning[]=[];
  const addWarning=(severity:AuditWarning["severity"],message:string)=>warnings.push({severity,message});
  const venueIds=[...new Set([
   ...divisionSlots.map(slot=>rinks.get(slot.rink_id)?.venue_id),
   ...games.map(game=>rinks.get(game.rink_id)?.venue_id),
  ].filter((id):id is string=>Boolean(id)))];
  for(const game of games){
   const home=entriesById.get(game.home_entry_id),away=entriesById.get(game.away_entry_id);
   if(!home||!away||home.divisionId!==division.id||away.divisionId!==division.id){
    addWarning("error",`Game ${game.id} has a missing team or crosses division boundaries.`);
   }
   if(!rinks.has(game.rink_id)) addWarning("error",`Game ${game.id} references a rink that is not available.`);
   else if(!venues.has(rinks.get(game.rink_id)!.venue_id)) addWarning("error",`Game ${game.id} references a venue that is not available.`);
   if(!game.ice_slot_id) addWarning("info",`Game ${game.id} is not linked to an ice-inventory slot.`);
   else{
    const slot=slotsById.get(game.ice_slot_id);
    if(!slot||slot.division_id!==division.id||slot.rink_id!==game.rink_id
     ||Date.parse(slot.starts_at)!==Date.parse(game.starts_at)||Date.parse(slot.ends_at)!==Date.parse(game.ends_at)){
     addWarning("error",`Game ${game.id} does not match its assigned ice-inventory slot.`);
    }
   }
  }
  const rows=teams.map(team=>({
   entryId:team.id,label:team.label,games:0,home:0,away:0,homeAway:0,
   tiers:{early:0,prime:0,late:0,unclassified:0} as Record<AuditTier,number>,
   arenas:Object.fromEntries(venueIds.map(id=>[id,0])) as Record<string,number>,
   weekly:{} as Record<string,number>,
  }));
  const matrix=teams.map(()=>teams.map(()=>0));
  const gamesByTeam=new Map(teams.map(team=>[team.id,[] as AuditGame[]]));
  const weeksSet=new Set<string>();
  const tierGames=new Map<string,number>();
  const gameDates=new Map<string,string>();
  let preferredWeekdayGames=0;
  let gamesOnNonPreferredWeekdays=0;
  let requiredSlots=0,usedRequiredSlots=0,usedSlots=0;
  for(const game of games){
   const homeIndex=teamIndex.get(game.home_entry_id),awayIndex=teamIndex.get(game.away_entry_id);
   if(homeIndex===undefined||awayIndex===undefined) continue;
   const home=rows[homeIndex],away=rows[awayIndex];
   if(!home||!away) continue;
   home.games++;home.home++;away.games++;away.away++;
   matrix[homeIndex]![awayIndex]!++;matrix[awayIndex]![homeIndex]!++;
   gamesByTeam.get(home.entryId)!.push(game);
   gamesByTeam.get(away.entryId)!.push(game);
   const rink=rinks.get(game.rink_id),venue=rink?venues.get(rink.venue_id):undefined;
   if(!rink||!venue) continue;
   const localDate=Temporal.Instant.from(game.starts_at).toZonedDateTimeISO(venue.time_zone).toPlainDate();
   gameDates.set(game.id,localDate.toString());
   const week=weekStart(localDate.toString());
   weeksSet.add(week);
   for(const team of [home,away]) team.weekly[week]=(team.weekly[week]??0)+1;
   const candidate=game.ice_slot_id?slotsById.get(game.ice_slot_id):undefined;
   const slot=candidate&&candidate.division_id===division.id&&candidate.rink_id===game.rink_id
    &&Date.parse(candidate.starts_at)===Date.parse(game.starts_at)&&Date.parse(candidate.ends_at)===Date.parse(game.ends_at)?candidate:undefined;
   const tier=slot?.time_tier??"unclassified";
   home.tiers[tier as AuditTier]++;away.tiers[tier as AuditTier]++;
   tierGames.set(tier,(tierGames.get(tier)??0)+1);
   const arenaId=rink.venue_id;
   home.arenas[arenaId]=(home.arenas[arenaId]??0)+1;
   away.arenas[arenaId]=(away.arenas[arenaId]??0)+1;
   if(rule?.preferred_weekdays.length){
    if(rule.preferred_weekdays.includes(localDate.dayOfWeek)) preferredWeekdayGames++;
    else gamesOnNonPreferredWeekdays++;
   }
   if(input.canValidateBlackouts){
    for(const entry of [home.entryId,away.entryId]){
     if(blackouts.has(`${division.id}:${entry}:${localDate.toString()}`)){
      addWarning("error",`${entriesById.get(entry)?.label??"A team"} has a game on its blackout date ${localDate.toString()}.`);
     }
    }
   }
  }
  const weeks=[...weeksSet].sort();
  for(const slot of divisionSlots){
   if(slot.is_required&&(!rule||(slot.local_date>=rule.start_date&&slot.local_date<=rule.end_date))){
    requiredSlots++;
    if(games.some(game=>game.ice_slot_id===slot.id&&game.rink_id===slot.rink_id
     &&Date.parse(game.starts_at)===Date.parse(slot.starts_at)&&Date.parse(game.ends_at)===Date.parse(slot.ends_at))) usedRequiredSlots++;
   }
   if(games.some(game=>game.ice_slot_id===slot.id&&game.rink_id===slot.rink_id
    &&Date.parse(game.starts_at)===Date.parse(slot.starts_at)&&Date.parse(game.ends_at)===Date.parse(slot.ends_at))) usedSlots++;
  }
  if(requiredSlots>usedRequiredSlots) addWarning("error",`${requiredSlots-usedRequiredSlots} required ice slot${requiredSlots-usedRequiredSlots===1?" is":"s are"} unused.`);
  if(!divisionSlots.length&&teams.length) addWarning("info","No ice inventory exists for this division yet.");
  if(rule){
   const plannedWeeks=new Set(games.flatMap(game=>{
    const date=gameDates.get(game.id);
    return date&&date>=rule.start_date&&date<=rule.end_date?[weekStart(date)]:[];
   }));
   for(const team of teams){
    const row=rows[teamIndex.get(team.id)!]!;
    for(const [week,count] of Object.entries(row.weekly)){
     if(plannedWeeks.has(week)&&count>rule.max_games_per_week) addWarning("error",`${team.label} has ${count} games in the week of ${week}; limit is ${rule.max_games_per_week}.`);
    }
    const sorted=[...(gamesByTeam.get(team.id)??[])].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    for(let i=1;i<sorted.length;i++){
     const previous=sorted[i-1]!,current=sorted[i]!;
     const previousDate=gameDates.get(previous.id),currentDate=gameDates.get(current.id);
     const withinPlan=(date:string|undefined)=>Boolean(date&&date>=rule.start_date&&date<=rule.end_date);
     if(!withinPlan(previousDate)&&!withinPlan(currentDate)) continue;
     const hours=(Date.parse(current.starts_at)-Date.parse(previous.ends_at))/3_600_000;
     if(hours>=0&&hours<rule.min_rest_hours) addWarning("error",`${team.label} has only ${hours.toFixed(1)} hours rest between games; minimum is ${rule.min_rest_hours}.`);
    }
   }
   const plannedGames=games.filter(game=>{
    const rink=rinks.get(game.rink_id),venue=rink?venues.get(rink.venue_id):undefined;
    if(!venue) return false;
    const date=Temporal.Instant.from(game.starts_at).toZonedDateTimeISO(venue.time_zone).toPlainDate().toString();
    return date>=rule.start_date&&date<=rule.end_date;
   });
   for(let i=0;i<teams.length;i++) for(let j=i+1;j<teams.length;j++){
    const actual=plannedGames.filter(game=>
     (game.home_entry_id===teams[i]!.id&&game.away_entry_id===teams[j]!.id)
     ||(game.home_entry_id===teams[j]!.id&&game.away_entry_id===teams[i]!.id)).length;
    if(actual!==rule.round_robins) addWarning("warning",`${teams[i]!.label} vs ${teams[j]!.label}: ${actual} of ${rule.round_robins} planned matchup${rule.round_robins===1?"":"s"}.`);
   }
  }
  const checkConflicts=(items:AuditGame[],label:string)=>{
   const sorted=[...items].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
   for(let i=0;i<sorted.length;i++) for(let j=i+1;j<sorted.length&&Date.parse(sorted[j]!.starts_at)<Date.parse(sorted[i]!.ends_at);j++){
    if(overlaps(sorted[i]!,sorted[j]!)) addWarning("error",`${label} has overlapping games ${sorted[i]!.id} and ${sorted[j]!.id}.`);
   }
  };
  const byRink=new Map<string,AuditGame[]>(),byTeam=new Map<string,AuditGame[]>();
  for(const game of games){
   const rinkList=byRink.get(game.rink_id)??[];rinkList.push(game);byRink.set(game.rink_id,rinkList);
   for(const id of [game.home_entry_id,game.away_entry_id]){
    const list=byTeam.get(id)??[];list.push(game);byTeam.set(id,list);
   }
  }
  for(const [rinkId,items] of byRink) checkConflicts(items,`Rink ${rinks.get(rinkId)?.name??rinkId}`);
  for(const [entryId,items] of byTeam) checkConflicts(items,entriesById.get(entryId)?.label??entryId);
  const uniqueWarnings=[...new Map(warnings.map(warning=>[`${warning.severity}:${warning.message}`,warning])).values()];
  const homeAway=rows.map(row=>Math.abs(row.home-row.away));
  const tierValues=rows.flatMap(row=>[...tierGames.keys()].map(tier=>row.tiers[tier as AuditTier]));
  const arenaValues=rows.flatMap(row=>venueIds.map(id=>row.arenas[id]??0));
  const weeklyValues=weeks.flatMap(week=>rows.map(row=>row.weekly[week]??0));
  return {
   divisionId:division.id,divisionName:division.name,seasonName:division.season_name,gameCount:games.length,
   requiredSlots,usedRequiredSlots,totalSlots:divisionSlots.length,usedSlots,
   homeAwaySpread:spread(homeAway),tierSpread:spread(tierValues),arenaSpread:spread(arenaValues),
   weeklyLoadSpread:spread(weeklyValues),   tiers:[...tierGames.keys()].sort() as AuditTier[],
   arenas:venueIds.map(id=>({id,name:venues.get(id)?.name??"Unavailable arena"})).sort((a,b)=>a.name.localeCompare(b.name)),
   weeks,teams:rows.map(row=>({...row,homeAway:row.home-row.away})),opponentMatrix:matrix,warnings:uniqueWarnings,
   preferredWeekdayGames,gamesOnNonPreferredWeekdays:rule?.preferred_weekdays.length?gamesOnNonPreferredWeekdays:null,
  };
 });
}
