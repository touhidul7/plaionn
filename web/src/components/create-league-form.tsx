"use client";
import {useActionState} from "react";
import {createLeague} from "@/app/(portal)/account/actions";

const initialState={error:false,message:""};

export function CreateLeagueForm({hasLeagues}:{hasLeagues:boolean}){
 const [state,action,pending]=useActionState(createLeague,initialState);
 return (
  <form action={action} className="panel form-stack">
   <h2>{hasLeagues ? "Create another league" : "Create your league"}</h2>
   <p>
    {hasLeagues
     ? "Create an additional league and become its commissioner."
     : "Get started by naming your hockey league. You will be set as commissioner with full setup access."}
   </p>
   <label>
    League name
    <input
     name="name"
     required
     minLength={2}
     maxLength={100}
     autoComplete="organization"
     placeholder="e.g. Metro Adult Hockey League"
    />
   </label>
   <button className="primary" disabled={pending}>
    {pending ? "Creating league…" : "Create league →"}
   </button>
   {state.message && (
    <p role="status" className={"form-message" + (state.error ? " error" : "")}>
     {state.message}
    </p>
   )}
  </form>
 );
}
