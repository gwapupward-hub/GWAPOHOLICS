#!/usr/bin/env node
import {inspectDatabaseTls} from './database-tls-policy.mjs';
const result=inspectDatabaseTls(process.env.DATABASE_URL);
console.log(JSON.stringify(result,null,2));
if(result.status!=='explicit-verified')process.exitCode=1;
