'use strict';
const db = require('../database');
let ready;
function init(){
    if(!ready) ready = db.gameQuery(`CREATE TABLE IF NOT EXISTS player_features (
        guild_id TEXT NOT NULL, user_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}',
        PRIMARY KEY(guild_id,user_id))`).catch(error=>{ready=null;throw error;});
    return ready;
}
async function get(guild,user){
    await init();
    return (await db.gameQuery('SELECT data FROM player_features WHERE guild_id=$1 AND user_id=$2',[guild,user])).rows[0]?.data || {};
}
async function merge(guild,user,patch,tx=null){
    await init();
    return (await (tx||{query:db.gameQuery}).query(`INSERT INTO player_features(guild_id,user_id,data) VALUES($1,$2,$3::jsonb)
        ON CONFLICT(guild_id,user_id) DO UPDATE SET data=player_features.data||EXCLUDED.data RETURNING data`,[guild,user,JSON.stringify(patch)])).rows[0].data;
}
module.exports={init,get,merge};
