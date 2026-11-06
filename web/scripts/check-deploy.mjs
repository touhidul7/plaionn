import nextEnv from '@next/env';
import {getSupabaseConfig,isPublicSupabaseKey} from '../src/lib/supabase/config.ts';
import {appOrigin} from '../src/lib/app-origin.ts';
nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const problems=[];
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const keys=[process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,process.env.NEXT_PUBLIC_ANON_KEY].filter(Boolean);
if(!url) problems.push('NEXT_PUBLIC_SUPABASE_URL is missing. Add your HTTPS Supabase project URL.');
if(!keys.length) problems.push('Supabase public key is missing. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY (NEXT_PUBLIC_ANON_KEY is also supported).');
else if(!keys.some(isPublicSupabaseKey)) problems.push('Supabase key is invalid. Use a publishable key or an anon JWT, never a secret/service-role key.');
if(url&&keys.some(isPublicSupabaseKey)){
 try{getSupabaseConfig();}catch{problems.push('NEXT_PUBLIC_SUPABASE_URL is invalid. Use the HTTPS project origin without credentials, paths, query parameters, or fragments.');}
}
if(!process.env.NEXT_PUBLIC_APP_URL) problems.push('NEXT_PUBLIC_APP_URL is missing. Set it to https://YOUR-PROJECT.vercel.app (or your custom domain).');
else {
 try{appOrigin(process.env.NEXT_PUBLIC_APP_URL,true);}catch{problems.push('NEXT_PUBLIC_APP_URL is invalid. Use your deployed HTTPS origin, not localhost, and omit paths such as /login.');}
}
if(problems.length){
 console.error('Deployment environment check failed:');
 for(const problem of problems) console.error('- '+problem);
 console.error('In Vercel Project Settings > Environment Variables, apply these to the deployment environment (Production or Preview), then redeploy. Local .env.local is not uploaded.');
 console.error('No credential values were logged.');
 process.exitCode=1;
}else{
 console.log('Deployment environment valid: public Supabase configuration and HTTPS app origin present.');
 console.log('Run supabase:check separately; this check does not verify hosted migrations, users, or redirects.');
}
