#!/usr/bin/env node
/**
 * Sync the Preview incident issue after the HTTP probe finishes.
 * In Actions, github.token is scoped to this repository's issues.
 */
import {syncPreviewIncident} from './preview-incident.mjs';

try{
  const result=await syncPreviewIncident({
    token:process.env.GITHUB_TOKEN,
    repository:process.env.GITHUB_REPOSITORY,
    runId:process.env.GITHUB_RUN_ID,
    state:process.env.MONITOR_STATE,
    assignee:process.env.GWAP_MONITOR_ASSIGNEE
  });
  console.log('Preview monitoring issue:',result.action);
}catch(e){
  // Never include credentials, request body or token in diagnostics.
  console.error('Preview monitoring issue sync failed:',e.message);
  process.exitCode=1;
}
