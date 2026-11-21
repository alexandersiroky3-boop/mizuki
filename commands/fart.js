'use strict';
const database = require('../database');
const leveling = require('../systems/leveling');
const playerFeatures = require('../systems/playerFeatures');

const COOLDOWN_MS = 30 * 60 * 1000;
const BAD_LUCK_MS = 10 * 60 * 1000;
const LEGENDARY_CHANCE = 0.015;
const sample = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;
const customEmoji = (guild,name,fallback)=>guild?.emojis?.cache?.find(emoji=>emoji.name===name)?.toString() || fallback;

function parseTarget(message){
    const input=String(message.content||'').trim().split(/\s+/)[1];
    if(!input)return null;
    if(/^mizuki$/i.test(input))return message.client.user?.id;
    const mention=/^<@!?(\d{16,22})>$/.exec(input);
    if(mention)return mention[1];
    return /^\d{16,22}$/.test(input)?input:null;
}
async function applyBadLuck(guildID,targetID,now=Date.now()){
    await playerFeatures.init();
    const result=await database.gameQuery(`
        INSERT INTO player_features(guild_id,user_id,data)
        VALUES($1,$2,jsonb_build_object('luckPenaltyUntil',($3::BIGINT+$4::BIGINT)))
        ON CONFLICT(guild_id,user_id) DO UPDATE
        SET data=jsonb_set(player_features.data,'{luckPenaltyUntil}',
            to_jsonb(GREATEST(COALESCE((player_features.data->>'luckPenaltyUntil')::BIGINT,0),$3::BIGINT)+$4::BIGINT),true)
        RETURNING (data->>'luckPenaltyUntil')::BIGINT AS expires_at
    `,[String(guildID),String(targetID),now,BAD_LUCK_MS]);
    return Number(result.rows[0]?.expires_at)||now+BAD_LUCK_MS;
}
async function execute(message){
    if(!message.guild||message.author?.bot)return null;
    const targetID=parseTarget(message);
    if(!targetID)return message.reply({content:'Usage: `!fart @user` or `!fart <user ID>` (you can also target Mizuki).',allowedMentions:{parse:[],repliedUser:false}});
    if(targetID===message.author.id)return message.reply({content:'You cannot fart on yourself.',allowedMentions:{parse:[]}});
    const isMizuki=targetID===message.client.user.id;
    if(!isMizuki){
        const target=await message.guild.members.fetch(targetID).catch(()=>null);
        if(!target || target.user.bot)return message.reply({content:'That target is not a human member of this server.',allowedMentions:{parse:[]}});
    }
    const now=Date.now();
    const claimed=await database.claimCommandCooldown(message.guild.id,message.author.id,'fart',now+COOLDOWN_MS,now);
    if(!claimed){
        const remaining=await database.getCommandCooldownRemaining(message.guild.id,message.author.id,'fart');
        return message.reply({content:`You can use \`!fart\` again in **${Math.ceil(remaining/60000)} minutes**.`,allowedMentions:{parse:[]}});
    }
    let economyApplied=false;
    try{
        let content;
        if(isMizuki){
            const gained=sample(500_000,2_500_000);
            await database.giveXP(message.guild.id,message.author.id,gained);
            economyApplied=true;
            content=`*Her breath hitches, slowly making a fully disgusted face at you*\n\n"EEEW YOU DOG!"\n\n*She says while covering her mouth and nose, then she lifts one arm like a god and snaps her fingers*\n\n*But she couldn't control her power through your fart gas...*\n\n*Instead of removing your XP...*\n\n**💩 YOU GET ${gained.toLocaleString('en-US')} XP.**\n\n*Without saying anything, she just turns around and flies away with lightspeed... 💨*`;
            await leveling.syncLevelAndAnnounce(message.client,message.guild.id,message.author.id);
        }else{
            const legendary=Math.random()<LEGENDARY_CHANCE;
            const requested=legendary?sample(35_000_000,125_000_000):sample(1_500_000,7_500_000);
            const actualLoss=await database.applyTrollXPLoss(message.guild.id,targetID,requested);
            economyApplied=true;
            const from=`<@${message.author.id}>`,to=`<@${targetID}>`;
            if(legendary){
                const until=await applyBadLuck(message.guild.id,targetID);
                const heart=customEmoji(message.guild,'golden_heart','🌠');
                content=`💩${heart} **${from} farted on ${to}!!!**\n\n💩${heart} **LEGENDARY** 🌠\n\nShe looks at them with disgusted face\n\n"EEEEW! ${from} FARTED ON ${to}, making ${to} poop out-"\n\n*Then Mizuki snaps her fingers like Thanos*\n\n**MAKING ${to} lose ${actualLoss.toLocaleString('en-US')} XP 💨**\n\n**Bad luck** until <t:${Math.floor(until/1000)}:R> (stacks duration only).`;
            }else{
                const leaf=customEmoji(message.guild,'evolved_common_leaf','🍃');
                content=`💩 **${from} farted on ${to}!!!**\n\n💩 **COMMON** ${leaf}\n\n**MAKING ${to} lose ${actualLoss.toLocaleString('en-US')} XP**`;
            }
            await leveling.syncLevelAndAnnounce(message.client,message.guild.id,targetID,{announceLevelUps:false});
        }
        return message.reply({content,allowedMentions:{parse:[],repliedUser:false}});
    }catch(error){
        // Return the cooldown on a failed database operation, so an unrelated
        // outage does not consume a 30-minute attempt.
        if(!economyApplied)await database.clearCommandCooldown(message.guild.id,message.author.id,'fart').catch(()=>{});
        throw error;
    }
}
module.exports={execute,parseTarget,applyBadLuck,COOLDOWN_MS,LEGENDARY_CHANCE};
