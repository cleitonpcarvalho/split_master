import { env } from "../config/env.js";
import { supabaseAdmin } from "../config/supabase.js";

export interface SupabaseStatus {
  connected: boolean;
  bucket: string;
  bucketExists: boolean;
}

export async function getSupabaseStatus(): Promise<SupabaseStatus> {
  const { data, error } = await supabaseAdmin.storage.listBuckets();

  if (error) {
    throw new Error(`Falha ao consultar o Supabase: ${error.message}`);
  }

  return {
    connected: true,
    bucket: env.supabaseStorageBucket,
    bucketExists: data.some(
      (bucket) => bucket.name === env.supabaseStorageBucket,
    ),
  };
}
