import Link from "next/link";
import {getLeagueContext} from "@/lib/supabase/session";
import {SeasonSettingsForm} from "@/components/season-settings-form";
import type {SeasonSettings} from "@/lib/season-settings-schema";
export const dynamic="force-dynamic";
export default async function SettingsPage({searchParams}:{searchParams:Promise<{season?:string}>}){
 const {supabase,league,canManage}=await getLeagueContext();
 const {season:requested}=await searchParams;
 const seasons=await supabase.from("seasons").select("id,name").eq("league_id",league.id).order("name");
 if(seasons.error) throw new Error("Unable to load season settings.");
 const selected=seasons.data.find(season=>season.id===requested)??seasons.data[0];
 const settings=selected?await supabase.from("season_settings").select("*").eq("season_id",selected.id).eq("league_id",league.id).maybeSingle<SeasonSettings>():null;
 return <><div className="page-heading"><div><p className="eyebrow">LEAGUE CONFIGURATION</p><h1>Your season. Your rules.</h1><p>{league.name}</p></div><Link className="button" href="/league">Back to League HQ</Link></div>
 {!selected?<section className="panel empty"><h2>Create a season first.</h2><p>Rules and fees are configured separately for each season.</p><Link href="/league" className="button primary">Create a season</Link></section>:<>
 <form method="get" className="season-picker"><label>Season<select name="season" defaultValue={selected.id}>{seasons.data.map(season=><option value={season.id} key={season.id}>{season.name}</option>)}</select></label><button>Open settings</button></form>
 {settings?.error?<section className="panel"><h2>Season settings are not available yet.</h2><p>The database setup needs to be completed before these settings can be loaded. No changes have been made.</p></section>:<SeasonSettingsForm key={selected.id} seasonId={selected.id} settings={settings?.data??null} canManage={canManage}/>}
 </>}</>;
}

