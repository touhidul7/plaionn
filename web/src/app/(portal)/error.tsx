"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="panel empty"><h1>We couldn’t load this page.</h1><p>Please try again. If it continues, check the local server logs.</p><button onClick={reset}>Try again</button></section>;}
