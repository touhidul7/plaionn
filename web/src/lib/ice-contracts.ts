export type IceContract={
 id:string;rink_id:string;title:string;reference:string;start_date:string;end_date:string;
 purchased_hours:number;total_cost_cents:number;currency:"CAD"|"USD";status:"active"|"cancelled";cancellation_reason:string|null;
};
export type ContractSlot={id:string;contract_id:string|null;starts_at:string;ends_at:string;};
export type ContractGame={ice_slot_id:string|null;status:"draft"|"scheduled"|"cancelled";};
export type IceContractUsage={
 contract:IceContract;allocatedHours:number;draftHours:number;usedHours:number;unusedHours:number;unallocatedHours:number;
 overAllocatedHours:number;estimatedUsedCostCents:number;unutilizedCostCents:number;
};

const roundHours=(value:number)=>Math.round(value*100)/100;
export function calculateIceContractUsage(contracts:IceContract[],slots:ContractSlot[],games:ContractGame[]):IceContractUsage[]{
 const gameBySlot=new Map(games.filter(game=>game.ice_slot_id).map(game=>[game.ice_slot_id!,game]));
 return contracts.map(contract=>{
  const contractSlots=slots.filter(slot=>slot.contract_id===contract.id);
  const allocated=contractSlots.reduce((total,slot)=>total+(Date.parse(slot.ends_at)-Date.parse(slot.starts_at))/3_600_000,0);
  let used=0,draft=0;
  for(const slot of contractSlots){
   const game=gameBySlot.get(slot.id);
   const hours=(Date.parse(slot.ends_at)-Date.parse(slot.starts_at))/3_600_000;
   if(game?.status==="scheduled") used+=hours;
   else if(game?.status==="draft") draft+=hours;
  }
  const usedHours=roundHours(used),allocatedHours=roundHours(allocated),draftHours=roundHours(draft);
  const estimatedUsedCostCents=contract.purchased_hours>0
   ?Math.min(contract.total_cost_cents,Math.round(contract.total_cost_cents*usedHours/contract.purchased_hours)):0;
  return {
   contract,allocatedHours,draftHours,usedHours,unusedHours:roundHours(Math.max(0,contract.purchased_hours-usedHours)),
   unallocatedHours:roundHours(Math.max(0,contract.purchased_hours-allocatedHours)),
   overAllocatedHours:roundHours(Math.max(0,allocatedHours-contract.purchased_hours)),
   estimatedUsedCostCents,unutilizedCostCents:contract.total_cost_cents-estimatedUsedCostCents,
  };
 });
}
