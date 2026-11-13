import {handleSession} from '../server/http.mjs';
export default async function handler(req,res){
 return handleSession(req,res,{botToken:process.env.TELEGRAM_BOT_TOKEN,sessionSecret:process.env.GWAP_SESSION_SECRET});
}
