import { MODO_DEMO } from "@/lib/supabase/server";
import { repoDemo } from "./demo";
import { repoSupabase } from "./supabase";

export const repo = MODO_DEMO ? repoDemo : repoSupabase;
export * from "./tipos";
