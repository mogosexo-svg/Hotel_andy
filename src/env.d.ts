interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly GOOGLE_PLACES_API_KEY?: string;
  readonly GOOGLE_PLACE_ID?: string;
  readonly GOOGLE_PLACES_BASE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
