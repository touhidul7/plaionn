import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildScheduleFairness} from '../src/lib/schedule-fairness.ts';

const teams=[
 {id:'a',teamId:'ta',divisionId:'d',label:'Alphas'},
 {id:'b',teamId:'tb',divisionId:'d',label:'Bruins'},
 {id:'c',teamId:'tc',divisionId:'d',label:'Comets'},
];
const divisions=[{id:'d',name:'Premier',season_name:'Winter'}];
const venues=[
 {id:'v1',name:'North Arena',time_zone:'UTC'},
 {id:'v2',name:'South Arena',time_zone:'UTC'},
];
const rinks=[
 {id:'r1',name:'Rink 1',venue_id:'v1'},
 {id:'r2',name:'Rink 2',venue_id:'v2'},
];
const slots=[
 {id:'s1',division_id:'d',rink_id:'r1',starts_at:'2027-01-04T18:00:00Z',ends_at:'2027-01-04T19:00:00Z',local_date:'2027-01-04',time_tier:'early',is_required:true},
 {id:'s2',division_id:'d',rink_id:'r2',starts_at:'2027-01-11T18:00:00Z',ends_at:'2027-01-11T19:00:00Z',local_date:'2027-01-11',time_tier:'prime',is_required:true},
 {id:'s3',division_id:'d',rink_id:'r1',starts_at:'2027-01-18T18:00:00Z',ends_at:'2027-01-18T19:00:00Z',local_date:'2027-01-18',time_tier:'late',is_required:false},
];
const game=(id,home,away,slotId,slotIndex,status='scheduled')=>({
 id,home_entry_id:home,away_entry_id:away,rink_id:slots[slotIndex].rink_id,
 starts_at:slots[slotIndex].starts_at,ends_at:slots[slotIndex].ends_at,status,ice_slot_id:slotId,generated_schedule:true,
});
const base={
 entries:teams,divisions,venues,rinks,slots,
 games:[game('g1','a','b','s1',0),game('g2','b','c','s2',1),game('g3','a','c','s3',2)],
 rules:[{division_id:'d',start_date:'2027-01-01',end_date:'2027-01-31',round_robins:1,max_games_per_week:1,min_rest_hours:20,preferred_weekdays:[1]}],
 blackouts:[],canValidateBlackouts:true,
};

test('builds team, opponent, tier, arena, weekly and inventory fairness summaries',()=>{
 const [audit]=buildScheduleFairness(base);
 assert.equal(audit.gameCount,3);
 assert.equal(audit.requiredSlots,2);
 assert.equal(audit.usedRequiredSlots,2);
 assert.equal(audit.usedSlots,3);
 assert.equal(audit.opponentMatrix[0][1],1);
 assert.equal(audit.opponentMatrix[1][0],1);
 assert.equal(audit.opponentMatrix[0][0],0);
 assert.equal(audit.teams.find(team=>team.entryId==='a').games,2);
 assert.equal(audit.teams.find(team=>team.entryId==='a').homeAway,2);
 assert.equal(audit.teams.find(team=>team.entryId==='b').tiers.prime,1);
 assert.equal(audit.teams.find(team=>team.entryId==='b').arenas.v2,1);
 assert.deepEqual(audit.weeks,['2027-01-04','2027-01-11','2027-01-18']);
 assert.equal(audit.gamesOnNonPreferredWeekdays,0);
 assert.equal(audit.warnings.some(warning=>warning.severity==='error'),false);
});

test('reports unused required ice, blackouts, schedule conflicts and rule violations',()=>{
 const bad={
  ...base,
  entries:teams.slice(0,2),
  games:[
   {...game('g1','a','b','s1',0),starts_at:'2027-01-04T18:00:00Z',ends_at:'2027-01-04T19:00:00Z'},
   {...game('g2','a','b',null,0),starts_at:'2027-01-04T19:30:00Z',ends_at:'2027-01-04T20:30:00Z'},
   {...game('g3','b','c',null,0),starts_at:'2027-01-04T18:30:00Z',ends_at:'2027-01-04T19:30:00Z'},
  ],
  slots:[...slots,{id:'s4',division_id:'d',rink_id:'r1',starts_at:'2027-01-25T18:00:00Z',ends_at:'2027-01-25T19:00:00Z',local_date:'2027-01-25',time_tier:'prime',is_required:true}],
  blackouts:[{division_id:'d',team_entry_id:'a',blackout_date:'2027-01-04'}],
  rules:[{...base.rules[0],round_robins:1,max_games_per_week:1,min_rest_hours:3}],
 };
 const [audit]=buildScheduleFairness(bad);
 const messages=audit.warnings.map(warning=>warning.message);
 assert.ok(messages.some(message=>message.includes('required ice slot')));
 assert.ok(messages.some(message=>message.includes('blackout date')));
 assert.ok(messages.some(message=>message.includes('games in the week')));
 assert.ok(messages.some(message=>message.includes('rest between games')));
 assert.ok(messages.some(message=>message.includes('planned matchup')));
 assert.ok(messages.some(message=>message.includes('overlapping games')));
});

test('only commissioners receive blackout validation details',()=>{
 const input={...base,games:[game('g1','a','b','s1',0)],blackouts:[{division_id:'d',team_entry_id:'a',blackout_date:'2027-01-04'}]};
 const commissioner=buildScheduleFairness({...input,canValidateBlackouts:true})[0];
 const member=buildScheduleFairness({...input,canValidateBlackouts:false})[0];
 assert.ok(commissioner.warnings.some(warning=>warning.message.includes('blackout date')));
 assert.equal(member.warnings.some(warning=>warning.message.includes('blackout date')),false);
});

test('rejects fixture links that do not match division, rink, or exact slot time',()=>{
 const games=[{...game('g1','a','b','s1',0),starts_at:'2027-01-04T18:30:00Z'}];
 const [audit]=buildScheduleFairness({...base,games});
 assert.equal(audit.usedRequiredSlots,0);
 assert.ok(audit.warnings.some(warning=>warning.message.includes('does not match its assigned ice-inventory slot')));
 assert.equal(audit.teams.find(team=>team.entryId==='a').tiers.unclassified,1);
});

test('limits weekly and rest checks to weeks covered by the saved scheduling plan',()=>{
 const games=[
  {...game('g1','a','b',null,0),starts_at:'2027-02-01T18:00:00Z',ends_at:'2027-02-01T19:00:00Z'},
  {...game('g2','a','c',null,0),starts_at:'2027-02-01T20:00:00Z',ends_at:'2027-02-01T21:00:00Z'},
 ];
 const [audit]=buildScheduleFairness({
  ...base,games,rules:[{...base.rules[0],start_date:'2027-01-01',end_date:'2027-01-31',max_games_per_week:1,min_rest_hours:4}],
 });
 assert.equal(audit.warnings.some(warning=>warning.message.includes('games in the week')),false);
 assert.equal(audit.warnings.some(warning=>warning.message.includes('rest between games')),false);
});
