import {handleSession} from '../server/http.mjs';
import {readRestrictedBetaUsers,betaUnavailable} from '../server/beta-access.mjs';

export default async function handler(req,res){
  // This branch is restricted by default. Never issue a session unless the
  // server-only iOS beta allowlist is explicitly and validly configured.
  let betaAllowedUserIds;
  try {betaAllowedUserIds=readRestrictedBetaUsers(process.env)}
  catch {betaUnavailable(res);return}
  return handleSession(req,res,{
    botToken:process.env.TELEGRAM_BOT_TOKEN,
    sessionSecret:process.env.GWAP_SESSION_SECRET,
    betaAllowedUserIds
  });
}
