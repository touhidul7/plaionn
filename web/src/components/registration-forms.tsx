"use client";
import {useActionState,useState,useTransition,type FormEvent} from "react";
import {submitRegistration,decideRegistration,publishRegistration,publishRegistrationDocument} from "@/app/(portal)/registration/actions";
import type {OpenSeason} from "@/lib/registration-schema";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import type {RegistrationState} from "@/app/(portal)/registration/actions";
const initial={error:false,message:""};
type RegistrationDocument={id:string;season_id:string;document_type:"waiver"|"code_of_conduct";title:string;version:number;url:string|null};
export function RegistrationForm({seasons,documents,name}:{seasons:OpenSeason[];documents:RegistrationDocument[];name?:string}){
 const [state,action,pending]=useActionState(submitRegistration,initial);
 const [selectedSeason,setSelectedSeason]=useState("");
 const currentDocuments=documents.filter(document=>document.season_id===selectedSeason);
 const hasWaiver=currentDocuments.some(document=>document.document_type==="waiver");
 const canSignDocuments=hasWaiver&&currentDocuments.every(document=>document.url!==null);
 return <form action={action} className="panel form-stack"><h2>Apply for a season</h2><label>Season<select name="season_id" required value={selectedSeason} onChange={event=>setSelectedSeason(event.target.value)}><option value="" disabled>Select a season</option>{seasons.map(s=><option key={s.season_id} value={s.season_id}>{s.league_name} · {s.season_name} (closes {s.closes} UTC)</option>)}</select></label>
 <label>Player name<input name="display_name" required minLength={2} maxLength={100} defaultValue={name??""} readOnly={!!name}/></label>
 <label>Preferred position<select name="position" defaultValue="F">{["C","LW","RW","D","G","F"].map(p=><option key={p}>{p}</option>)}</select></label>
 {!selectedSeason?<p className="field-help">Select a season to review its current documents.</p>:!hasWaiver?<p className="field-help">This season has no published waiver yet. Contact the league commissioner; applications require an approved waiver.</p>:<>
  <fieldset className="consent-group"><legend>Required documents</legend>{currentDocuments.map(document=><label className="consent-option" key={document.id}><input type="checkbox" name="document_ids" value={document.id} required disabled={!document.url}/><span>I have reviewed and agree to {document.url?<a className="text-link" href={document.url} target="_blank" rel="noreferrer">{document.title}, version {document.version}</a>:<strong>{document.title}, version {document.version} (PDF unavailable)</strong>}.</span></label>)}</fieldset>
  {!canSignDocuments&&<p role="alert">A required PDF could not be opened. Contact the commissioner before applying.</p>}
  <label>Type your full legal name to sign the documents<input name="signer_name" required minLength={2} maxLength={100} autoComplete="name"/></label>
  <fieldset className="consent-group"><legend>Optional permissions</legend>
   <ConsentChoice name="consent_public_profile" label="Public profile" description="Allow your player profile to appear on public league pages."/>
   <ConsentChoice name="consent_filming" label="Filming" description="Allow game footage featuring you to be captured and used by the league."/>
   <ConsentChoice name="consent_marketing" label="Marketing" description="Allow the league to use your information for marketing communications."/>
  </fieldset><p className="field-help">Each permission is separate and defaults to No. Choices are recorded; publication and messaging workflows are not enabled yet.</p>
 </>}
 <p className="field-help">The commissioner reviews your application. Approval does not confirm a team place, payment, or game eligibility. Typed-name acceptance records the document version and is not legal advice.</p>
 <button disabled={pending||!seasons.length||!canSignDocuments}>{pending?"Submitting…":"Submit application"}</button><p role="status" className={state.error?"form-message error":"form-message"}>{state.message}</p></form>;
}
function ConsentChoice({name,label,description}:{name:string;label:string;description:string}){
 return <fieldset className="consent-choice"><legend>{label}</legend><p>{description}</p><label><input type="radio" name={name} value="no" defaultChecked required/>No</label><label><input type="radio" name={name} value="yes"/>Yes</label></fieldset>;
}
export function RegistrationDocumentUpload({leagueId,seasons}:{leagueId:string;seasons:{id:string;name:string}[]}){
 const [state,setState]=useState<RegistrationState>(initial);
 const [pending,startTransition]=useTransition();
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const form=event.currentTarget;
  const values=new FormData(form);
  const file=values.get("file");
  if(!(file instanceof File)||!file.size||file.size>10*1024*1024){
   setState({error:true,message:"Choose a PDF file no larger than 10 MB."});
   return;
  }
  const header=new TextDecoder().decode(await file.slice(0,1024).arrayBuffer());
  if(!header.includes("%PDF-")){
   setState({error:true,message:"The selected file is not a valid PDF."});
   return;
  }
  const seasonId=String(values.get("season_id")??"");
  const documentId=crypto.randomUUID();
  const objectPath=`${leagueId}/${seasonId}/${documentId}.pdf`;
  setState(initial);
  startTransition(async()=>{
   const supabase=createSupabaseBrowserClient();
   const {error}=await supabase.storage.from("league-documents").upload(objectPath,file,{contentType:"application/pdf",upsert:false});
   if(error){
    setState({error:true,message:"The PDF could not be uploaded. Check your commissioner access and try again."});
    return;
   }
   const metadata=new FormData();
   metadata.set("season_id",seasonId);
   metadata.set("document_id",documentId);
   metadata.set("document_type",String(values.get("document_type")??""));
   metadata.set("title",String(values.get("title")??""));
   metadata.set("object_path",objectPath);
   metadata.set("file_name",file.name);
   const result=await publishRegistrationDocument(initial,metadata);
   setState(result);
   if(!result.error) form.reset();
  });
 }
 return <form onSubmit={upload} className="panel form-stack"><h3>Publish a document version</h3><p>Upload an approved PDF. Publishing a replacement creates a new version; earlier acceptance history is retained.</p>
  <label>Season<select name="season_id" required defaultValue=""><option value="" disabled>Select a season</option>{seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
  <label>Document type<select name="document_type" required defaultValue="waiver"><option value="waiver">Player waiver</option><option value="code_of_conduct">Code of conduct</option></select></label>
  <label>Document title<input name="title" required minLength={2} maxLength={120}/></label>
  <label>PDF file<input name="file" type="file" accept="application/pdf,.pdf" required/></label>
  <button disabled={pending||!seasons.length}>{pending?"Uploading…":"Upload and publish version"}</button>
  <p role="status" className={state.error?"form-message error":"form-message"}>{state.message}</p>
 </form>;
}
export function RegistrationDecision({id,revision,review=false}:{id:string;revision:number;review?:boolean}){
 const [state,action,pending]=useActionState(decideRegistration,initial);
 return <form action={action} className="form-stack"><input type="hidden" name="registration_id" value={id}/><input type="hidden" name="revision" value={revision}/>
 {review?<label>Decision<select name="decision"><option value="approved">Approve registration</option><option value="rejected">Reject application</option></select></label>:<input type="hidden" name="decision" value="withdrawn"/>}
 <label>{review?"Review reason (visible to applicant)":"Reason for withdrawing"}<input name="reason" required minLength={3} maxLength={500}/></label><button disabled={pending}>{pending?"Saving…":review?"Save decision":"Withdraw application"}</button><p role="status" className={state.error?"form-message error":"form-message"}>{state.message}</p></form>;
}
export function RegistrationPublication({seasonId,revision,enabled}:{seasonId:string;revision:number;enabled:boolean}){
 const [state,action,pending]=useActionState(publishRegistration,initial);
 return <form action={action}><input type="hidden" name="season_id" value={seasonId}/><input type="hidden" name="revision" value={revision}/><input type="hidden" name="enabled" value={String(!enabled)}/><button disabled={pending}>{pending?"Saving…":enabled?"Close applications":"Publish registration"}</button><p role="status">{state.message}</p></form>;
}
