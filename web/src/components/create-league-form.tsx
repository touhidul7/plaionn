"use client";
import {useActionState} from "react";
import {createLeague,joinDemoLeague} from "@/app/(portal)/account/actions";

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

export function ExploreDemoLeagueButton(){
 const [state,action,pending]=useActionState(joinDemoLeague,initialState);
 return (
  <form action={action} className="panel form-stack" style={{marginTop:16}}>
   <h2>Explore Client Demo League</h2>
   <p>
    Instant access to the pre-seeded demo league (Premier division, Northline HC vs Harbour Wolves, rosters, and scheduled fixture) as commissioner.
   </p>
   <button type="submit" disabled={pending} className="button">
    {pending ? "Opening demo…" : "Open Demo League as Commissioner →"}
   </button>
   {state.message && (
    <p role="status" className={"form-message" + (state.error ? " error" : "")}>
     {state.message}
    </p>
   )}
  </form>
 );
}
