'use strict';
// Owner-configured, persistent events. No side effects at require() time.
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder
} = require('discord.js');
const db = require('../database');
const leveling = require('./leveling');
const {isBotAdmin} = require('../utils/adminAccess');
const {applyBossRewardBundle} = db;

const ATTACK_COOLDOWN_MS = 12_000;
const HOUR = 60 * 60 * 1000;
const ACTION_ID = 'mzk_event_';
const COMMANDS = ['hug', 'kiss', 'steal', 'fight', 'troll', 'ezwin', 'roll', 'coinflip', 'fart', 'bless'];
let setupPromise;
const command = new SlashCommandBuilder()
    .setName('createevent').setDescription('Create a timed event boss or solo event challenge')
    .addStringOption(option => option.setName('typeofevent')
        .setDescription('The type of event to create').setRequired(true)
        .addChoices({name:'Boss Event (global)', value:'bossevent'},
                    {name:'Event Challenge (solo)', value:'challenge'}));

function initialize(){
    if(!setupPromise) setupPromise = (async() => {
        await db.gameQuery(`CREATE TABLE IF NOT EXISTS mzk_events (
            id BIGSERIAL PRIMARY KEY, guild_id TEXT NOT NULL, owner_id TEXT NOT NULL,
            kind TEXT NOT NULL CHECK(kind IN ('bossevent','challenge')),
            title TEXT NOT NULL, description TEXT NOT NULL,
            overall BIGINT NOT NULL, max_hp BIGINT NOT NULL, current_hp BIGINT NOT NULL,
            duration_ms BIGINT NOT NULL, starts_at BIGINT NOT NULL DEFAULT 0,
            expires_at BIGINT NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft',
            first_reward JSONB, replay_reward JSONB,
            cycle INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL
        )`);
        await db.gameQuery(`CREATE INDEX IF NOT EXISTS mzk_events_active_idx ON mzk_events(guild_id,status,expires_at)`);
        await db.gameQuery(`CREATE TABLE IF NOT EXISTS mzk_event_progress (
            event_id BIGINT NOT NULL REFERENCES mzk_events(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL, clears INTEGER NOT NULL DEFAULT 0,
            current_hp BIGINT, last_attack_at BIGINT NOT NULL DEFAULT 0,
            PRIMARY KEY(event_id,user_id)
        )`);
        await db.gameQuery(`CREATE TABLE IF NOT EXISTS mzk_event_contributions (
            event_id BIGINT NOT NULL REFERENCES mzk_events(id) ON DELETE CASCADE,
            cycle INTEGER NOT NULL, user_id TEXT NOT NULL,
            damage BIGINT NOT NULL DEFAULT 0,
            PRIMARY KEY(event_id,cycle,user_id)
        )`);
        await db.gameQuery(`CREATE TABLE IF NOT EXISTS mzk_event_triple_xp (
            guild_id TEXT NOT NULL, user_id TEXT NOT NULL, command_name TEXT NOT NULL,
            expires_at BIGINT NOT NULL,
            PRIMARY KEY(guild_id,user_id,command_name)
        )`);
    })().catch(error=>{setupPromise=null;throw error;});
    return setupPromise;
}

function safeNumber(value, label, max = Number.MAX_SAFE_INTEGER){
    const number = Number(String(value).replace(/,/g,'').trim());
    if(!Number.isSafeInteger(number) || number < 0 || number > max) throw new Error(`${label} must be a whole number between 0 and ${max.toLocaleString()}.`);
    return number;
}
function parseDuration(text){
    const match = String(text||'').trim().match(/^(\d+)(m|h|d)$/i);
    if(!match) throw new Error('Duration must be like 30m, 2h, or 3d (maximum 30 days).');
    const amount=Number(match[1]);
    const unit={m:60000,h:HOUR,d:24*HOUR}[match[2].toLowerCase()];
    const duration=amount*unit;
    if(!Number.isSafeInteger(duration)||duration<5*60000||duration>30*24*HOUR)throw new Error('Duration must be between 5 minutes and 30 days.');
    return duration;
}
function validateRewardJSON(input){
    let value;
    try{ value = JSON.parse(input); }
    catch(_error){throw new Error('Rewards must be valid JSON (see the examples in UPDATE_NOTES.md).');}
    if(!value || typeof value !== 'object' || Array.isArray(value))throw new Error('Each reward must be a JSON object.');
    const keys=new Set(['xp','boosts','chests','unlockFight','unlockBless','unlockCoinflip','counterattack','guaranteedJackpots','spawnBossUses','freeUpgradeTokens','triple']);
    for(const key of Object.keys(value))if(!keys.has(key)) throw new Error(`Unknown reward field: ${key}`);
    if(!Array.isArray(value.boosts||[])||!Array.isArray(value.chests||[]))throw new Error('boosts and chests must be arrays.');
    const out={xp:safeNumber(value.xp ?? 0,'XP',1_000_000_000_000), boosts:[], chests:[]};
    const types={luck:['tier1','tier2','tier3','max','omega'], xp:['tier1','tier2','max','infinity'], rune:['tier1','tier2','tier3']};
    for(const item of value.boosts||[]){
        if(!item || !types[item.boostType]?.includes(item.tier))throw new Error('Invalid boost; use luck/xp/rune and a supported tier.');
        const amount=safeNumber(item.amount ?? 1,'Boost amount',100);
        if(amount<1)throw new Error('Boost amount must be at least 1.');
        out.boosts.push({boostType:item.boostType,tier:item.tier,amount});
    }
    if(out.boosts.length>15)throw new Error('Maximum 15 different boosts per reward.');
    for(const item of value.chests||[]){
        if(!item || !['bronze','gilded','boss'].includes(item.tier))throw new Error('Chest tier must be bronze, gilded, or boss.');
        const amount=safeNumber(item.amount ?? 1,'Chest amount',100);
        if(amount<1)throw new Error('Chest amount must be at least 1.');
        out.chests.push({tier:item.tier,amount});
    }
    if(out.chests.length>5)throw new Error('Maximum 5 chest entries per reward.');
    for(const field of ['unlockFight','unlockBless','unlockCoinflip','counterattack']){
        if(field in value && typeof value[field] !== 'boolean')throw new Error(`${field} must be true or false.`);
        out[field]=value[field]===true;
    }
    out.spawnBossUses=safeNumber(value.spawnBossUses??0,'Spawn boss uses',1);
    out.freeUpgradeTokens=safeNumber(value.freeUpgradeTokens??0,'Free upgrades',100);
    out.guaranteedJackpots=safeNumber(value.guaranteedJackpots??0,'Guaranteed jackpots',1);
    if(value.triple){
        if(typeof value.triple !== 'object' || Array.isArray(value.triple)) throw new Error('triple must be an object.');
        const c=String(value.triple.command||'').toLowerCase().replace(/^!/,'');
        if(![...COMMANDS,'social','all'].includes(c))throw new Error(`Unsupported triple command: ${c}`);
        const hours=Number(value.triple.hours);
        if(!Number.isFinite(hours)||hours<0.25||hours>168)throw new Error('Triple hours must be between 0.25 and 168.');
        out.triple={command:c,durationMs:Math.round(hours*HOUR)};
    }
    return out;
}
function rewardSummary(reward){
    if(!reward) return 'Not configured';
    const extras=[`${Number(reward.xp||0).toLocaleString('en-US')} XP`];
    for(const x of reward.boosts||[])extras.push(`${x.amount}× ${x.boostType}:${x.tier}`);
    for(const x of reward.chests||[])extras.push(`${x.amount}× ${x.tier} chest`);
    for(const name of ['unlockFight','unlockBless','unlockCoinflip','counterattack'])if(reward[name])extras.push(name);
    if(reward.spawnBossUses)extras.push('!spawnboss unlock');
    if(reward.freeUpgradeTokens)extras.push(`${reward.freeUpgradeTokens} free upgrades`);
    if(reward.guaranteedJackpots)extras.push('1 guaranteed jackpot');
    if(reward.triple)extras.push(`3× ${reward.triple.command} for ${Math.round(reward.triple.durationMs/HOUR*100)/100}h`);
    return extras.join(' · ').slice(0,1000);
}
function eventButtons(event, admin=false){
    const row=new ActionRowBuilder();
    if(admin){
        row.addComponents(
            new ButtonBuilder().setCustomId(ACTION_ID+`rewards:${event.id}`).setLabel('Set first / replay rewards').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(ACTION_ID+`publish:${event.id}`).setLabel('Publish event').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(ACTION_ID+`discard:${event.id}`).setLabel('Discard draft').setStyle(ButtonStyle.Danger)
        );
    }else{
        row.addComponents(new ButtonBuilder().setCustomId(ACTION_ID+`attack:${event.id}`)
            .setLabel(event.kind==='challenge'?'Fight solo challenge':'Attack event boss').setStyle(ButtonStyle.Danger));
        row.addComponents(new ButtonBuilder().setCustomId(ACTION_ID+`open:${event.id}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary));
    }
    return [row];
}
function eventPayload(event, admin=false, notice=null){
    const isDraft=event.status==='draft';
    const embed=new EmbedBuilder().setColor(isDraft?0x5865f2:0xe67e22)
        .setTitle(`${event.kind==='challenge'?'Event Challenge':'Boss Event'}: ${event.title}`)
        .setDescription((notice?`${notice}\n\n`:'')+event.description)
        .addFields(
            {name:'OVERALL',value:Number(event.overall).toLocaleString('en-US'),inline:true},
            {name:'HP',value:`${Number(event.current_hp).toLocaleString('en-US')} / ${Number(event.max_hp).toLocaleString('en-US')}`,inline:true},
            {name:'Duration',value:isDraft?`${Math.round(Number(event.duration_ms)/60000)} minutes`:`Ends <t:${Math.floor(Number(event.expires_at)/1000)}:R>`,inline:true},
            {name:'First clear',value:rewardSummary(event.first_reward)},
            {name:'Replay',value:rewardSummary(event.replay_reward)}
        );
    if(event.kind==='bossevent' && !isDraft)embed.addFields({name:'Global defeat cycles',value:String(event.cycle)});
    return {embeds:[embed],components:eventButtons(event,admin),allowedMentions:{parse:[]}};
}
async function getActiveEvent(guildID){
    await initialize();
    const rows=await db.gameQuery(`SELECT * FROM mzk_events WHERE guild_id=$1 AND status='active' AND expires_at>$2 ORDER BY id DESC LIMIT 1`,[String(guildID),Date.now()]);
    return rows.rows[0]||null;
}
async function getById(id, guildID){
    await initialize();
    const rows=await db.gameQuery('SELECT * FROM mzk_events WHERE id=$1 AND guild_id=$2',[id,String(guildID)]);
    return rows.rows[0]||null;
}
function buildCreateModal(kind){
    const modal=new ModalBuilder().setCustomId(ACTION_ID+`create:${kind}`).setTitle(kind==='challenge'?'Create Event Challenge':'Create Boss Event');
    const fields=[
        ['name','Boss / event name','Example: Mizuki — The Eclipse',TextInputStyle.Short,''],
        ['description','Boss description','Describe the boss and the event',TextInputStyle.Paragraph,''],
        ['overall','OVERALL (difficulty)','Example: 100000',TextInputStyle.Short,'100000'],
        ['hp','Total HP','Example: 10000000',TextInputStyle.Short,'10000000'],
        ['duration','Event duration (m / h / d)','Example: 2h or 3d',TextInputStyle.Short,'2h']
    ];
    for(const [id,label,placeholder,style,value] of fields){
        const field=new TextInputBuilder().setCustomId('evt_'+id).setLabel(label).setStyle(style).setRequired(true).setPlaceholder(placeholder).setMaxLength(id==='description'?800:100);
        if(value) field.setValue(value);
        modal.addComponents(new ActionRowBuilder().addComponents(field));
    }
    return modal;
}
function buildRewardsModal(event){
    const modal=new ModalBuilder().setCustomId(ACTION_ID+`save_rewards:${event.id}`).setTitle(`Rewards for event #${event.id}`);
    for(const [name,label,reward] of [['first','First-clear rewards (JSON)',event.first_reward],['replay','Replay rewards (JSON)',event.replay_reward]]){
        const field=new TextInputBuilder().setCustomId('evt_'+name).setLabel(label).setStyle(TextInputStyle.Paragraph)
            .setRequired(true).setMaxLength(4000).setPlaceholder('{"xp":5000000,"boosts":[{"boostType":"luck","tier":"omega","amount":1}]}');
        if(reward)field.setValue(JSON.stringify(reward));
        modal.addComponents(new ActionRowBuilder().addComponents(field));
    }
    return modal;
}
async function deliverReward(tx, event, userID, reward, now){
    const {triple,...base}=reward||{};
    await applyBossRewardBundle(tx,String(event.guild_id),String(userID),base,now);
    if(!triple) return;
    const command=triple.command;
    // The existing game already supports genuine timed triple executions for
    // roll and social commands. Other named commands use a 3x XP payout bonus.
    if(['roll','hug','social','all'].includes(command)){
        await tx.query('INSERT INTO quest_effects(guildID,userID) VALUES($1,$2) ON CONFLICT DO NOTHING',[event.guild_id,userID]);
        if(['roll','all'].includes(command)){
            await tx.query(`UPDATE quest_effects SET multiRollCount=3,multiRollUntil=GREATEST(multiRollUntil,$3)+$4,rollWindowEndsAt=0,rollWindowUses=0 WHERE guildID=$1 AND userID=$2`,[event.guild_id,userID,now,triple.durationMs]);
        }
        if(['social','all'].includes(command)){
            await tx.query(`UPDATE quest_effects SET socialTripleUntil=GREATEST(socialTripleUntil,$3)+$4 WHERE guildID=$1 AND userID=$2`,[event.guild_id,userID,now,triple.durationMs]);
        }
        if(command==='hug'){
            await tx.query(`UPDATE quest_effects SET hugTripleUntil=GREATEST(hugTripleUntil,$3)+$4 WHERE guildID=$1 AND userID=$2`,[event.guild_id,userID,now,triple.durationMs]);
        }
        if(command==='all'){
            // Commands without a native three-execution mechanic get 3x XP
            // on their original outcome; never stack on already-tripled ones.
            await tx.query(`INSERT INTO mzk_event_triple_xp(guild_id,user_id,command_name,expires_at) VALUES($1,$2,'*',$3)
                ON CONFLICT(guild_id,user_id,command_name) DO UPDATE SET expires_at=GREATEST(mzk_event_triple_xp.expires_at,$4)+$5`,
                [event.guild_id,userID,now+triple.durationMs,now,triple.durationMs]);
        }
    }else{
        await tx.query(`INSERT INTO mzk_event_triple_xp(guild_id,user_id,command_name,expires_at) VALUES($1,$2,$3,$4)
            ON CONFLICT(guild_id,user_id,command_name) DO UPDATE SET expires_at=GREATEST(mzk_event_triple_xp.expires_at,$5)+$6`,
            [event.guild_id,userID,command,now+triple.durationMs,now,triple.durationMs]);
    }
}
async function isCommandTripleXP(guild,user,command){
    await initialize();
    const normalized=String(command).replace(/^!/,'').toLowerCase();
    const wildAllowed=!['roll','hug','kiss','steal','ezwin'].includes(normalized);
    const found=await db.gameQuery(`SELECT 1 FROM mzk_event_triple_xp
        WHERE guild_id=$1 AND user_id=$2 AND expires_at>$4
        AND (command_name=$3 OR ($5 AND command_name='*')) LIMIT 1`,
        [String(guild),String(user),normalized,Date.now(),wildAllowed]);
    return found.rowCount>0;
}
async function attackEvent(eventID,guildID,userID){
    await initialize();
    const now=Date.now();
    return db.gameTransaction(async tx => {
        const row=(await tx.query('SELECT * FROM mzk_events WHERE id=$1 AND guild_id=$2 FOR UPDATE',[eventID,String(guildID)])).rows[0];
        if(!row||row.status!=='active'||Number(row.expires_at)<=now)return {status:'expired'};
        await tx.query('INSERT INTO mzk_event_progress(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[row.id,String(userID)]);
        const progress=(await tx.query('SELECT * FROM mzk_event_progress WHERE event_id=$1 AND user_id=$2 FOR UPDATE',[row.id,String(userID)])).rows[0];
        const remaining=Number(progress.last_attack_at)+ATTACK_COOLDOWN_MS-now;
        if(remaining>0)return {status:'cooldown',remaining};
        // Percentage-based damage allows owners to choose a wide range of HP.
        // OVERALL adds resistance, capped so no boss becomes invulnerable.
        const resistance=1+Math.min(2,Number(row.overall)/5_000_000);
        const damage=Math.max(1,Math.floor(Number(row.max_hp)*0.085/resistance*(0.8+Math.random()*0.4)));
        let newHP;
        await tx.query('UPDATE mzk_event_progress SET last_attack_at=$3 WHERE event_id=$1 AND user_id=$2',[row.id,String(userID),now]);
        let awarded=[];
        if(row.kind==='challenge'){
            newHP=Math.max(0,Number(progress.current_hp ?? row.max_hp)-damage);
            if(newHP===0){
                const reward=Number(progress.clears)===0?row.first_reward:row.replay_reward;
                await deliverReward(tx,row,userID,reward,now);
                awarded.push({userID:String(userID),first:Number(progress.clears)===0,reward});
                await tx.query('UPDATE mzk_event_progress SET clears=clears+1,current_hp=$3 WHERE event_id=$1 AND user_id=$2',[row.id,String(userID),row.max_hp]);
            }else{
                await tx.query('UPDATE mzk_event_progress SET current_hp=$3 WHERE event_id=$1 AND user_id=$2',[row.id,String(userID),newHP]);
            }
        }else{
            await tx.query(`INSERT INTO mzk_event_contributions(event_id,cycle,user_id,damage) VALUES($1,$2,$3,$4)
                ON CONFLICT(event_id,cycle,user_id) DO UPDATE SET damage=mzk_event_contributions.damage+EXCLUDED.damage`,
                [row.id,row.cycle,String(userID),Math.min(damage,Number(row.current_hp))]);
            newHP=Math.max(0,Number(row.current_hp)-damage);
            if(newHP===0){
                const contributors=(await tx.query('SELECT user_id,damage FROM mzk_event_contributions WHERE event_id=$1 AND cycle=$2 ORDER BY damage DESC',[row.id,row.cycle])).rows;
                for(const who of contributors){
                    await tx.query('INSERT INTO mzk_event_progress(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[row.id,who.user_id]);
                    const cleared=(await tx.query('SELECT clears FROM mzk_event_progress WHERE event_id=$1 AND user_id=$2 FOR UPDATE',[row.id,who.user_id])).rows[0];
                    const first=Number(cleared.clears)===0;
                    const reward=first?row.first_reward:row.replay_reward;
                    await deliverReward(tx,row,who.user_id,reward,now);
                    await tx.query('UPDATE mzk_event_progress SET clears=clears+1 WHERE event_id=$1 AND user_id=$2',[row.id,who.user_id]);
                    awarded.push({userID:who.user_id,first,reward});
                }
                await tx.query('UPDATE mzk_events SET current_hp=max_hp,cycle=cycle+1 WHERE id=$1',[row.id]);
            }else await tx.query('UPDATE mzk_events SET current_hp=$2 WHERE id=$1',[row.id,newHP]);
        }
        return {status:'ok',event:row,damage,newHP,defeated:newHP===0,awarded};
    });
}
async function handleInteraction(interaction){
    const isSlash=interaction.isChatInputCommand?.() && interaction.commandName==='createevent';
    const id=String(interaction.customId||'');
    if(!isSlash && !id.startsWith(ACTION_ID))return false;
    if(!interaction.guildId){await interaction.reply({content:'Events are server-only.',flags:64});return true;}
    if(isSlash){
        if(!isBotAdmin(interaction.user.id)){await interaction.reply({content:'Only bot administrators can create events.',flags:64});return true;}
        const kind=interaction.options.getString('typeofevent',true);
        await interaction.showModal(buildCreateModal(kind));
        return true;
    }
    const [action,rawID] = id.slice(ACTION_ID.length).split(':');
    if(action==='create' && interaction.isModalSubmit?.()){
        if(!isBotAdmin(interaction.user.id)){await interaction.reply({content:'Not authorized.',flags:64});return true;}
        try{
            const get=key=>interaction.fields.getTextInputValue('evt_'+key).trim();
            const name=get('name'), description=get('description');
            if(name.length<2||name.length>75)throw new Error('Event name must be 2-75 characters.');
            const overall=safeNumber(get('overall'),'OVERALL',1_000_000_000_000);
            const hp=safeNumber(get('hp'),'HP',1_000_000_000_000_000);
            if(hp===0)throw new Error('HP must be greater than zero.');
            const duration=parseDuration(get('duration'));
            await initialize();
            const created=(await db.gameQuery(`INSERT INTO mzk_events(guild_id,owner_id,kind,title,description,overall,max_hp,current_hp,duration_ms,created_at)
                VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9) RETURNING *`,[interaction.guildId,interaction.user.id,rawID,name,description,overall,hp,duration,Date.now()])).rows[0];
            await interaction.reply({...eventPayload(created,true,'Draft saved. Configure rewards, then Publish.'),flags:64});
        }catch(error){await interaction.reply({content:`Could not create event: ${error.message}`,flags:64});}
        return true;
    }
    const event = await getById(rawID,interaction.guildId);
    if(!event){await interaction.reply({content:'Event no longer exists.',flags:64});return true;}
    if(['rewards','save_rewards','publish','discard'].includes(action) && (!isBotAdmin(interaction.user.id)||String(event.owner_id)!==String(interaction.user.id))){
        await interaction.reply({content:'Only the event creator can edit this event.',flags:64});return true;
    }
    if(action==='rewards'){
        if(event.status!=='draft'){await interaction.reply({content:'Only drafts can be edited.',flags:64});return true;}
        await interaction.showModal(buildRewardsModal(event));return true;
    }
    if(action==='save_rewards' && interaction.isModalSubmit?.()){
        try{
            if(event.status!=='draft')throw new Error('The event has already been published.');
            const first=validateRewardJSON(interaction.fields.getTextInputValue('evt_first'));
            const replay=validateRewardJSON(interaction.fields.getTextInputValue('evt_replay'));
            const saved=(await db.gameQuery(`UPDATE mzk_events SET first_reward=$3::jsonb,replay_reward=$4::jsonb
                WHERE id=$1 AND owner_id=$2 AND status='draft' RETURNING *`,
                [event.id,interaction.user.id,JSON.stringify(first),JSON.stringify(replay)])).rows[0];
            if(!saved)throw new Error('Draft is no longer editable.');
            await interaction.reply({...eventPayload(saved,true,'Rewards saved. You can publish the event now.'),flags:64});
        }catch(error){await interaction.reply({content:`Could not save rewards: ${error.message}`,flags:64});}
        return true;
    }
    if(action==='publish'){
        const result=await db.gameTransaction(async tx=>{
            await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`mzk_events:${interaction.guildId}`]);
            const other=(await tx.query(`SELECT id FROM mzk_events WHERE guild_id=$1 AND status='active' AND expires_at>$2 LIMIT 1`,[interaction.guildId,Date.now()])).rows[0];
            if(other)return 'already-active';
            const now=Date.now();
            const update=await tx.query(`UPDATE mzk_events SET status='active',starts_at=$2,expires_at=$2+duration_ms
                 WHERE id=$1 AND status='draft' AND first_reward IS NOT NULL AND replay_reward IS NOT NULL RETURNING *`,[event.id,now]);
            return update.rows[0]||'not-ready';
        });
        if(typeof result==='string'){await interaction.reply({content:result==='already-active'?'Another event is already active. Finish or let it expire first.':'Configure both reward sets before publishing.',flags:64});return true;}
        await interaction.reply({...eventPayload(result,false,'Event published! Members can find it through `!boss`.'),flags:64});return true;
    }
    if(action==='discard'){
        const removed=await db.gameQuery("DELETE FROM mzk_events WHERE id=$1 AND owner_id=$2 AND status='draft'",[event.id,interaction.user.id]);
        await interaction.reply({content:removed.rowCount?'Draft discarded.':'Published events cannot be discarded using this button.',flags:64});return true;
    }
    if(action==='open'){
        if(event.status!=='active'||Number(event.expires_at)<=Date.now()){
            await interaction.reply({content:'This event has ended.',flags:64});return true;
        }
        let visible=event;
        if(event.kind==='challenge'){
            const progress=(await db.gameQuery('SELECT current_hp FROM mzk_event_progress WHERE event_id=$1 AND user_id=$2',[event.id,interaction.user.id])).rows[0];
            visible={...event,current_hp:progress?.current_hp??event.max_hp};
        }
        await interaction.reply({...eventPayload(visible,false),flags:64});return true;
    }
    if(action==='attack'){
        await interaction.deferReply({flags:64});
        const result=await attackEvent(event.id,interaction.guildId,interaction.user.id);
        if(result.status==='expired'){await interaction.editReply('This event has ended.');return true;}
        if(result.status==='cooldown'){await interaction.editReply(`Attack recovering — try again in ${Math.ceil(result.remaining/1000)} seconds.`);return true;}
        const {damage,newHP,defeated,awarded}=result;
        const line=defeated ? `**${event.title} was defeated!** ${event.kind==='bossevent'?'Another round begins while the event lasts.':'You can replay the challenge.'}`
            : `Boss HP remaining: **${newHP.toLocaleString('en-US')}**.`;
        const prize=awarded.find(item=>item.userID===interaction.user.id);
        await interaction.editReply(`You dealt **${damage.toLocaleString('en-US')} damage** to **${event.title}**.\n${line}${prize?`\n**${prize.first?'First-clear':'Replay'} rewards:** ${rewardSummary(prize.reward)}`:''}\nUse the Event button in \`!boss\` to attack again.`);
        if(defeated){
            await Promise.allSettled(awarded.map(item=>leveling.syncLevelAndAnnounce(interaction.client,interaction.guildId,item.userID)));
            if(event.kind==='bossevent'){
                const top=awarded.slice(0,10).map(item=>`<@${item.userID}> — ${item.first?'First clear':'Replay'}`).join('\n');
                await interaction.channel.send({content:`**Event boss ${event.title} defeated!**\n${top}\nAnother wave begins until <t:${Math.floor(Number(event.expires_at)/1000)}:R>.`,allowedMentions:{parse:[]}}).catch(()=>{});
            }
        }
        return true;
    }
    return false;
}
module.exports={initialize,command,getActiveEvent,eventPayload,handleInteraction,validateRewardJSON,parseDuration,isCommandTripleXP,attackEvent,ATTACK_COOLDOWN_MS};
