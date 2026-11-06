"use client";
import {useActionState,useState} from "react";
import {authenticate} from "@/app/login/actions";
export function AuthForm() {
 const [mode,setMode]=useState<"login"|"signup">("login");
 const [state,action,pending]=useActionState(authenticate,{error:false,message:""});
 return <form action={action} className="panel form-stack auth-panel"><h2>{mode==="login"?"Welcome back.":"Join the network."}</h2><input type="hidden" name="mode" value={mode}/><label>Email<input type="email" name="email" autoComplete="email" required maxLength={254}/></label><label>Password<input type="password" name="password" autoComplete={mode==="login"?"current-password":"new-password"} minLength={8} maxLength={128} required/></label><button className="primary" disabled={pending}>{pending?"Please wait…":mode==="login"?"Sign in":"Create account"}</button><p className={"form-message"+(state.error?" error":"")} role="status">{state.message}</p><button type="button" disabled={pending} onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New here? Create an account":"Already registered? Sign in"}</button><p>League access is assigned by your administrator. Creating an account does not grant administrative permissions.</p></form>;
}

