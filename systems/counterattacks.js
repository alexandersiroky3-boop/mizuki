'use strict';
const db=require('../database');
const features=require('./playerFeatures');
const SUPPORTED=new Set(['hug','kiss','steal','fight','troll','ezwin']);
async function record(guild,actor,target,command,actorDelta,targetDelta,effect=null){
    if(!target||actor===target||!SUPPORTED.has(command))return;
    try{
        await features.merge(guild,target,{lastCounterTarget:{actor:String(actor),command,actorDelta:Number(actorDelta)||0,targetDelta:Number(targetDelta)||0,effect,at:Date.now()}});
    }catch(error){console.error('Could not save counterattack target:',error);}
}
function scaled(value){return Math.sign(Number(value)||0)*Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Math.abs(Number(value)||0)*1.5));}
async function applyXP(tx,guild,user,delta){
    const row=(await tx.query('SELECT xp FROM users WHERE guildID=$1 AND userID=$2 FOR UPDATE',[guild,user])).rows[0];
    const before=Number(row?.xp)||0;
    const after=Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,before+delta));
    await tx.query('UPDATE users SET xp=$3::BIGINT,level=$4::INTEGER WHERE guildID=$1 AND userID=$2',[guild,user,String(after),require('../utils/xp').getLevel(after)]);
    if(after>before)await tx.query('INSERT INTO leaderboard_xp_activity(guildID,userID,amount,timestamp) VALUES($1,$2,$3::BIGINT,$4)',[guild,user,String(after-before),Date.now()]);
    return after-before;
}
async function execute(message){
    const guild=message.guild.id,user=message.author.id;
    const state=await features.get(guild,user);
    if(!state.counterattack) return message.reply('You need a one-use **!counterattack** reward from Frampto FP.');
    const last=state.lastCounterTarget;
    if(!last||!SUPPORTED.has(last.command))return message.reply('No eligible command has targeted you yet. Your counterattack was kept.');
    const member=await message.guild.members.fetch(last.actor).catch(()=>null);
    if(!member||member.user.bot)return message.reply('The original attacker is no longer available. Your counterattack was kept.');
    const result=await db.gameTransaction(async tx=>{
        // Match other XP transactions' lock order before claiming the entitlement.
        await tx.query('SELECT userID FROM users WHERE guildID=$1 AND userID=ANY($2::TEXT[]) ORDER BY userID FOR UPDATE',[guild,[user,last.actor].sort()]);
        const row=(await tx.query('SELECT data FROM player_features WHERE guild_id=$1 AND user_id=$2 FOR UPDATE',[guild,user])).rows[0];
        if(!row?.data.counterattack)return {error:'Your counterattack has already been used.'};
        // A newly received attack must not be silently countered against the wrong member.
        const attack=row.data.lastCounterTarget;
        if(!attack||attack.actor!==last.actor||attack.at!==last.at)return {error:'Another command just targeted you. Try !counterattack again; your charge was kept.'};
        let selfDelta=0,otherDelta=0;
        if(attack.effect){
            const e=attack.effect,now=Date.now();
            await tx.query("DELETE FROM troll_effects WHERE guildID=$1 AND targetUserID=$2 AND expiresAt<=$3",[guild,last.actor,now]);
            const payload={...(e.payload||{})};
            // Strengthen XP-bearing effects; nonnumeric effects last 50% longer.
            if(Number.isFinite(Number(payload.amount)))payload.amount=scaled(payload.amount);
            const duration=Math.max(1000,Number(e.expiresAt)-Number(e.createdAt));
            const inserted=await tx.query(`INSERT INTO troll_effects(guildID,sourceUserID,targetUserID,rarity,effectType,payload,status,createdAt,expiresAt)
                VALUES($1,$2,$3,$4,$5,$6::jsonb,'active',$7,$8) ON CONFLICT DO NOTHING RETURNING id`,
                [guild,user,last.actor,e.rarity,e.effectType,JSON.stringify(payload),now,now+Math.floor(duration*1.5)]);
            if(!inserted.rowCount)return {error:'That user already has an active troll. Your counterattack was kept.'};
        }else{
            // Replay the settled two-player outcome, not a new rarity draw. No cooldowns,
            // inventory boosts or multi-command charges are consumed by this replay.
            const ids=[user,last.actor].sort();
            await tx.query('SELECT userID FROM users WHERE guildID=$1 AND userID=ANY($2::TEXT[]) ORDER BY userID FOR UPDATE',[guild,ids]);
            let a=scaled(attack.actorDelta),b=scaled(attack.targetDelta);
            if(attack.command==='steal'){
                const balance=(await tx.query('SELECT xp FROM users WHERE guildID=$1 AND userID=$2',[guild,last.actor])).rows[0];
                a=Math.min(Math.max(0,a),Math.max(0,Number(balance?.xp)||0));b=-a;
            }
            selfDelta=await applyXP(tx,guild,user,a);
            otherDelta=await applyXP(tx,guild,last.actor,b);
        }
        await features.merge(guild,user,{counterattack:false,lastCounterTarget:null},tx);
        return {selfDelta,otherDelta,command:attack.command,effect:Boolean(attack.effect)};
    });
    if(result.error)return message.reply(result.error);
    for(const id of [user,last.actor]){
        db.invalidateUserCache(guild,id);
        await require('./leveling').syncLevelAndAnnounce(message.client,guild,id).catch(e=>console.error('Counterattack level sync:',e));
    }
    const delta=n=>(n>=0?'+':'')+n.toLocaleString();
    await message.reply({content:`⚔️ **COUNTERATTACK · !${result.command}**\n<@${user}> returned <@${last.actor}>'s command with **1.5× strength**!\n${result.effect?'The same secret troll was returned with an extended duration.':`<@${user}>: **${delta(result.selfDelta)} XP**\n<@${last.actor}>: **${delta(result.otherDelta)} XP**`}\n*One-use reward consumed. Ordinary command cooldowns are unchanged.*`,allowedMentions:{users:[user,last.actor]}});
    if(result.selfDelta>0){
        await require('./quests').recordEvent(message,'earn_xp',result.selfDelta);
        const combat=await require('./bosses').handleCommandXP(message,'!'+result.command,result.selfDelta);
        if(combat)await require('../commands/boss').handleCombatResult(message,combat);
        await require('./tutorial').onXP(message,result.selfDelta,'command');
    }
}
module.exports={execute,record,scaled,applyXP};
