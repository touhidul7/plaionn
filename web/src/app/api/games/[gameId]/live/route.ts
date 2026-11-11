import {NextResponse} from "next/server";
import {z} from "zod";
import {getLeagueContext} from "@/lib/supabase/session";
import {liveScoreboardSchema} from "@/lib/live-scoreboard";

export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{gameId:string}>}){
 const {gameId}=await params;
 if(!z.uuid().safeParse(gameId).success) return NextResponse.json({error:"Invalid game id."},{status:400});
 const {supabase,league}=await getLeagueContext();
 const game=await supabase.from("games").select("id").eq("id",gameId).eq("league_id",league.id).eq("status","scheduled").maybeSingle();
 if(game.error) return NextResponse.json({error:"Could not check the scheduled game."},{status:503});
 if(!game.data) return NextResponse.json({error:"Scheduled game not found."},{status:404});
 const {data,error}=await supabase.rpc("get_live_scoreboard",{target_game:gameId});
 if(error) return NextResponse.json({error:"Live scoreboard is unavailable. Check that the live-score migration is applied."},{status:503});
 const parsed=liveScoreboardSchema.safeParse(data);
 if(!parsed.success) return NextResponse.json({error:"Live scoreboard returned invalid data."},{status:502});
 return NextResponse.json(parsed.data,{headers:{"Cache-Control":"no-store, max-age=0"}});
}
