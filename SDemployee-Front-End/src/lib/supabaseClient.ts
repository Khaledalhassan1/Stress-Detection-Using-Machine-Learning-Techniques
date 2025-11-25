import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://pipucrigsrjaeekxhnug.supabase.co"; 
const supabaseAnonKey = "sb_publishable_OgqrCQpcA2GlngDUru5A6A_bvV--GXA"; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
