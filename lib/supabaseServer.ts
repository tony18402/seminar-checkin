import { cookies } from "next/headers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let singletonClient: SupabaseClient | null = null;

export function createServerClient(): SupabaseClient {
  if (singletonClient) return singletonClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase environment variables are not set");
  }

  // ถ้าอยากใช้ cookies ในอนาคตยังเรียก cookies() ได้จากตรงนี้
  const cookieStore = cookies();
  void cookieStore; // ป้องกัน unused variable warning

  singletonClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false, // เหมาะกับ server-side
    },
  });

  return singletonClient;
}