import {Temporal} from "@js-temporal/polyfill";

export type ScheduleTeam={entryId:string;teamId:string};
export type IceSlot={id:string;rinkId:string;venueId:string;startsAt:string;endsAt:string;timeZone:string;tier:"early"|"prime"|"late";required:boolean};
export type ExistingBooking={homeTeamId:string;awayTeamId:string;rinkId:string;startsAt:string;endsAt:string;timeZone:string};
export type ScheduleGenerationInput={
 teams:ScheduleTeam[];
 slots:IceSlot[];
 blackouts:{entryId:string;date:string}[];
 existingBookings:ExistingBooking[];
 startDate:string;
 endDate:string;
 roundRobins:number;
 maxGamesPerWeek:number;
 minRestHours:number;
 preferredWeekdays:number[];
};
export type GeneratedFixture={homeEntryId:string;awayEntryId:string;slot:IceSlot};
export type ScheduleFairness={games:number;requiredSlots:number;homeAwaySpread:number;timeTierSpread:number;arenaSpread:number;opponentPairs:number};
export class ScheduleGenerationError extends Error {}

function localDate(slot:IceSlot){return Temporal.Instant.from(slot.startsAt).toZonedDateTimeISO(slot.timeZone).toPlainDate().toString();}
function weekStart(date:string){return Temporal.PlainDate.from(date).subtract({days:Temporal.PlainDate.from(date).dayOfWeek-1}).toString();}
function gap(a:{startsAt:string;endsAt:string},b:{startsAt:string;endsAt:string}) {
 const left=Date.parse(a.endsAt),right=Date.parse(b.endsAt);
 const earlier=Date.parse(a.startsAt)<=Date.parse(b.startsAt)?left:right;
 const later=Date.parse(a.startsAt)<=Date.parse(b.startsAt)?Date.parse(b.startsAt):Date.parse(a.startsAt);
 return (later-earlier)/3_600_000;
}

export function generateSchedule(input:ScheduleGenerationInput):{fixtures:GeneratedFixture[];fairness:ScheduleFairness}{
 const {teams,slots,blackouts,existingBookings}=input;
 if(teams.length<2) throw new ScheduleGenerationError("Add at least two teams to this division before generating a schedule.");
 if(!Number.isInteger(input.roundRobins)||input.roundRobins<1||input.roundRobins>4) throw new ScheduleGenerationError("Round robins must be between 1 and 4.");
 if(!Number.isInteger(input.maxGamesPerWeek)||input.maxGamesPerWeek<1||input.maxGamesPerWeek>7) throw new ScheduleGenerationError("Maximum games per week must be between 1 and 7.");
 if(!Number.isInteger(input.minRestHours)||input.minRestHours<0||input.minRestHours>168) throw new ScheduleGenerationError("Minimum rest must be between 0 and 168 hours.");
 if(Temporal.PlainDate.compare(input.startDate,input.endDate)>0) throw new ScheduleGenerationError("Season end date must be on or after the start date.");
 const teamByEntry=new Map(teams.map(team=>[team.entryId,team.teamId]));
 if(teamByEntry.size!==teams.length||new Set(teams.map(team=>team.teamId)).size!==teams.length) throw new ScheduleGenerationError("Each team must appear once in the selected division.");
 const dates=new Map<string,string>();
 const available=slots.filter(slot=>{
  const date=localDate(slot);
  dates.set(slot.id,date);
  return date>=input.startDate&&date<=input.endDate;
 }).sort((a,b)=>{
  if(a.required!==b.required) return a.required?-1:1;
  const preference=(slot:IceSlot)=>input.preferredWeekdays.length&&!input.preferredWeekdays.includes(Temporal.Instant.from(slot.startsAt).toZonedDateTimeISO(slot.timeZone).dayOfWeek)?1:0;
  return preference(a)-preference(b)||a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id);
 });
 if(new Set(available.map(slot=>slot.id)).size!==available.length) throw new ScheduleGenerationError("Ice inventory contains duplicate slot IDs.");
 const required=available.filter(slot=>slot.required).length;
 const gamesNeeded=teams.length*(teams.length-1)/2*input.roundRobins;
 if(gamesNeeded>256) throw new ScheduleGenerationError("This schedule has more than 256 games. Generate smaller divisions or schedules.");
 if(required>gamesNeeded) throw new ScheduleGenerationError(`There are ${required} required ice slots but only ${gamesNeeded} games in this round-robin format.`);
 if(available.length<gamesNeeded) throw new ScheduleGenerationError(`Only ${available.length} ice slots are available in the season dates; ${gamesNeeded} are needed.`);
 if(required===0&&available.length===0) throw new ScheduleGenerationError("Add ice slots inside the season dates before generating a schedule.");
 const blackoutSet=new Set(blackouts.map(item=>`${item.entryId}:${item.date}`));
 const tiers=["early","prime","late"] as const;
 const venueIds=[...new Set(available.map(slot=>slot.venueId))];
 const home=new Map(teams.map(team=>[team.entryId,0]));
 const away=new Map(teams.map(team=>[team.entryId,0]));
 const tierCounts=new Map(teams.map(team=>[team.entryId,new Map(tiers.map(tier=>[tier,0]))]));
 const arenaCounts=new Map(teams.map(team=>[team.entryId,new Map(venueIds.map(venue=>[venue,0]))]));
 const weekCounts=new Map<string,number>();
 const bookings=new Map<string,{startsAt:string;endsAt:string;rinkId:string;date:string}[]>();
 for(const booking of existingBookings){
  for(const teamId of [booking.homeTeamId,booking.awayTeamId]){
   const list=bookings.get(teamId)??[];
   const date=Temporal.Instant.from(booking.startsAt).toZonedDateTimeISO(booking.timeZone).toPlainDate().toString();
   list.push({startsAt:booking.startsAt,endsAt:booking.endsAt,rinkId:booking.rinkId,date});
   const week=weekStart(date);
   weekCounts.set(`${teamId}:${week}`,(weekCounts.get(`${teamId}:${week}`)??0)+1);
   bookings.set(teamId,list);
  }
 }
 const assigned:GeneratedFixture[]=[];
 const matchupCounts=new Map<string,number>();
 const nodes={count:0};
 const nodeLimit=120_000;
 const group=(a:string,b:string)=>a<b?`${a}:${b}`:`${b}:${a}`;
 const feasible=(slot:IceSlot,homeEntry:string,awayEntry:string)=>{
  const date=dates.get(slot.id)!;
  if(blackoutSet.has(`${homeEntry}:${date}`)||blackoutSet.has(`${awayEntry}:${date}`)) return false;
  const slotStart=Date.parse(slot.startsAt),slotEnd=Date.parse(slot.endsAt);
  if(existingBookings.some(game=>game.rinkId===slot.rinkId&&slotStart<Date.parse(game.endsAt)&&slotEnd>Date.parse(game.startsAt))) return false;
  const week=weekStart(date);
  for(const entry of [homeEntry,awayEntry]){
   const teamId=teamByEntry.get(entry)!;
   if((weekCounts.get(`${teamId}:${week}`)??0)>=input.maxGamesPerWeek) return false;
   const teamBookings=bookings.get(teamId)??[];
   if(teamBookings.some(game=>gap({startsAt:slot.startsAt,endsAt:slot.endsAt},game)<input.minRestHours)) return false;
  }
  return true;
 };
 const fairnessCost=(slot:IceSlot,h:string,a:string)=>{
  const homeAfter=Math.abs(home.get(h)!+1-away.get(h)!)+Math.abs(home.get(a)!-away.get(a)!-1);
  const spreadAfter=(counts:Map<string,number>,selected:string)=>Math.max(...[...counts].map(([key,count])=>count+(key===selected?1:0)))-Math.min(...[...counts].map(([key,count])=>count+(key===selected?1:0)));
  const tierAfter=spreadAfter(tierCounts.get(h)!,slot.tier)+spreadAfter(tierCounts.get(a)!,slot.tier);
  const arenaAfter=spreadAfter(arenaCounts.get(h)!,slot.venueId)+spreadAfter(arenaCounts.get(a)!,slot.venueId);
  const date=localDate(slot);
  const weekday=Temporal.PlainDate.from(date).dayOfWeek;
  const preferencePenalty=input.preferredWeekdays.length&&!input.preferredWeekdays.includes(weekday)?50:0;
  return homeAfter*20+tierAfter*4+arenaAfter*2+preferencePenalty;
 };
 const canStillFit=(remainingSlots:number,remainingGames:number,requiredSlots:number)=>remainingSlots>=remainingGames&&requiredSlots<=remainingGames;
 const search=(index:number,remainingFixtures:{a:string;b:string}[],remainingRequired:number):boolean=>{
  if(remainingFixtures.length===0) return remainingRequired===0;
  if(index>=available.length||!canStillFit(available.length-index,remainingFixtures.length,remainingRequired)) return false;
  if(++nodes.count>nodeLimit) return false;
  const slot=available[index],date=dates.get(slot.id)!;
  const choices=remainingFixtures.flatMap((fixture,fixtureIndex)=>{
   const pair=group(fixture.a,fixture.b);
   if((matchupCounts.get(pair)??0)>=input.roundRobins) return [];
   const reversed=(matchupCounts.get(pair)??0)%2===1;
   const orientations=reversed?[[fixture.b,fixture.a],[fixture.a,fixture.b]]:[[fixture.a,fixture.b],[fixture.b,fixture.a]];
   return orientations.flatMap(([h,a])=>feasible(slot,h,a)?[{fixture,fixtureIndex,h,a,cost:fairnessCost(slot,h,a)}]:[]);
  }).sort((a,b)=>a.cost-b.cost||group(a.fixture.a,a.fixture.b).localeCompare(group(b.fixture.a,b.fixture.b))||a.h.localeCompare(b.h));
  for(const choice of choices){
   const pair=group(choice.fixture.a,choice.fixture.b);
   const week=weekStart(date);
   assigned.push({homeEntryId:choice.h,awayEntryId:choice.a,slot});
   home.set(choice.h,home.get(choice.h)!+1);away.set(choice.a,away.get(choice.a)!+1);
   tierCounts.get(choice.h)!.set(slot.tier,tierCounts.get(choice.h)!.get(slot.tier)!+1);
   tierCounts.get(choice.a)!.set(slot.tier,tierCounts.get(choice.a)!.get(slot.tier)!+1);
   arenaCounts.get(choice.h)!.set(slot.venueId,arenaCounts.get(choice.h)!.get(slot.venueId)!+1);
   arenaCounts.get(choice.a)!.set(slot.venueId,arenaCounts.get(choice.a)!.get(slot.venueId)!+1);
   matchupCounts.set(pair,(matchupCounts.get(pair)??0)+1);
   for(const entry of [choice.h,choice.a]){
    const teamId=teamByEntry.get(entry)!;
    const list=bookings.get(teamId)??[];
    list.push({startsAt:slot.startsAt,endsAt:slot.endsAt,rinkId:slot.rinkId,date});
    bookings.set(teamId,list);
    weekCounts.set(`${teamId}:${week}`,(weekCounts.get(`${teamId}:${week}`)??0)+1);
   }
   if(search(index+1,remainingFixtures.filter((_,i)=>i!==choice.fixtureIndex),remainingRequired-(slot.required?1:0))) return true;
   assigned.pop();
   home.set(choice.h,home.get(choice.h)!-1);away.set(choice.a,away.get(choice.a)!-1);
   tierCounts.get(choice.h)!.set(slot.tier,tierCounts.get(choice.h)!.get(slot.tier)!-1);
   tierCounts.get(choice.a)!.set(slot.tier,tierCounts.get(choice.a)!.get(slot.tier)!-1);
   arenaCounts.get(choice.h)!.set(slot.venueId,arenaCounts.get(choice.h)!.get(slot.venueId)!-1);
   arenaCounts.get(choice.a)!.set(slot.venueId,arenaCounts.get(choice.a)!.get(slot.venueId)!-1);
   matchupCounts.set(pair,matchupCounts.get(pair)!-1);
   for(const entry of [choice.h,choice.a]){
    const teamId=teamByEntry.get(entry)!;
    const list=bookings.get(teamId)!;list.pop();
    weekCounts.set(`${teamId}:${week}`,weekCounts.get(`${teamId}:${week}`)!-1);
   }
  }
  if(!slot.required&&search(index+1,remainingFixtures,remainingRequired)) return true;
  return false;
 };
 const fixtures:{a:string;b:string}[]=[];
 for(let round=0;round<input.roundRobins;round++){
  for(let i=0;i<teams.length;i++) for(let j=i+1;j<teams.length;j++) fixtures.push({a:teams[i].entryId,b:teams[j].entryId});
 }
 if(!search(0,fixtures,required)){
  if(nodes.count>nodeLimit) throw new ScheduleGenerationError("Could not find a valid schedule within the search limit. Add more ice slots or relax the weekly/rest rules.");
  throw new ScheduleGenerationError("No schedule satisfies all required ice slots, team blackouts, weekly limits, minimum rest, and existing bookings.");
 }
 const spreads=(values:number[])=>values.length?Math.max(...values)-Math.min(...values):0;
 const homeAwaySpread=spreads(teams.map(team=>Math.abs(home.get(team.entryId)!-away.get(team.entryId)!)));
 const timeTierSpread=spreads(teams.flatMap(team=>tiers.map(tier=>tierCounts.get(team.entryId)!.get(tier)!)));
 const arenaSpread=spreads(teams.flatMap(team=>venueIds.map(venue=>arenaCounts.get(team.entryId)!.get(venue)!)));
 return {fixtures:assigned,fairness:{games:assigned.length,requiredSlots:required,homeAwaySpread,timeTierSpread,arenaSpread,opponentPairs:matchupCounts.size}};
}
