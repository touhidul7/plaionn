import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSchedule,ScheduleGenerationError} from '../src/lib/schedule-generator.ts';
import {iceSlotSchema} from '../src/lib/ice-slot-schema.ts';
import {iceSlotTimes} from '../src/lib/schedule-schema.ts';

const teams=[
 {entryId:'entry-a',teamId:'team-a'},
 {entryId:'entry-b',teamId:'team-b'},
 {entryId:'entry-c',teamId:'team-c'},
];
const slot=(id,date,required=true,tier='prime',venueId='venue-a')=>({
 id,rinkId:'rink-'+id,venueId,startsAt:`${date}T18:00:00Z`,endsAt:`${date}T19:00:00Z`,
 timeZone:'UTC',tier,required,
});
const base={
 teams,
 slots:[slot('slot-a','2027-01-04'),slot('slot-b','2027-01-11'),slot('slot-c','2027-01-18')],
 blackouts:[],
 existingBookings:[],
 startDate:'2027-01-01',
 endDate:'2027-01-31',
 roundRobins:1,
 maxGamesPerWeek:1,
 minRestHours:20,
 preferredWeekdays:[],
};

test('validates rink-local ice-slot dates, duration, and daylight-saving transitions',()=>{
 const values={division_id:'00000000-0000-4000-8000-000000000001',rink_id:'00000000-0000-4000-8000-000000000002',local_start:'2026-10-28T20:00',local_end:'2026-10-28T21:00',time_tier:'prime',required:'true'};
 assert.equal(iceSlotSchema.safeParse(values).success,true);
 assert.equal(iceSlotTimes(values.local_start,values.local_end,'America/Toronto').localDate,'2026-10-28');
 assert.equal(iceSlotSchema.safeParse({...values,local_end:'2026-10-29T01:00'}).success,false);
 assert.throws(()=>iceSlotTimes('2026-11-01T01:30','2026-11-01T02:30','America/Toronto'));
});

test('generates one full round robin and reports fairness measures',()=>{
 const result=generateSchedule(base);
 assert.equal(result.fixtures.length,3);
 assert.equal(result.fairness.requiredSlots,3);
 assert.equal(result.fairness.opponentPairs,3);
 assert.ok(result.fixtures.every(fixture=>fixture.homeEntryId!==fixture.awayEntryId));
 assert.deepEqual(new Set(result.fixtures.map(fixture=>fixture.slot.id)),new Set(base.slots.map(item=>item.id)));
});

test('leaves optional slots unused and honors date-range inventory',()=>{
 const result=generateSchedule({...base,slots:[...base.slots,slot('optional','2027-01-25',false)]});
 assert.equal(result.fixtures.length,3);
 assert.equal(result.fairness.requiredSlots,3);
 assert.ok(result.fixtures.every(fixture=>fixture.slot.id!=='optional'));
});

test('prefers selected weeknights when optional slots are available',()=>{
 const result=generateSchedule({...base,teams:teams.slice(0,2),roundRobins:1,maxGamesPerWeek:1,minRestHours:0,slots:[
  slot('monday','2027-01-04',false),slot('tuesday','2027-01-05',false),
 ],preferredWeekdays:[2]});
 assert.equal(result.fixtures[0].slot.id,'tuesday');
});

test('rejects blackouts, insufficient inventory, and impossible weekly limits',()=>{
 assert.throws(()=>generateSchedule({...base,blackouts:base.slots.map(item=>({entryId:'entry-a',date:item.startsAt.slice(0,10)}))}),ScheduleGenerationError);
 assert.throws(()=>generateSchedule({...base,slots:base.slots.slice(0,2)}),/Only 2 ice slots/);
 assert.throws(()=>generateSchedule({...base,maxGamesPerWeek:1,slots:[slot('a','2027-01-04'),slot('b','2027-01-05'),slot('c','2027-01-06')]}),/No schedule satisfies/);
});

test('respects existing team bookings and minimum rest',()=>{
 const existingBookings=[{homeTeamId:'team-a',awayTeamId:'team-b',rinkId:'other-rink',startsAt:'2027-01-03T22:00:00Z',endsAt:'2027-01-04T00:00:00Z',timeZone:'UTC'}];
 assert.throws(()=>generateSchedule({...base,existingBookings}),/No schedule satisfies/);
});
