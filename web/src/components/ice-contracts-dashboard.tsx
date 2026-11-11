import {calculateIceContractUsage,type ContractGame,type ContractSlot,type IceContract} from "@/lib/ice-contracts";
import type {Rink} from "@/lib/schedule-schema";
import {IceContractCancelForm,IceContractForm,IceSlotContractForm} from "@/components/schedule-forms";

type SlotRecord=ContractSlot&{local_date:string;rink_id:string};

function formatCost(cents:number,currency:"CAD"|"USD"){
 return new Intl.NumberFormat("en-CA",{style:"currency",currency}).format(cents/100);
}

export function IceContractsDashboard({contracts,slots,games,rinks}:{contracts:IceContract[];slots:SlotRecord[];games:ContractGame[];rinks:Rink[]}){
 const usage=calculateIceContractUsage(contracts,slots,games);
 const contractById=new Map(contracts.map(contract=>[contract.id,contract]));
 const rinkName=(id:string)=>rinks.find(rink=>rink.id===id)?.name??"Unknown rink";
 return <section className="ice-contract-dashboard" aria-labelledby="ice-contracts-heading">
  <div className="section-heading"><h2 id="ice-contracts-heading">Purchased ice &amp; cost tracking</h2><span>{contracts.length} contracts</span></div>
  <IceContractForm rinks={rinks}/>
  <section className="panel">
   <h3>Contract utilization</h3>
   <p className="field-help">Scheduled games count as used ice; draft reservations are shown separately. Costs are prorated estimates, not invoices or refunds. Currency totals are kept separate.</p>
   {usage.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Contract</th><th scope="col">Term / rink</th><th scope="col">Purchased</th><th scope="col">Allocated</th><th scope="col">Scheduled / draft</th><th scope="col">Unallocated / unused</th><th scope="col">Estimated utilized cost</th><th scope="col">Management</th></tr></thead><tbody>
    {usage.map(item=><tr key={item.contract.id}>
     <td><strong>{item.contract.title}</strong><br/><small>{item.contract.reference||"No vendor reference"} · {item.contract.status}</small></td>
     <td>{rinkName(item.contract.rink_id)}<br/><small>{item.contract.start_date} – {item.contract.end_date}</small></td>
     <td>{item.contract.purchased_hours.toFixed(2)} h<br/><small>{formatCost(item.contract.total_cost_cents,item.contract.currency)} {item.contract.currency}</small></td>
     <td>{item.allocatedHours.toFixed(2)} h{item.overAllocatedHours>0&&<><br/><small>Over by {item.overAllocatedHours.toFixed(2)} h</small></>}</td>
     <td>{item.usedHours.toFixed(2)} h scheduled<br/><small>{item.draftHours.toFixed(2)} h draft</small></td>
     <td>{item.unallocatedHours.toFixed(2)} h unallocated<br/><small>{item.unusedHours.toFixed(2)} h unused</small></td>
     <td>{formatCost(item.estimatedUsedCostCents,item.contract.currency)}<br/><small>{formatCost(item.unutilizedCostCents,item.contract.currency)} estimated unutilized</small></td>
     <td>{item.contract.status==="active"&&<details><summary>Cancel contract</summary>{slots.some(slot=>slot.contract_id===item.contract.id)?<p>Unassign linked inventory slots before cancelling this contract. Its utilization remains in the report.</p>:<IceContractCancelForm contractId={item.contract.id}/>}</details>}{item.contract.status==="cancelled"&&<span>{item.contract.cancellation_reason}</span>}</td>
    </tr>)}
   </tbody></table></div>:<p>No contracts recorded. Add actual rink contracts to track commitment and usage.</p>}
  </section>
  <section className="panel">
   <h3>Link ice inventory to contracts</h3>
   <p className="field-help">A slot can only be assigned to an active contract for the same rink and local contract dates. Every change is audited.</p>
   {slots.length?<div className="table-wrap"><table className="table"><thead><tr><th scope="col">Date</th><th scope="col">Rink</th><th scope="col">Current contract</th><th scope="col">Assignment</th></tr></thead><tbody>
    {slots.map(slot=><tr key={slot.id}><td>{slot.local_date}</td><td>{rinkName(slot.rink_id)}</td><td>{slot.contract_id?contractById.get(slot.contract_id)?.title??"Contract unavailable":"Unassigned"}</td><td><IceSlotContractForm slotId={slot.id} slotDate={slot.local_date} rinkId={slot.rink_id} contractId={slot.contract_id} contracts={contracts}/></td></tr>)}
   </tbody></table></div>:<p>Add ice inventory slots before assigning contract hours.</p>}
  </section>
 </section>;
}
