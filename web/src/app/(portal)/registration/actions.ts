"use server";
import {createHash} from "node:crypto";
import {revalidatePath} from "next/cache";
import {getVerifiedSession,getLeagueContext} from "@/lib/supabase/session";
import {registrationSchema,decisionSchema,publicationSchema,documentUploadSchema} from "@/lib/registration-schema";
export type RegistrationState={error:boolean;message:string};
const messages:Record<string,string>={
 REGISTRATION_CLOSED:"Registration is closed for this season.",
 REGISTRATION_EXISTS:"You already have an application for this season.",
 REGISTRATION_STALE:"This record changed. Reload before continuing.",
 REGISTRATION_DATES_REQUIRED:"Set both registration dates in Season settings first.",
 REGISTRATION_DOCUMENTS_REQUIRED:"The commissioner must publish a waiver before applications can be submitted.",
 REGISTRATION_DOCUMENTS_STALE:"The required documents changed. Reload and review the current versions.",
};
function failure(message:string):RegistrationState{return {error:true,message:messages[message]??"Could not save. Check your access and try again."};}
async function removeUnpublishedFile(supabase:Awaited<ReturnType<typeof getVerifiedSession>>["supabase"],path:string):Promise<boolean>{
 const {error}=await supabase.storage.from("league-documents").remove([path]);
 return !error;
}
export async function submitRegistration(previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const input:Record<string,unknown>=Object.fromEntries(form);
 input.document_ids=form.getAll("document_ids");
 const parsed=registrationSchema.safeParse(input);
 if(!parsed.success) return {error:true,message:"Complete the required document signature and consent choices, and check each current document."};
 const {supabase}=await getVerifiedSession();
 const v=parsed.data;
 const {error}=await supabase.rpc("submit_registration",{
  target_season:v.season_id,player_name:v.display_name,preferred_position:v.position,
  accepted_documents:v.document_ids,signer_name:v.signer_name,
  consent_public_profile:v.consent_public_profile==="yes",
  consent_filming:v.consent_filming==="yes",consent_marketing:v.consent_marketing==="yes",
 });
 if(error) return failure(error.message);
 revalidatePath("/registration");revalidatePath("/league/registrations");
 return {error:false,message:"Application and document choices submitted for league review."};
}
export async function publishRegistrationDocument(_previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const parsed=documentUploadSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Choose a season, document type, title, and PDF file."};
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return failure("Access denied");
 const v=parsed.data;
 const expectedPath=`${league.id}/${v.season_id}/${v.document_id}.pdf`;
 if(v.object_path!==expectedPath) return {error:true,message:"The uploaded file path is invalid."};
 const {data:season,error:seasonError}=await supabase.from("seasons").select("id").eq("id",v.season_id).eq("league_id",league.id).maybeSingle();
 if(seasonError||!season) return failure("Access denied");
 const {data:file,error:fileError}=await supabase.storage.from("league-documents").download(expectedPath);
 if(fileError||!file){
  const removed=await removeUnpublishedFile(supabase,expectedPath);
  return {error:true,message:removed?"The uploaded PDF could not be verified. Please upload it again.":"The PDF could not be verified or cleaned up. Contact your administrator before retrying."};
 }
 if(file.size<8||file.size>10*1024*1024){
  const removed=await removeUnpublishedFile(supabase,expectedPath);
  return {error:true,message:removed?"PDF files must be no larger than 10 MB.":"The oversized PDF could not be cleaned up. Contact your administrator."};
 }
 const bytes=Buffer.from(await file.arrayBuffer());
 if(!bytes.subarray(0,1024).includes(Buffer.from("%PDF-"))){
  const removed=await removeUnpublishedFile(supabase,expectedPath);
  return {error:true,message:removed?"The uploaded file is not a valid PDF.":"The invalid upload could not be cleaned up. Contact your administrator."};
 }
 const fileName=v.file_name.replace(/[^A-Za-z0-9._ -]/g,"_").replace(/[\\/]/g,"_").slice(0,160);
 const safeFileName=fileName.toLowerCase().endsWith(".pdf")?fileName:`${fileName.slice(0,156)}.pdf`;
 const {error}=await supabase.rpc("create_season_document",{
  target_season:v.season_id,target_document:v.document_id,target_document_type:v.document_type,
  document_title:v.title,object_path:expectedPath,original_file_name:safeFileName,
  file_size:bytes.length,file_sha256:createHash("sha256").update(bytes).digest("hex"),
 });
 if(error){
  const removed=await removeUnpublishedFile(supabase,expectedPath);
  if(!removed) return {error:true,message:"The document could not be published and its uploaded file could not be removed. Contact your administrator."};
  return failure(error.message);
 }
 revalidatePath("/league/registrations");revalidatePath("/registration");
 return {error:false,message:"A new immutable document version was published."};
}
export async function decideRegistration(previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const parsed=decisionSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {error:true,message:"Select a decision and give a reason (3–500 characters)."};
 const {supabase}=await getVerifiedSession();
 const v=parsed.data;
 if(v.decision!=="withdrawn"){
  const {league,canManage}=await getLeagueContext();
  if(!canManage) return failure("Access denied");
  const {data,error}=await supabase.from("player_registrations").select("id").eq("id",v.registration_id).eq("league_id",league.id).maybeSingle();
  if(error||!data) return failure("Access denied");
 }
 const {error}=await supabase.rpc("decide_registration",{target_registration:v.registration_id,decision:v.decision,expected_revision:v.revision,change_reason:v.reason});
 if(error) return failure(error.message);
 for(const path of ["/registration","/league/registrations","/account","/teams"]) revalidatePath(path);
 return {error:false,message:"Application "+v.decision+"."};
}
export async function publishRegistration(previous:RegistrationState,form:FormData):Promise<RegistrationState>{
 const parsed=publicationSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return failure("Invalid form");
 const {supabase,league,canManage}=await getLeagueContext();
 if(!canManage) return failure("Access denied");
 const v=parsed.data;
 const {data,error:lookupError}=await supabase.from("seasons").select("id").eq("id",v.season_id).eq("league_id",league.id).maybeSingle();
 if(lookupError||!data) return failure("Access denied");
 const {error}=await supabase.rpc("set_registration_open",{target_season:v.season_id,enabled:v.enabled==="true",expected_revision:v.revision});
 if(error) return failure(error.message);
 revalidatePath("/league/registrations");revalidatePath("/registration");revalidatePath("/league/settings");
 return {error:false,message:v.enabled==="true"?"Registration published for the configured dates.":"Registration closed to new applications."};
}
