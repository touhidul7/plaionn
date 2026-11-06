import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {PGlite} from "@electric-sql/pglite";
const sql=await readFile(new URL("../db/migrations/001_league_foundation.sql",import.meta.url),"utf8");
const ids=Array.from({length:8},(_,i)=>"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
test("league schema rejects duplicate names and cross-tenant parents",async()=>{
 const db=new PGlite();
 try {
 await db.exec(sql);
 await db.query("INSERT INTO leagues(id,name) VALUES($1,'League A'),($2,'League B')",[ids[0],ids[1]]);
 await db.query("INSERT INTO seasons(id,league_id,name) VALUES($1,$2,'Winter')",[ids[2],ids[0]]);
 await assert.rejects(db.query("INSERT INTO seasons(id,league_id,name) VALUES($1,$2,'winter')",[ids[3],ids[0]]),e=>e.code==="23505");
 await assert.rejects(db.query("INSERT INTO divisions(id,league_id,season_id,name) VALUES($1,$2,$3,'Premier')",[ids[4],ids[1],ids[2]]),e=>e.code==="23503");
 await db.query("INSERT INTO divisions(id,league_id,season_id,name) VALUES($1,$2,$3,'Premier')",[ids[4],ids[0],ids[2]]);
 await db.query("INSERT INTO teams(id,league_id,name) VALUES($1,$2,'Test Team')",[ids[5],ids[1]]);
 await assert.rejects(db.query("INSERT INTO team_entries(id,league_id,team_id,division_id) VALUES($1,$2,$3,$4)",[ids[6],ids[0],ids[5],ids[4]]),e=>e.code==="23503");
 await assert.rejects(db.query("INSERT INTO teams(id,league_id,name) VALUES($1,$2,' ')",[ids[7],ids[0]]),e=>e.code==="23514");
 } finally {await db.close();}
});
test("development database retains records after reopening",async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),"plaionn-db-test-"));
 let db;
 try {
 db=new PGlite(directory); await db.exec(sql);
 await db.query("INSERT INTO leagues(id,name) VALUES($1,'Persistence Test')",[ids[0]]);
 await db.close(); db=new PGlite(directory);
 const result=await db.query("SELECT name FROM leagues WHERE id=$1",[ids[0]]);
 assert.equal(result.rows[0].name,"Persistence Test");
 } finally {if(db&&!db.closed)await db.close();await rm(directory,{recursive:true,force:true});}
});
