"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getVerifiedSession } from "@/lib/supabase/session";

export type CreateLeagueState = { error: boolean; message: string };
const leagueNameSchema = z.object({ name: z.string().trim().min(2).max(100) });

export async function createLeague(_previous: CreateLeagueState, form: FormData): Promise<CreateLeagueState> {
    const parsed = leagueNameSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: true, message: "Enter a league name between 2 and 100 characters." };
    const { supabase } = await getVerifiedSession();
    let result;
    try {
        result = await supabase.rpc("create_league", { league_name: parsed.data.name });
    } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        return { error: true, message: "Could not reach database. Please try again." };
    }
    if (result.error) {
        if (result.error.code === "42501") return { error: true, message: "Unable to create league. If you just signed up, ensure migration 202611160001 is applied in Supabase." };
        if (result.error.code === "22023") return { error: true, message: "Enter a league name between 2 and 100 characters." };
        return { error: true, message: result.error.message || "League setup is unavailable." };
    }
    const leagueId = z.uuid().safeParse(result.data);
    if (!leagueId.success) return { error: true, message: "Database returned an invalid league identifier. Contact support." };
    (await cookies()).set("plaionn-league", leagueId.data, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    revalidatePath("/", "layout");
    revalidatePath("/account");
    revalidatePath("/admin");
    redirect(`/admin/league/${leagueId.data}`);
}

export async function joinDemoLeague(): Promise<CreateLeagueState> {
    const { supabase } = await getVerifiedSession();
    let result;
    try {
        result = await supabase.rpc("join_demo_league");
    } catch (err) {
        if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
        return { error: true, message: "Could not connect to database. Please try again." };
    }
    if (result.error) {
        return { error: true, message: result.error.message || "Demo league is not initialized yet. Apply migration 202611160001_onboarding_and_demo_access.sql in Supabase." };
    }
    const leagueId = z.uuid().safeParse(result.data);
    if (!leagueId.success) return { error: true, message: "Invalid league ID received." };
    (await cookies()).set("plaionn-league", leagueId.data, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    revalidatePath("/", "layout");
    revalidatePath("/account");
    revalidatePath("/admin");
    redirect(`/admin/league/${leagueId.data}`);
}
