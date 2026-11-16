'use strict';
const db=require('../database');
const features=require('./playerFeatures');
const runID=require('node:crypto').randomUUID();
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,PermissionFlagsBits}=require('discord.js');
const delay=3000, idle=60000;
const XP_COMMANDS=new Set(['!roll','!hug','!kiss','!steal','!ezwin','!fight','!coinflip','!troll']);
let initialized=null, timer=null, ticking=false;
function init(){
    if(!initialized)initialized=db.gameQuery(`CREATE TABLE IF NOT EXISTS bot_tutorials (
        guild_id TEXT NOT NULL,user_id TEXT NOT NULL,number BIGSERIAL UNIQUE,
        data JSONB NOT NULL DEFAULT '{}',completed BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY(guild_id,user_id))`).catch(e=>{initialized=null;throw e;});
    return initialized;
}
function inRoom(message){return Boolean(message?.guild&&!message.author?.bot&&message.channel?.name?.startsWith('tutorial-'));}
async function say(channel,text,user){return channel.send({content:text,allowedMentions:{users:[String(user)]}});}
function enqueue(s,text,nextStage){s.pending={text,stage:nextStage,at:Date.now()+delay};s.stage=0;}
const taskText=(step,u)=>({
    1:'Your first task is: Earn your first XP by typing something...',
    2:'Your second task is: Use any command that earns you XP!.. *Use !commands if you don’t know them.*',
    3:'Your third task is: Use a boost!.. *Do !boost.*',
    4:'Your fourth task is: Earn 50,000 XP in 10 minutes! Failure costs up to 100,000 XP and halves command luck for 1 hour. The timer pauses while the bot is offline.',
    5:'Your fifth and final task is: Upgrade Chatting to Upgrade 1! *Use !upgrades — it costs 50,000 XP.*'
}[step]);
async function session(guild,user,fn){
    await init();
    await features.init();
    return db.gameTransaction(async tx=>{
        const {rows}=await tx.query('SELECT * FROM bot_tutorials WHERE guild_id=$1 AND user_id=$2 FOR UPDATE',[guild,user]);
        const row=rows[0];if(!row||row.completed||row.data.cancelled)return;
        const s=row.data;
        const result=await fn(s,tx,row);
        await tx.query('UPDATE bot_tutorials SET data=$3::jsonb,completed=$4 WHERE guild_id=$1 AND user_id=$2',[guild,user,JSON.stringify(s),Boolean(s.completed)]);
        return result;
    });
}
async function fail(s,tx,guild,user,channel){
    if(s.failed||s.completed||s.pending?.stage===6)return;
    await tx.query('INSERT INTO users(guildID,userID) VALUES($1,$2) ON CONFLICT DO NOTHING',[guild,user]);
    const actual=await require('./counterattacks').applyXP(tx,guild,user,-100000);
    await features.merge(guild,user,{luckPenaltyUntil:Date.now()+3600000},tx);
    s.failed=true;s.cancelled=true;delete s.pending;
    db.invalidateUserCache(guild,user);
    await say(channel,`Tutorial failed: **${actual.toLocaleString()} XP** and **½ command luck for 1 hour**.\nMizuki probably hates you now. - from Kape`,user).catch(error=>console.error('Tutorial penalty announcement:',error));
}
async function finishTask(s,channel,user){
    const u=`<@${user}>`,stage=s.stage;
    const success={1:`Great job, ${u}!... Now that you earned XP, it’s time to earn even more XP!...`,2:`Nice!... *Mizuki looks around before looking at ${u}* It’s time for your third task...`,3:'Now that you have your boosts activated...',4:`Great job, ${u}... Now it’s time to upgrade!`};
    if(stage===5){
        await say(channel,`Wow! Look at that, ${u}. You completed your basic steps toward becoming a great powerful user!`,user);
        enqueue(s,`There’s still ALOT more to explore.... Good luck, ${u}... And farewell for now... hehe... *Mizuki glitches*`,6);
    }else{
        await say(channel,success[stage],user);
        enqueue(s,taskText(stage+1,u),stage+1);
    }
}
async function grantStarter(s,tx,guild,user,channel){
    if(s.starterGranted)return false;
    const active=await Promise.all([db.getBoost(guild,user),db.getLuckBoost(guild,user)]);
    if(active.some(b=>Number(b?.expiresat??b?.expiresAt)>Date.now()))return false;
    const inventory=await db.getBoostInventory(guild,user);
    const hasItems=inventory.some(r=>['xp','luck'].includes(r.boosttype??r.boostType)&&Number(r.amount)>0);
    if(hasItems)return false;
    for(const type of ['xp','luck'])await tx.query(`INSERT INTO boost_inventory(guildID,userID,boostType,tier,amount) VALUES($1,$2,$3,'tier1',1)
        ON CONFLICT(guildID,userID,boostType,tier) DO UPDATE SET amount=boost_inventory.amount+1`,[guild,user,type]);
    s.starterGranted=true;
    await say(channel,'Oh... Wait, my bad... *Mizuki snaps her fingers, unleashing 0.0001% of her power, and gives 1 XP Boost I & 1 Luck Boost I.* Here, I gave you some boosts... *Do !boost.*',user);
    return true;
}
async function execute(message){
    const id=message.author.id;
    await message.reply({content:'Would you like Mizuki to guide you through the basics in a private tutorial channel? First completion awards **100,000 XP + 1 Luck Boost II + 1 XP Boost II**. The 50,000-XP task has a **10-minute limit**. Failing it or ending the tutorial costs **up to 100,000 XP (balance cannot go below zero)** and **halves command luck for 1 hour**. Bot downtime does not use the timer. Starter boosts are available once. Idle assistance can activate boosts and buy Chatting Upgrade 1 for 50,000 XP. Nobody is kicked.',
        components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tutorial_accept:${id}`).setLabel('Start tutorial').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`tutorial_decline:${id}`).setLabel('Not now').setStyle(ButtonStyle.Secondary))],allowedMentions:{parse:[]}});
}
async function handleInteraction(i){
    if(!i.isButton?.()||!/^tutorial_(accept|decline|stop):/.test(i.customId))return false;
    const [action,owner]=i.customId.split(':');
    if(i.user.id!==owner){await i.reply({content:'This tutorial belongs to someone else.',flags:64});return true;}
    await i.deferReply({flags:64});await init();
    if(action==='tutorial_decline'){await i.editReply('No problem. Use !tutorial whenever you’re ready.');return true;}
    if(action==='tutorial_stop'){
        await session(i.guildId,owner,async(s,tx)=>{if(s.channelID===i.channelId)await fail(s,tx,i.guildId,owner,i.channel);});
        await i.editReply('Tutorial ended. The disclosed failure penalty applies to an unfinished tutorial.');return true;
    }
    await db.gameTransaction(async tx=>{
        await tx.query(`INSERT INTO bot_tutorials(guild_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[i.guildId,owner]);
        const row=(await tx.query('SELECT * FROM bot_tutorials WHERE guild_id=$1 AND user_id=$2 FOR UPDATE',[i.guildId,owner])).rows[0];
        if(row.completed){await i.editReply('You already completed your tutorial. Keep exploring with !commands!');return;}
        if(row.data.failed){await i.editReply('Your tutorial attempt has ended. The luck penalty expires automatically; you can continue exploring with !commands.');return;}
        if(row.data.channelID){
            const channel=await i.guild.channels.fetch(row.data.channelID).catch(()=>null);
            if(channel){
                if(row.data.cancelled){row.data.cancelled=false;row.data.lastReminder=Date.now();await tx.query('UPDATE bot_tutorials SET data=$3::jsonb WHERE guild_id=$1 AND user_id=$2',[i.guildId,owner,JSON.stringify(row.data)]);}
                await i.editReply(`Your tutorial is in <#${channel.id}>.`);return;
            }
        }
        const channel=await i.guild.channels.create({name:`tutorial-${row.number}`,type:ChannelType.GuildText,topic:`Mizuki tutorial for ${owner}`,permissionOverwrites:[
            {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
            {id:owner,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},
            {id:i.client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.EmbedLinks]}
        ]});
        const s={...row.data,channelID:channel.id,stage:0,cancelled:false,earned:0,createdAt:Date.now()};
        enqueue(s,taskText(1),1);
        try{
            await channel.send({content:`Hello, <@${owner}>. I see that you’re new here. I sense a lot of potential in you.`,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tutorial_stop:${owner}`).setLabel('End tutorial (failure penalty)').setStyle(ButtonStyle.Secondary))],allowedMentions:{users:[owner]}});
            await tx.query('UPDATE bot_tutorials SET data=$3::jsonb WHERE guild_id=$1 AND user_id=$2',[i.guildId,owner,JSON.stringify(s)]);
        }catch(e){await channel.delete('Tutorial setup failed').catch(()=>{});throw e;}
        await i.editReply(`Mizuki is waiting in <#${channel.id}>.`).catch(()=>{});
    });
    return true;
}
async function onMessage(message){
    if(!inRoom(message))return;
    await session(message.guild.id,message.author.id,async(s,tx)=>{
        if(s.channelID!==message.channel.id)return;
        if(s.stage===3&&message.content.trim().toLowerCase()==='!boost')await grantStarter(s,tx,message.guild.id,message.author.id,message.channel);
    });
}
async function onXP(message,amount,kind){
    if(!inRoom(message)||!(Number(amount)>0))return;
    await session(message.guild.id,message.author.id,async s=>{
        if(s.channelID!==message.channel.id)return;
        if((s.stage===1&&kind==='chat')||(s.stage===2&&kind==='command'))return finishTask(s,message.channel,message.author.id);
        if(s.stage===4){s.earned=(Number(s.earned)||0)+Number(amount);if(s.earned>=50000)await finishTask(s,message.channel,message.author.id);}
    });
}
async function tick(client){
    if(ticking||!client.isReady())return;ticking=true;
    try{
        const rows=(await db.gameQuery(`SELECT guild_id,user_id FROM bot_tutorials WHERE completed=FALSE AND COALESCE((data->>'cancelled')::boolean,FALSE)=FALSE AND data ? 'channelID'`)).rows;
        for(const row of rows)await session(row.guild_id,row.user_id,async(s,tx)=>{
            const guild=client.guilds.cache.get(row.guild_id);if(!guild)return;
            const channel=await guild.channels.fetch(s.channelID).catch(()=>null);if(!channel){s.cancelled=true;return;}
            const now=Date.now(),u=`<@${row.user_id}>`;
            if(s.pending){
                if(now<s.pending.at)return;
                const p=s.pending;await say(channel,p.text,row.user_id);delete s.pending;
                s.stage=p.stage;s.lastReminder=now;s.stageStarted=now;s.reminded=false;
                if(s.stage===4){s.earned=0;s.remainingMs=600000;s.clockAt=now;s.clockRun=runID;}
                if(s.stage===6){
                    await db.applyBossRewardBundle(tx,row.guild_id,row.user_id,{xp:100000,boosts:[{boostType:'luck',tier:'tier2',amount:1},{boostType:'xp',tier:'tier2',amount:1}]});
                    s.completed=true;db.invalidateUserCache(row.guild_id,row.user_id);
                    await say(channel,'🎁 First tutorial completed: **100,000 XP · 1 Luck Boost II · 1 XP Boost II**!',row.user_id).catch(e=>console.error('Tutorial reward announcement:',e));
                    return;
                }
            }
            if(s.stage===4){
                const elapsed=s.clockRun===runID?Math.min(10000,Math.max(0,now-(s.clockAt||now))):0;
                s.remainingMs=Math.max(0,(s.remainingMs??600000)-elapsed);s.clockAt=now;s.clockRun=runID;
                if(s.remainingMs===0){await fail(s,tx,row.guild_id,row.user_id,channel);return;}
            }
            if(s.stage===3){
                const active=await Promise.all([db.getBoost(row.guild_id,row.user_id),db.getLuckBoost(row.guild_id,row.user_id)]);
                if(active.some(b=>Number(b?.expiresat??b?.expiresAt)>now)){await finishTask(s,channel,row.user_id);return;}
            }
            if(s.stage===5){const levels=await db.getUserUpgradeLevels(row.guild_id,row.user_id);if(Number(levels.chatting)>=1){await finishTask(s,channel,row.user_id);return;}}
            if(now-(s.lastReminder||now)<idle)return;s.lastReminder=now;
            const reminders={1:`Come on, ${u}. I don’t have all day. Type something interesting about yourself, my beloved ${u}..`,2:`Hellooooooo? ${u}, are you theeere?....`,4:`*Mizuki smiles as she gets annoyed* Keep going, ${u}... **${Math.ceil((s.remainingMs??600000)/60000)} minutes** remain to earn 50,000 XP. Failure means the disclosed XP and luck penalty — not a kick.`};
            if(reminders[s.stage]&&!s.reminded){await say(channel,reminders[s.stage],row.user_id);s.reminded=true;return;}
            if(s.stage===3){
                if(await grantStarter(s,tx,row.guild_id,row.user_id,channel))return;
                const rant=await say(channel,'RAHH! You’re getting on my nerves, you little SH-..',row.user_id);
                setTimeout(()=>rant.delete().catch(()=>{}),1000);
                const member=await guild.members.fetch(row.user_id).catch(()=>null);if(!member){s.cancelled=true;return;}
                // Use available inventory through the normal activation path; never conjure extra items.
                const inventory=await db.getBoostInventory(row.guild_id,row.user_id);
                for(const type of ['xp','luck']){
                    const order=['tier1','tier2','tier3','max','infinity','omega'];
                    const item=inventory.filter(r=>(r.boosttype??r.boostType)===type&&Number(r.amount)>0).sort((a,b)=>order.indexOf(a.tier)-order.indexOf(b.tier))[0];
                    if(item)await (type==='xp'?require('./boosts').activateXPBoostFromInventory:require('../utils/luck').activateLuckBoostFromInventory)(member,item.tier);
                }
                const active=await Promise.all([db.getBoost(row.guild_id,row.user_id),db.getLuckBoost(row.guild_id,row.user_id)]);
                if(active.some(b=>Number(b?.expiresat??b?.expiresAt)>now)){
                    await say(channel,'Here, I activated the boosts myself... It wasn’t so hard now, was it?',row.user_id);
                    await finishTask(s,channel,row.user_id);
                }else await say(channel,'Open !boost and choose a boost to continue. I couldn’t activate one automatically.',row.user_id);
            }
            if(s.stage===5){
                const rant=await say(channel,'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!',row.user_id);
                setTimeout(()=>rant.delete().catch(()=>{}),1000);
                const result=await db.purchaseUserUpgrade(row.guild_id,row.user_id,'chatting',0);
                if(result.status==='level-changed'&&result.level>=1){await finishTask(s,channel,row.user_id);return;}
                if(result.success){await say(channel,'There — I bought Chatting Upgrade 1 using your 50,000 XP.',row.user_id);await finishTask(s,channel,row.user_id);}
                else await say(channel,'You need 50,000 available XP for Chatting Upgrade 1. Earn a little more, then use !upgrades.',row.user_id);
            }
        }).catch(e=>console.error('Tutorial session failed:',e));
    }finally{ticking=false;}
}
async function start(client){await init();if(!timer){timer=setInterval(()=>tick(client).catch(e=>console.error('Tutorial tick failed:',e)),3000);timer.unref?.();}}
module.exports={execute,handleInteraction,onMessage,onXP,start,inRoom,XP_COMMANDS};
