#!/usr/bin/env node
// Fail closed before pg_dump if the secret targets a different Neon branch.
// Never print or persist the DATABASE_URL or credentials.
const EXPECTED_HOST = 'ep-super-shadow-bci5cjya.c-16.us-east-1.aws.neon.tech';
const EXPECTED_DATABASE = 'neondb';
const EXPECTED_ROLE = 'gwapoholics_backup_reader';

function fail(message) {
  console.error(`::error::GWAPOHOLICS backup source check failed: ${message}. No backup will be uploaded.`);
  process.exitCode = 1;
}

let url;
try {
  url = new URL(process.env.DATABASE_URL || '');
} catch {
  fail('connection URL is missing or invalid');
}

if (url) {
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    fail('database protocol is not PostgreSQL');
  } else if (url.hostname !== EXPECTED_HOST) {
    fail('database endpoint is not the approved Preview branch (direct connection required)');
  } else if (decodeURIComponent(url.pathname) !== `/${EXPECTED_DATABASE}`) {
    fail('database name is not the approved Preview database');
  } else if (decodeURIComponent(url.username) !== EXPECTED_ROLE) {
    fail('database role is not the dedicated read-only backup reader');
  } else if (!url.password) {
    fail('password authentication is not configured');
  } else {
    console.log('Approved GWAPOHOLICS Preview endpoint, database and backup role verified (no credentials logged).');
  }
}
