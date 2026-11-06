"use client";
import { useActionState } from "react";
import { createRecord } from "@/app/(portal)/league/actions";
type Props={kind:"season"|"division"|"team"; title:string; parentLabel?:string; parents?:{id:string;name:string}[]};
export function SetupForm({kind,title,parentLabel,parents}:Props) {
 const [state, action, pending] = useActionState(createRecord,{message:"",error:false});
 const unavailable = parents !== undefined && parents.length===0;
 return <form action={action} className="panel form-stack"><h2>{title}</h2><input type="hidden" name="kind" value={kind}/><label>Name<input name="name" required minLength={2} maxLength={100} placeholder={kind==="season"?"Winter 2027":kind==="division"?"Premier":"Northline HC"}/></label>{parents && <label>{parentLabel}<select name="parentId" required defaultValue="" disabled={unavailable}><option value="" disabled>Select {parentLabel?.toLowerCase()}</option>{parents.map(parent=><option key={parent.id} value={parent.id}>{parent.name}</option>)}</select></label>}{unavailable && <p>Create a {parentLabel?.toLowerCase()} first.</p>}<button className="primary" disabled={pending||unavailable}>{pending?"Saving…":"Create "+kind}</button><p className={"form-message"+(state.error?" error":"")} role="status" aria-live="polite">{state.message}</p></form>;
}
