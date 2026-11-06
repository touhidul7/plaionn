import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appOrigin} from '../src/lib/app-origin.ts';
test('deployed confirmation links require an explicit HTTPS origin',()=>{
 assert.equal(appOrigin(undefined,false),'http://127.0.0.1:3000');
 assert.equal(appOrigin('https://hockey-demo.vercel.app/',true),'https://hockey-demo.vercel.app');
 for(const value of [undefined,'http://localhost:3000','https://127.0.0.1','https://localhost','https://user:password@example.com','https://example.com/path','https://example.com?next=evil','javascript:alert(1)']) assert.throws(()=>appOrigin(value,true));
});
