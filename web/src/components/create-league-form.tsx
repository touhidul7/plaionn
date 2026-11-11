"use client";
import {useActionState} from "react";
import {createLeague} from "@/app/(portal)/account/actions";

const initialState={error:false,message:""};

export function CreateLeagueForm(){
 const [state,action,pending]=useActionState(createLeague,initialState);
 return <form action={action} className="panel form-stack">
  <h2>Create a separate league</h2>
  <p>This creates a new league in the connected Supabase project and makes you its commissioner. Existing leagues and records are not changed.</p>
  <label>Real league name<input name="name" required minLength={2} maxLength={100} autoComplete="organization"/></label>
  <button className="primary" disabled={pending}>{pending?"Creating…":"Create league"}</button>
  {state.message&&<p role="status" className={"form-message"+(state.error?" error":"")}>{state.message}</p>}
 </form>;
}
