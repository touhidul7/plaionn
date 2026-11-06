import nextEnv from '@next/env';
import {getSupabaseConfig} from '../src/lib/supabase/config.ts';
import {appOrigin} from '../src/lib/app-origin.ts';
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
try {
 getSupabaseConfig();
 appOrigin(process.env.NEXT_PUBLIC_APP_URL,true);
 console.log('Deployment environment valid: public Supabase configuration and HTTPS app origin present.');
 console.log('Run supabase:check separately; this check does not verify hosted migrations, users, or redirects.');
} catch {
 console.error('Deployment configuration invalid. Set NEXT_PUBLIC_SUPABASE_URL, a public Supabase key, and NEXT_PUBLIC_APP_URL to your HTTPS Vercel domain. No credential values were logged.');
 process.exitCode=1;
}
