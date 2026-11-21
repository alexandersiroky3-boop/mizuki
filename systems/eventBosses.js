'use strict';
// Owner-configured, persistent events. No side effects at require() time.
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, StringSelectMenuBuilder
} = require('discord.js');
const db = require('../database');
const leveling = require('./leveling');
const {isBotAdmin} = require('../utils/adminAccess');
const {ADVANTAGE_NAMES} = require('./bossRoster');
const {applyBossRewardBundle} = db;

// Damage is earned XP, not a clickable attack. No event attack cooldown.
const HOUR = 60 * 60 * 1000;
const ACTION_ID = 'mzk_event_';
const COMMANDS = ['hug', 'kiss', 'steal', 'fight', 'troll', 'ezwin', 'roll', 'coinflip', 'fart', 'bless'];
let setupPromise;
const lastGlobalPanelRefresh=new Map();
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
            advantages JSONB NOT NULL DEFAULT '[]'::jsonb,
            ability_state JSONB NOT NULL DEFAULT '{}'::jsonb,
            cycle INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL,
            total_damage BIGINT NOT NULL DEFAULT 0,
            last_earned_xp BIGINT NOT NULL DEFAULT 0,
            last_damage BIGINT NOT NULL DEFAULT 0,
            last_attacker_id TEXT,
            last_hit_at BIGINT NOT NULL DEFAULT 0,
            last_source TEXT,
            last_defenses JSONB NOT NULL DEFAULT '[]'::jsonb
        )`);
        await db.gameQuery("ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS advantages JSONB NOT NULL DEFAULT '[]'::jsonb");
        await db.gameQuery("ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS ability_state JSONB NOT NULL DEFAULT '{}'::jsonb");
        // Persist hits across wave resets so an instant kill cannot look like zero damage.
        await db.gameQuery('ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS total_damage BIGINT NOT NULL DEFAULT 0');
        await db.gameQuery('ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS last_earned_xp BIGINT NOT NULL DEFAULT 0');
        await db.gameQuery('ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS last_damage BIGINT NOT NULL DEFAULT 0');
        await db.gameQuery('ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS last_attacker_id TEXT');
        await db.gameQuery('ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS last_hit_at BIGINT NOT NULL DEFAULT 0');
        await db.gameQuery('ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS last_source TEXT');
        await db.gameQuery("ALTER TABLE mzk_events ADD COLUMN IF NOT EXISTS last_defenses JSONB NOT NULL DEFAULT '[]'::jsonb");
        await db.gameQuery(`CREATE INDEX IF NOT EXISTS mzk_events_active_idx ON mzk_events(guild_id,status,expires_at)`);
        await db.gameQuery(`CREATE TABLE IF NOT EXISTS mzk_event_progress (
            event_id BIGINT NOT NULL REFERENCES mzk_events(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL, clears INTEGER NOT NULL DEFAULT 0,
            current_hp BIGINT, last_attack_at BIGINT NOT NULL DEFAULT 0,
            ability_state JSONB NOT NULL DEFAULT '{}'::jsonb,
            PRIMARY KEY(event_id,user_id)
        )`);
        await db.gameQuery("ALTER TABLE mzk_event_progress ADD COLUMN IF NOT EXISTS ability_state JSONB NOT NULL DEFAULT '{}'::jsonb");
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
    const keys=new Set(['xp','boosts','chests','unlockFight','unlockBless','unlockCoinflip','unlockFart','counterattack','guaranteedJackpots','spawnBossUses','freeUpgradeTokens','triple']);
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
    for(const field of ['unlockFight','unlockBless','unlockCoinflip','unlockFart','counterattack']){
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
    for(const name of ['unlockFight','unlockBless','unlockCoinflip','unlockFart','counterattack'])if(reward[name])extras.push(name);
    if(reward.spawnBossUses)extras.push('!spawnboss unlock');
    if(reward.freeUpgradeTokens)extras.push(`${reward.freeUpgradeTokens} free upgrades`);
    if(reward.guaranteedJackpots)extras.push('1 guaranteed jackpot');
    if(reward.triple)extras.push(`3× ${reward.triple.command} for ${Math.round(reward.triple.durationMs/HOUR*100)/100}h`);
    return extras.join(' · ').slice(0,1000);
}
function parseAdvantages(input){
    const raw=String(input||'').trim();
    if(!raw || /^none$/i.test(raw))return [];
    const chosen=new Set();
    return raw.split(/[\s,;]+/).filter(Boolean).map(item=>{
        const mastered=item.endsWith('*');
        const key=mastered?item.slice(0,-1):item;
        if(!Object.hasOwn(ADVANTAGE_NAMES,key))throw new Error(`Unknown advantage: ${key}. Use names listed in the editor.`);
        if(chosen.has(key))throw new Error(`Duplicate advantage: ${key}`);
        chosen.add(key);
        return {key,name:ADVANTAGE_NAMES[key],mastered};
    });
}
function formatAdvantages(items){
    return Array.isArray(items)&&items.length
        ? items.map(a=>`${a.name||ADVANTAGE_NAMES[a.key]||a.key}${a.mastered?' (Mastered)':''}`).join(' · ').slice(0,1000)
        : 'None';
}
function buildAdvantagesModal(event){
    const modal=new ModalBuilder().setCustomId(ACTION_ID+`save_advantages:${event.id}`).setTitle('Boss advantages');
    const field=new TextInputBuilder().setCustomId('evt_advantages')
        .setLabel('Advantages (add * for mastered)')
        .setStyle(TextInputStyle.Paragraph).setRequired(false)
        .setPlaceholder('Examples: durability*, power, precision*')
        .setMaxLength(1500);
    const selected=(event.advantages||[]).map(a=>a.key+(a.mastered?'*':'')).join(', ');
    if(selected)field.setValue(selected);
    // Show all supported advantage keys in the modal without a separate document.
    modal.addComponents(new ActionRowBuilder().addComponents(field));
    return modal;
}
function eventButtons(event, admin=false){
    const row=new ActionRowBuilder();
    if(admin){
        if(event.status==='draft'){
            row.addComponents(
                new ButtonBuilder().setCustomId(ACTION_ID+`rewards:${event.id}`).setLabel('Edit rewards').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(ACTION_ID+`advantages:${event.id}`).setLabel('Set advantages').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(ACTION_ID+`publish:${event.id}`).setLabel('Publish event').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(ACTION_ID+`discard:${event.id}`).setLabel('Discard draft').setStyle(ButtonStyle.Danger)
            );
        }else{
            // Owners can change advantages on already-running events, too.
            row.addComponents(
                new ButtonBuilder().setCustomId(ACTION_ID+`advantages:${event.id}`)
                    .setLabel('Edit live advantages').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(ACTION_ID+`rewards:${event.id}`)
                    .setLabel('Edit rewards').setStyle(ButtonStyle.Primary)
            );
        }
    }else{
        row.addComponents(new ButtonBuilder().setCustomId(ACTION_ID+`refresh:${event.id}`).setLabel('Refresh event').setStyle(ButtonStyle.Primary));
        if(event.kind==='challenge')row.addComponents(new ButtonBuilder().setCustomId(ACTION_ID+`myprogress:${event.id}`).setLabel('My challenge progress').setStyle(ButtonStyle.Secondary));
        if(event.status==='active')row.addComponents(new ButtonBuilder().setCustomId(ACTION_ID+`manage:${event.id}`)
            .setLabel('Owner: manage event').setStyle(ButtonStyle.Secondary));
    }
    return [row];
}
// Use the exact same 16-segment, custom-emoji health bar as the raid boss.
// The import is delayed because commands/boss also imports this event module.
function eventHealthBar(guild, current, maximum){
    return require('../commands/boss').buildHealthBar(guild,current,maximum);
}
function eventAdvantageStatuses(event,now=Date.now()){
    const state=event.ability_state||{};
    const passive=new Set(['chatting_immunity','critical_immunity','chatting_immortality',
        'critical_immortality','commands_immunity','commands_immortality','rolling_immunity','degeneration']);
    return (event.advantages||[]).map(item=>{
        const key=item.key;
        let status='INACTIVE';
        if(passive.has(key))status='ACTIVE';
        else if(key==='precision')status=Number(state.precisionCooldownUntil||0)>now
            ? `COOLDOWN until <t:${Math.floor(Number(state.precisionCooldownUntil)/1000)}:R>`:'READY';
        else if(key==='manipulation'){
            const until=Math.max(0,...Object.values(state.manipulations||{}).map(x=>Number(x.until)||0));
            status=until>now?`ACTIVE until <t:${Math.floor(until/1000)}:R>`:
                Number(state.manipulationCooldownUntil||0)>now
                    ?`COOLDOWN until <t:${Math.floor(Number(state.manipulationCooldownUntil)/1000)}:R>`:'READY';
        }else{
            const timed={durability:'durabilityUntil',regeneration:'regenerationActiveUntil',
                xp_immortality:'immortalityActiveUntil',power:'powerUntil',fury:'furyActiveUntil'}[key];
            const until=Number(state[timed]||0);
            if(timed&&until>now)status=`ACTIVE until <t:${Math.floor(until/1000)}:R>`;
            else if(key==='power'&&state.powerTriggered||key==='fury'&&state.furyTriggered)status='USED';
            else{
                const cooldown={durability:'durabilityCooldownUntil',regeneration:'regenerationCooldownUntil',
                    xp_immortality:'immortalityCooldownUntil'}[key];
                if(cooldown&&Number(state[cooldown]||0)>now)
                    status=`COOLDOWN until <t:${Math.floor(Number(state[cooldown])/1000)}:R>`;
                else status='READY';
            }
        }
        return `• **${item.name||ADVANTAGE_NAMES[key]||key}**${item.mastered?' *(mastered)*':''} — **${status}**`;
    }).join('\n')||'None';
}
function eventPayload(event, admin=false, notice=null, guild=null){
    const isDraft=event.status==='draft';
    const activePower=(event.advantages||[]).find(a=>a.key==='power');
    const maxHPForDisplay=activePower && Number(event.ability_state?.powerUntil||0)>Date.now()
        ? Math.round(Number(event.max_hp)*(activePower.mastered?1.15:1.05))
        : Number(event.max_hp);
    const currentHP=Math.max(0,Math.min(maxHPForDisplay,Number(event.current_hp)));
    const hpRatio=currentHP/Math.max(1,maxHPForDisplay);
    const color=isDraft?0x5865f2:hpRatio>.6?0x43B581:hpRatio>.25?0xFAA61A:0xED4245;
    const type=event.kind==='challenge'?'EVENT CHALLENGE':'EVENT RAID BOSS';
    const hitTime=Number(event.last_hit_at)||0;
    const lastHit=hitTime>0
        ? `<@${event.last_attacker_id}> earned **${Number(event.last_earned_xp||0).toLocaleString('en-US')} XP** and dealt **${Number(event.last_damage||0).toLocaleString('en-US')} damage** (<t:${Math.floor(hitTime/1000)}:R>)`+
            ((event.last_defenses||[]).length?`\nDefenses triggered: ${(event.last_defenses||[]).join(', ')}`:'')
        : 'No XP hits recorded yet';
    const leaders=(event._contributors||[]).map((c,i)=>`**#${i+1}** <@${c.user_id}> — **${Number(c.damage).toLocaleString('en-US')} damage**`).join('\n')||'No damage recorded this wave yet';
    const embed=new EmbedBuilder().setColor(color)
        .setTitle(isDraft?`${type} — DRAFT`:`${type} — LIVE STATUS`)
        .setDescription(`${notice?notice+'\n\n':''}## ${event.title}\n*${event.description}*\n\n`+
            `${eventHealthBar(guild,currentHP,maxHPForDisplay)}\n`+
            `**${currentHP.toLocaleString('en-US')} / ${maxHPForDisplay.toLocaleString('en-US')} HP**`)
        .addFields(
            {name:'OVERALL',value:`**${Number(event.overall).toLocaleString('en-US')}**`,inline:true},
            {name:'Wave',value:event.kind==='bossevent'?`**${Number(event.cycle||0)+1}**`:'Individual challenge',inline:true},
            {name:'Info',value:`*${event.description.slice(0,800)}*`},
            {name:'Advantages — live status',value:eventAdvantageStatuses(event).slice(0,1024)},
            {name:'First-clear rewards',value:rewardSummary(event.first_reward)},
            {name:'Replay rewards',value:rewardSummary(event.replay_reward)},
            {name:'Timer',value:isDraft?`${Math.round(Number(event.duration_ms)/60000)} minutes (not started)`:
                `Ends <t:${Math.floor(Number(event.expires_at)/1000)}:R> • <t:${Math.floor(Number(event.expires_at)/1000)}:T>`}
        );
    if(event.kind==='bossevent'&&!isDraft){
        embed.addFields(
            {name:'Top 3 damage — current wave',value:leaders.slice(0,1024)},
            {name:'Last XP hit',value:lastHit.slice(0,1024)},
            {name:'Total event damage (all waves)',value:`**${Number(event.total_damage||0).toLocaleString('en-US')}**`}
        );
    }
    if(isDraft)embed.addFields({name:'Advantage keys',value:Object.keys(ADVANTAGE_NAMES).join(', ').slice(0,1000)});
    embed.setFooter({text:'Mizuki Event Boss • XP damage • Live Status'});
    return {embeds:[embed],components:eventButtons(event,admin),allowedMentions:{parse:[]}};
}
// Fetch top contributors only for public display; the XP hook does a cheap
// single-row lookup and never queries the leaderboard on every chat message.
async function withContributors(event){
    if(event?.kind==='bossevent'&&event.status==='active'){
        const rows=await db.gameQuery(`SELECT user_id,damage FROM mzk_event_contributions
            WHERE event_id=$1 AND cycle=$2 ORDER BY damage DESC LIMIT 3`,[event.id,event.cycle]);
        event._contributors=rows.rows;
    }
    return event;
}
async function getActiveEvent(guildID,includeContributors=false){
    await initialize();
    const rows=await db.gameQuery(`SELECT * FROM mzk_events WHERE guild_id=$1 AND status='active' AND expires_at>$2 ORDER BY id DESC LIMIT 1`,[String(guildID),Date.now()]);
    const event=rows.rows[0]||null;
    return includeContributors?withContributors(event):event;
}
async function getById(id,guildID,includeContributors=false){
    await initialize();
    const rows=await db.gameQuery('SELECT * FROM mzk_events WHERE id=$1 AND guild_id=$2',[id,String(guildID)]);
    const event=rows.rows[0]||null;
    return includeContributors?withContributors(event):event;
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
// Rewards are edited through Discord buttons, dropdowns and small input modals.
// The bundles themselves use the original database format/reward delivery code.
const REWARD_SLOTS={first:'first_reward',replay:'replay_reward'};
const REWARD_FIELDS={
    unlockFight:'Unlock !fight',unlockBless:'Unlock !bless',
    unlockCoinflip:'Unlock !coinflip',unlockFart:'Unlock !fart',
    counterattack:'Unlock counterattack'
};
const BOOST_OPTIONS=[
    ...['tier1','tier2','tier3','max','omega'].map(tier=>({boostType:'luck',tier})),
    ...['tier1','tier2','max','infinity'].map(tier=>({boostType:'xp',tier})),
    ...['tier1','tier2','tier3'].map(tier=>({boostType:'rune',tier}))
];
const EXTRA_FIELDS={
    freeUpgradeTokens:{label:'Free upgrade tokens',maximum:100},
    spawnBossUses:{label:'Unlock !spawnboss',maximum:1},
    guaranteedJackpots:{label:'Guaranteed jackpot',maximum:1}
};
function normalizedReward(value){
    return value || validateRewardJSON('{}');
}
function slotReward(event,slot){return normalizedReward(event[REWARD_SLOTS[slot]]);}
function editorButton(id,text,style=ButtonStyle.Secondary){
    return new ButtonBuilder().setCustomId(id).setLabel(text).setStyle(style);
}
function rewardDashboardPayload(event){
    const embed=new EmbedBuilder().setColor(0x5865f2)
        .setTitle(`Event #${event.id} — reward editor`)
        .setDescription('Pick a reward set. Use buttons and dropdowns to adjust it; every change saves automatically. No JSON needed. First-clear rewards are separate from replay rewards.')
        .addFields(
            {name:'First-clear rewards',value:rewardSummary(event.first_reward)},
            {name:'Replayable rewards',value:rewardSummary(event.replay_reward)}
        );
    const row=new ActionRowBuilder().addComponents(
        editorButton(`${ACTION_ID}reward_open:${event.id}:first`,'First clear',ButtonStyle.Primary),
        editorButton(`${ACTION_ID}reward_open:${event.id}:replay`,'Replayable',ButtonStyle.Primary),
        editorButton(`${ACTION_ID}reward_home:${event.id}`,'Back to event')
    );
    return {embeds:[embed],components:[row],allowedMentions:{parse:[]}};
}
function rewardEditorPayload(event,slot,notice=''){
    const reward=slotReward(event,slot);
    const label=slot==='first'?'First-clear':'Replayable';
    const embed=new EmbedBuilder().setColor(0x5865f2)
        .setTitle(`${label} rewards — ${event.title}`)
        .setDescription(`${notice?notice+'\n\n':''}**Saved reward bundle**\n${rewardSummary(reward)}\n\nChoose what to edit below. Set an amount to **0** to remove it; selecting an unlocked command toggles it off. Changes save immediately.`);
    const row1=new ActionRowBuilder().addComponents(
        editorButton(`${ACTION_ID}reward_xp:${event.id}:${slot}`,'Set XP',ButtonStyle.Primary),
        editorButton(`${ACTION_ID}reward_menu:${event.id}:${slot}:boost`,'Boosts'),
        editorButton(`${ACTION_ID}reward_menu:${event.id}:${slot}:chest`,'Chests'),
        editorButton(`${ACTION_ID}reward_menu:${event.id}:${slot}:unlock`,'Command unlocks'),
        editorButton(`${ACTION_ID}reward_menu:${event.id}:${slot}:triple`,'3× Command')
    );
    const row2=new ActionRowBuilder().addComponents(
        editorButton(`${ACTION_ID}reward_menu:${event.id}:${slot}:extra`,'Other rewards'),
        editorButton(`${ACTION_ID}reward_reset:${event.id}:${slot}`,'Clear all',ButtonStyle.Danger),
        editorButton(`${ACTION_ID}reward_back:${event.id}`,'Back to reward sets')
    );
    return {embeds:[embed],components:[row1,row2],allowedMentions:{parse:[]}};
}
function rewardMenuPayload(event,slot,type){
    const reward=slotReward(event,slot);
    let choices,heading,description;
    if(type==='boost'){
        heading='Choose boost or power rune';
        description='Select an item, then enter its quantity. Enter 0 to remove it.';
        choices=BOOST_OPTIONS.map(x=>{
            const current=(reward.boosts||[]).find(b=>b.boostType===x.boostType&&b.tier===x.tier);
            return {label:`${x.boostType==='rune'?'Power rune':x.boostType==='luck'?'Luck boost':'XP boost'} — ${x.tier}`,
                description:current?`Currently: ${current.amount}`:'Not added',value:`${x.boostType}_${x.tier}`};
        });
    }else if(type==='chest'){
        heading='Choose chest';description='Select a chest tier, then enter a quantity (0 removes it).';
        choices=['bronze','gilded','boss'].map(tier=>({label:`${tier[0].toUpperCase()+tier.slice(1)} chest`,
            description:`Currently: ${(reward.chests||[]).find(x=>x.tier===tier)?.amount||0}`,value:tier}));
    }else if(type==='unlock'){
        heading='Choose command to unlock';description='Select a command to toggle its permanent unlock reward on or off.';
        choices=Object.entries(REWARD_FIELDS).map(([field,label])=>({label,description:reward[field]?'Included — select to remove':'Not included — select to add',value:field}));
    }else if(type==='triple'){
        heading='Choose 3× command reward';description='Choose a command, then set hours (0 removes the reward).';
        choices=[...COMMANDS,'social','all'].map(c=>({label:`3× ${c}`,value:c,description:reward.triple?.command===c?'Currently selected':'Duration: 0.25–168 hours'}));
        choices.unshift({label:'Remove 3× command',value:'remove',description:'Remove the current timed triple reward'});
    }else if(type==='extra'){
        heading='Choose other reward';description='Select an item and enter its quantity (0 removes it).';
        choices=Object.entries(EXTRA_FIELDS).map(([field,meta])=>({label:meta.label,
            description:`Currently: ${reward[field]||0}`,value:field}));
    }else throw new Error('Unknown reward category.');
    const embed=new EmbedBuilder().setColor(0x5865f2).setTitle(heading)
        .setDescription(description);
    const select=new StringSelectMenuBuilder().setCustomId(`${ACTION_ID}reward_pick:${event.id}:${slot}:${type}`)
        .setPlaceholder('Select a reward to edit').addOptions(choices);
    return {embeds:[embed],components:[
        new ActionRowBuilder().addComponents(select),
        new ActionRowBuilder().addComponents(editorButton(`${ACTION_ID}reward_open:${event.id}:${slot}`,'Back to rewards'))
    ],allowedMentions:{parse:[]}};
}
function rewardAmountModal(event,slot,type,key){
    const bundle=slotReward(event,slot);
    let title,label,existing='0',placeholder='Enter 0 to remove';
    if(type==='xp'){
        title='Set XP reward';label='XP amount (0 to remove)';existing=String(bundle.xp||0);
    }else if(type==='boost'){
        const item=BOOST_OPTIONS.find(x=>`${x.boostType}_${x.tier}`===key);
        if(!item)throw new Error('Invalid boost tier.');
        title='Set boost quantity';label=`${item.boostType} ${item.tier} (0–100)`;
        existing=String(bundle.boosts?.find(x=>x.boostType===item.boostType&&x.tier===item.tier)?.amount||0);
    }else if(type==='chest'){
        if(!['bronze','gilded','boss'].includes(key))throw new Error('Invalid chest tier.');
        title='Set chest quantity';label=`${key} chest (0–100)`;
        existing=String(bundle.chests?.find(x=>x.tier===key)?.amount||0);
    }else if(type==='extra'){
        if(!EXTRA_FIELDS[key])throw new Error('Unknown extra reward.');
        title='Set other reward';label=`${EXTRA_FIELDS[key].label} (0–${EXTRA_FIELDS[key].maximum})`;
        existing=String(bundle[key]||0);
    }else if(type==='triple'){
        if(![...COMMANDS,'social','all'].includes(key))throw new Error('Unknown command.');
        title='Set 3× command duration';label='Duration in hours (0 removes)';placeholder='0.25 to 168 hours, or 0';
        existing=bundle.triple?.command===key?String(Number(bundle.triple.durationMs)/HOUR):'1';
    }else throw new Error('Unknown reward editor.');
    const input=new TextInputBuilder().setCustomId('reward_amount').setLabel(label).setStyle(TextInputStyle.Short)
        .setRequired(true).setMaxLength(22).setPlaceholder(placeholder).setValue(existing);
    return new ModalBuilder().setTitle(title)
        .setCustomId(`${ACTION_ID}reward_set:${event.id}:${slot}:${type}:${key||'value'}`)
        .addComponents(new ActionRowBuilder().addComponents(input));
}
function editableReward(reward){
    const value=structuredClone(reward||{});
    if(value.triple){value.triple={command:value.triple.command,hours:value.triple.durationMs/HOUR};}
    return value;
}
async function changeReward(event,slot,mutator){
    const col=REWARD_SLOTS[slot];
    if(!col)throw new Error('Unknown reward set.');
    return db.gameTransaction(async tx=>{
        const result=await tx.query(`SELECT * FROM mzk_events WHERE id=$1 AND owner_id=$2 AND guild_id=$3 AND status IN ('draft','active') FOR UPDATE`,
            [event.id,event.owner_id,event.guild_id]);
        const latest=result.rows[0];
        if(!latest)throw new Error('Event can no longer be edited.');
        const value=editableReward(latest[col]);
        mutator(value);
        const normalized=validateRewardJSON(JSON.stringify(value));
        const update=await tx.query(`UPDATE mzk_events SET ${col}=$2::jsonb WHERE id=$1 RETURNING *`,
            [event.id,JSON.stringify(normalized)]);
        return update.rows[0];
    });
}
function applyAmountEdit(value,type,key,amountText){
    if(type==='xp'){
        value.xp=safeNumber(amountText,'XP',1_000_000_000_000);
    }else if(type==='boost'){
        const item=BOOST_OPTIONS.find(x=>`${x.boostType}_${x.tier}`===key);
        if(!item)throw new Error('Invalid boost tier.');
        const qty=safeNumber(amountText,'Boost quantity',100);
        value.boosts=(value.boosts||[]).filter(x=>x.boostType!==item.boostType||x.tier!==item.tier);
        if(qty)value.boosts.push({...item,amount:qty});
    }else if(type==='chest'){
        if(!['bronze','gilded','boss'].includes(key))throw new Error('Invalid chest.');
        const qty=safeNumber(amountText,'Chest quantity',100);
        value.chests=(value.chests||[]).filter(x=>x.tier!==key);
        if(qty)value.chests.push({tier:key,amount:qty});
    }else if(type==='extra'){
        const meta=EXTRA_FIELDS[key];if(!meta)throw new Error('Unknown extra reward.');
        value[key]=safeNumber(amountText,meta.label,meta.maximum);
    }else if(type==='triple'){
        if(![...COMMANDS,'social','all'].includes(key))throw new Error('Invalid command.');
        const hours=Number(amountText);
        if(!Number.isFinite(hours)||hours<0||hours>168||(hours!==0&&hours<0.25))
            throw new Error('Duration must be 0 (remove) or 0.25 to 168 hours.');
        if(hours===0)delete value.triple;
        else value.triple={command:key,hours};
    }else throw new Error('Unknown reward type.');
}
async function rewardEditorResponse(interaction,event,slot,notice){
    const payload=rewardEditorPayload(event,slot,notice);
    if(interaction.message && typeof interaction.update==='function')await interaction.update(payload);
    else await interaction.reply({...payload,flags:64});
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
// Event bosses use the EXACT same source signal as the normal raid-boss system:
// XP earned from chat or commands. A button can only inspect progress.
// Existing advantage names, mastery flags and combat percentages are reused.
function calculateEventHit(event, previousHP, rawState, attack, now=Date.now(), random=Math.random){
    const advantages=Array.isArray(event.advantages)?event.advantages:[];
    const get=key=>advantages.find(a=>a.key===key);
    const state={...(rawState||{})};
    const baseMaxHP=Math.max(1,Number(event.max_hp));
    const power=get('power');
    const poweredMaxHP=power?Math.round(baseMaxHP*(power.mastered?1.15:1.05)):baseMaxHP;
    const powered=Boolean(power && Number(state.powerUntil||0)>now);
    let maxHP=powered?poweredMaxHP:baseMaxHP;
    const rawOverall=Math.max(0,Number(event.overall)||0);
    const startingBonus=Math.min(100,rawOverall/Math.max(1,10_000_000-rawOverall/20));
    const overall=powered?rawOverall*(1+((power.mastered?15:10)+startingBonus)/100):rawOverall;
    const overallBonus=Math.min(100,overall/Math.max(1,10_000_000-overall/20));
    const source=attack.source;
    const isChat=source==='chat',isCommand=!isChat;
    const critical=Boolean(attack.critical);
    const xp=Math.max(-Number.MAX_SAFE_INTEGER,Math.min(Number.MAX_SAFE_INTEGER,Math.trunc(Number(attack.earnedXP)||0)));
    let hp=Math.max(0,Math.min(powered||!state.powerUntil?maxHP:poweredMaxHP,Number(previousHP)));
    // Native Power rescales current HP when its temporary max-HP buff ends.
    if(power && state.powerUntil && !powered){
        hp=Math.min(baseMaxHP,Math.round(hp*baseMaxHP/poweredMaxHP));
        state.powerUntil=0;
    }
    const tags=[];
    const chance=p=>random()*100<p;
    // Native boss regen/immortality effects heal as time passes. Catch up
    // elapsed whole seconds when the next XP event arrives (restart-safe).
    const healTimed=(untilKey,tickKey,rate)=>{
        const until=Number(state[untilKey]||0),last=Number(state[tickKey]||0);
        if(until<=0||last<=0)return;
        const seconds=Math.max(0,Math.floor((Math.min(now,until)-last)/1000));
        if(seconds){hp=Math.min(maxHP,hp+seconds*rate);state[tickKey]=last+seconds*1000;}
    };
    const regen=get('regeneration');
    if(regen)healTimed('regenerationActiveUntil','regenerationLastTickAt',Math.floor((regen.mastered?1000:500)+maxHP/10000));
    const immortality=get('xp_immortality');
    if(immortality)healTimed('immortalityActiveUntil','immortalityLastTickAt',Math.floor((immortality.mastered?50000:25000)+maxHP/5000));
    if(xp<0){
        hp=Math.min(maxHP,hp+Math.abs(xp));
        return {damage:0,remaining:hp,state,advantagesTriggered:tags};
    }
    if(xp===0)return {damage:0,remaining:hp,state,advantagesTriggered:tags};
    let baseXP=xp;
    const deg=get('degeneration');
    if(deg){
        const neutral=Math.max(0,Number(attack.xpWithoutLuck??xp)||0);
        const luckBonus=Math.max(0,baseXP-neutral);
        baseXP=Math.floor(Math.max(0,baseXP-luckBonus*(deg.mastered?.35:.25)));
    }
    // Mastered immortality heals for 10% instead of damage; same as raids.
    const blocking=isCommand?get('commands_immortality'):
        [get('chatting_immortality'),critical?get('critical_immortality'):null]
            .filter(Boolean).sort((a,b)=>Number(b.mastered)-Number(a.mastered))[0];
    if(blocking){
        if(blocking.mastered)hp=Math.min(maxHP,hp+Math.floor(baseXP*.1));
        tags.push(blocking.key);
        return {damage:0,remaining:hp,state,advantagesTriggered:tags};
    }
    if(immortality && Number(state.immortalityActiveUntil)>now){
        if(immortality.mastered)hp=Math.min(maxHP,hp+baseXP);
        tags.push('xp_immortality');
        return {damage:0,remaining:hp,state,advantagesTriggered:tags};
    }
    const manipulation=get('manipulation');
    if(manipulation && Number(state.manipulationCooldownUntil||0)<=now && chance(manipulation.mastered?30:15)){
        const duration=(manipulation.mastered?120:60)*1000;
        state.manipulationCooldownUntil=now+duration+(manipulation.mastered?120:240)*1000;
        // The real boss simulates a possessed player's command every ten seconds.
        // Event combat tracks its equivalent healing separately, never sends a
        // command on a player's behalf or touches their XP/inventory.
        state.manipulations||={};
        state.manipulations[String(attack.userID)]={until:now+duration,lastTick:now,healPerTurn:baseXP};
        tags.push('manipulation');
        return {damage:0,remaining:hp,state,advantagesTriggered:tags};
    }
    const precision=get('precision');
    if(precision && Number(state.precisionCooldownUntil||0)<=now && chance(Math.min(100,(precision.mastered?10:5)+overallBonus))){
        state.precisionCooldownUntil=now+(precision.mastered?60:120)*1000;
        tags.push('precision');
        return {damage:0,remaining:hp,state,advantagesTriggered:tags};
    }
    // Heal manipulation ticks during subsequent XP hits (not a chat command).
    for(const control of Object.values(state.manipulations||{})){
        const until=Math.min(now,Number(control.until||0)),last=Number(control.lastTick||until);
        const ticks=Math.max(0,Math.floor((until-last)/10000));
        if(ticks){hp=Math.min(maxHP,hp+ticks*Number(control.healPerTurn||0));control.lastTick=last+ticks*10000;}
    }
    let multiplier=1;
    const reduction=(key,normal,mastered)=>{
        const advantage=get(key);
        if(advantage)multiplier*=1-(advantage.mastered?mastered:normal);
    };
    if(isChat){reduction('chatting_immunity',.25,.35);if(critical)reduction('critical_immunity',.35,.45);}
    if(isCommand){reduction('commands_immunity',.25,.40);if(source==='roll')reduction('rolling_immunity',.30,.40);}
    const durability=get('durability');
    if(durability && Number(state.durabilityUntil||0)>now)reduction('durability',.25,.40);
    if(Number(state.furyActiveUntil||0)>now)multiplier*=1-Math.min(1,Math.max(0,Number(state.furyDamageReduction||0)));
    const damage=Math.min(hp,Math.max(0,Math.floor(baseXP*Math.max(0,multiplier)+1e-7)));
    hp=Math.max(0,hp-damage);
    const pct=100*hp/maxHP;
    if(hp>0){
        if(durability && Number(state.durabilityUntil||0)<=now && Number(state.durabilityCooldownUntil||0)<=now && chance(durability.mastered?10:5)){
            state.durabilityUntil=now+(durability.mastered?180:60)*1000;
            state.durabilityCooldownUntil=now+(durability.mastered?180:300)*1000;
            tags.push('durability');
        }
        if(power && !state.powerTriggered && pct<50 && chance(power.mastered?6:3)){
            state.powerTriggered=true;
            // Native Power: temporary +5%/+15% maximum HP, with its initial
            // HP recovery based on the pre-buff max. Overall also increases.
            const healthGainRate=((power.mastered?10:5)+maxHP/100000000)/100;
            hp=Math.min(poweredMaxHP,hp+Math.round(maxHP*healthGainRate));
            maxHP=poweredMaxHP;
            state.powerUntil=now+(power.mastered?120:60)*1000;
            tags.push('power');
        }
        const fury=get('fury');
        if(fury && !state.furyTriggered && pct<30 && chance(fury.mastered?6:3)){
            state.furyTriggered=true;
            state.furyActiveUntil=now+(fury.mastered?120:60)*1000;
            state.furyDamageReduction=Math.min(1,((fury.mastered?10:5)+overallBonus)/100);
            tags.push('fury');
        }
        if(immortality && pct<(immortality.mastered?25:10) && Number(state.immortalityActiveUntil||0)<=now && Number(state.immortalityCooldownUntil||0)<=now && chance(immortality.mastered?75:50)){
            state.immortalityActiveUntil=now+(immortality.mastered?200:60)*1000;
            state.immortalityCooldownUntil=state.immortalityActiveUntil+(immortality.mastered?60:120)*1000;
            state.immortalityLastTickAt=now;
            tags.push('xp_immortality');
        }
        if(regen && damage>0 && Number(state.regenerationActiveUntil||0)<=now && chance(regen.mastered?20:15)){
            state.regenerationActiveUntil=now+(regen.mastered?30:15)*1000;
            state.regenerationLastTickAt=now;
            tags.push('regeneration');
        }
    }
    return {damage,remaining:hp,state,advantagesTriggered:tags};
}

async function recordEarnedXP(message,attack){
    if(!message?.guild||!message.author?.id)return null;
    const amount=Math.trunc(Number(attack?.earnedXP)||0);
    if(!amount)return null;
    await initialize();
    // Cheap inactive-event check before starting a row-locked transaction.
    const event=await getActiveEvent(message.guild.id);
    if(!event)return null;
    // The native Degeneration advantage discounts only luck-generated XP.
    // Use the same neutral command-XP calculation as ordinary raid bosses.
    let adjustedAttack=attack;
    if(amount>0 && attack.source!=='chat' && Array.isArray(event.advantages)
        && event.advantages.some(item=>item.key==='degeneration') && message.member){
        try{
            const profile=await require('../utils/luck').getActiveLuckBoost(message.member);
            const neutral=require('./bosses').calculateNeutralCommandXP(amount,profile);
            adjustedAttack={...attack,xpWithoutLuck:neutral};
        }catch(error){console.error('Could not resolve event Degeneration luck:',error);}
    }
    const now=Date.now();
    const result=await db.gameTransaction(async tx=>{
        const row=(await tx.query(`SELECT * FROM mzk_events
            WHERE id=$1 AND guild_id=$2 AND status='active' AND expires_at>$3 FOR UPDATE`,
            [event.id,String(message.guild.id),now])).rows[0];
        if(!row)return null;
        const userID=String(message.author.id);
        const individual=row.kind==='challenge';
        let progress=null;
        if(individual){
            await tx.query('INSERT INTO mzk_event_progress(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[row.id,userID]);
            progress=(await tx.query('SELECT * FROM mzk_event_progress WHERE event_id=$1 AND user_id=$2 FOR UPDATE',[row.id,userID])).rows[0];
        }
        const current=Number(individual?(progress.current_hp??row.max_hp):row.current_hp);
        const state=individual?progress.ability_state:row.ability_state;
        const hit=calculateEventHit(row,current,state,{...adjustedAttack,userID},now);
        const awarded=[];
        if(individual){
            if(hit.remaining===0 && hit.damage>0){
                const first=Number(progress.clears)===0;
                const reward=first?row.first_reward:row.replay_reward;
                await deliverReward(tx,row,userID,reward,now);
                awarded.push({userID,first,reward});
                await tx.query('UPDATE mzk_event_progress SET clears=clears+1,current_hp=$3,ability_state=$4::jsonb WHERE event_id=$1 AND user_id=$2',
                    [row.id,userID,row.max_hp,'{}']);
            }else{
                await tx.query('UPDATE mzk_event_progress SET current_hp=$3,ability_state=$4::jsonb WHERE event_id=$1 AND user_id=$2',
                    [row.id,userID,hit.remaining,JSON.stringify(hit.state)]);
            }
        }else{
            if(hit.damage>0){
                await tx.query(`INSERT INTO mzk_event_contributions(event_id,cycle,user_id,damage) VALUES($1,$2,$3,$4)
                    ON CONFLICT(event_id,cycle,user_id) DO UPDATE SET damage=mzk_event_contributions.damage+EXCLUDED.damage`,
                    [row.id,row.cycle,userID,hit.damage]);
            }
            if(hit.remaining===0 && hit.damage>0){
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
                await tx.query(`UPDATE mzk_events SET current_hp=max_hp,cycle=cycle+1,ability_state='{}'::jsonb,
                    total_damage=total_damage+$2,last_damage=$3,last_earned_xp=$4,
                    last_attacker_id=$5,last_hit_at=$6,last_defenses=$7::jsonb,last_source=$8 WHERE id=$1`,
                    [row.id,hit.damage,hit.damage,amount,userID,now,JSON.stringify(hit.advantagesTriggered),String(attack.source||'command')]);
            }else{
                await tx.query(`UPDATE mzk_events SET current_hp=$2,ability_state=$3::jsonb,
                    total_damage=total_damage+$4,last_damage=$5,last_earned_xp=$6,
                    last_attacker_id=$7,last_hit_at=$8,last_defenses=$9::jsonb,last_source=$10 WHERE id=$1`,
                    [row.id,hit.remaining,JSON.stringify(hit.state),hit.damage,hit.damage,amount,userID,now,
                        JSON.stringify(hit.advantagesTriggered),String(attack.source||'command')]);
            }
        }
        return {event:row,damage:hit.damage,remaining:hit.remaining,defeated:hit.remaining===0,awarded,advantagesTriggered:hit.advantagesTriggered};
    });
    if(!result)return null;
    // The native !boss screen is authoritative. Refresh it at most once per
    // five seconds, and never send a fresh channel message for wave defeats.
    const guildID=String(message.guild.id);
    if(now-(lastGlobalPanelRefresh.get(guildID)||0)>=5_000){
        lastGlobalPanelRefresh.set(guildID,now);
        void require('../commands/boss').ensureRaidStatusMessage(message.client,guildID,{guild:message.guild})
            .catch(error=>console.error('Could not refresh global event status:',error));
    }
    if(result.defeated){
        // Give out existing first-clear/replay rewards, without spamming a
        // wave announcement for every XP message that kills a small boss.
        await Promise.allSettled(result.awarded.map(a=>leveling.syncLevelAndAnnounce(message.client,message.guild.id,a.userID)));
    }
    return result;
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
            await interaction.reply({...eventPayload(created,true,'Draft saved. Choose Edit rewards to add first-clear and replay rewards, then publish.',interaction.guild),flags:64});
        }catch(error){await interaction.reply({content:`Could not create event: ${error.message}`,flags:64});}
        return true;
    }
    const event = await getById(rawID,interaction.guildId,['open','refresh'].includes(action));
    if(!event){await interaction.reply({content:'Event no longer exists.',flags:64});return true;}
    if((['manage','rewards','save_rewards','advantages','save_advantages','publish','discard'].includes(action)||action.startsWith('reward_')) && (!isBotAdmin(interaction.user.id)||String(event.owner_id)!==String(interaction.user.id))){
        await interaction.reply({content:'Only the event creator can edit this event.',flags:64});return true;
    }
    if(action==='manage'){
        await interaction.reply({...eventPayload(event,true,'Owner controls. Advantages and future reward bundles can be updated while this event is live.',interaction.guild),flags:64});
        return true;
    }
    if(action==='advantages'){
        if(!['draft','active'].includes(event.status)){
            await interaction.reply({content:'This event cannot be edited.',flags:64});return true;
        }
        const modal=buildAdvantagesModal(event);
        await interaction.showModal(modal);
        return true;
    }
    if(action==='save_advantages' && interaction.isModalSubmit?.()){
        try{
            if(!['draft','active'].includes(event.status))throw new Error('This event cannot be edited.');
            const advantages=parseAdvantages(interaction.fields.getTextInputValue('evt_advantages'));
            const saved=(await db.gameTransaction(async tx=>{
                const result=await tx.query(`UPDATE mzk_events SET advantages=$3::jsonb,ability_state='{}'::jsonb
                    WHERE id=$1 AND owner_id=$2 AND status IN ('draft','active') RETURNING *`,
                    [event.id,interaction.user.id,JSON.stringify(advantages)]);
                if(result.rows[0]?.kind==='challenge'){
                    await tx.query("UPDATE mzk_event_progress SET ability_state='{}'::jsonb WHERE event_id=$1",[event.id]);
                }
                return result.rows[0];
            }));
            if(!saved)throw new Error('Draft is no longer editable.');
            await interaction.reply({...eventPayload(saved,true,'Boss advantages saved.',interaction.guild),flags:64});
        }catch(error){await interaction.reply({content:`Could not save advantages: ${error.message}`,flags:64});}
        return true;
    }
    if(action==='rewards'){
        if(!['draft','active'].includes(event.status)){
            await interaction.reply({content:'This event cannot be edited.',flags:64});return true;
        }
        await interaction.update(rewardDashboardPayload(event));return true;
    }
    if(action.startsWith('reward_')){
        try{
            if(!['draft','active'].includes(event.status))throw new Error('This event cannot be edited.');
            const parts=id.slice(ACTION_ID.length).split(':');
            const slot=parts[2];
            const kind=parts[3];
            const key=parts[4];
            if(action==='reward_home'){
                await interaction.update(eventPayload(event,true,'Reward settings saved automatically.',interaction.guild));
            }else if(action==='reward_back'){
                await interaction.update(rewardDashboardPayload(event));
            }else if(action==='reward_open'){
                if(!REWARD_SLOTS[slot])throw new Error('Invalid reward set.');
                // Selecting a set marks it configured even if the owner leaves it empty.
                const saved=event[REWARD_SLOTS[slot]]?event:await changeReward(event,slot,()=>{});
                await interaction.update(rewardEditorPayload(saved,slot));
            }else if(action==='reward_xp'){
                if(!REWARD_SLOTS[slot])throw new Error('Invalid reward set.');
                await interaction.showModal(rewardAmountModal(event,slot,'xp','value'));
            }else if(action==='reward_menu'){
                if(!REWARD_SLOTS[slot])throw new Error('Invalid reward set.');
                await interaction.update(rewardMenuPayload(event,slot,kind));
            }else if(action==='reward_pick' && interaction.isStringSelectMenu?.()){
                if(!REWARD_SLOTS[slot])throw new Error('Invalid reward set.');
                const selected=interaction.values[0];
                if(kind==='unlock'){
                    if(!Object.hasOwn(REWARD_FIELDS,selected))throw new Error('Unknown command unlock.');
                    const saved=await changeReward(event,slot,value=>{value[selected]=!value[selected];});
                    await rewardEditorResponse(interaction,saved,slot,`${REWARD_FIELDS[selected]} ${saved[REWARD_SLOTS[slot]][selected]?'added.':'removed.'}`);
                }else if(kind==='triple' && selected==='remove'){
                    const saved=await changeReward(event,slot,value=>{delete value.triple;});
                    await rewardEditorResponse(interaction,saved,slot,'3× command reward removed.');
                }else{
                    await interaction.showModal(rewardAmountModal(event,slot,kind,selected));
                }
            }else if(action==='reward_set' && interaction.isModalSubmit?.()){
                if(!REWARD_SLOTS[slot])throw new Error('Invalid reward set.');
                const amount=interaction.fields.getTextInputValue('reward_amount');
                const saved=await changeReward(event,slot,value=>applyAmountEdit(value,kind,key,amount));
                await rewardEditorResponse(interaction,saved,slot,'Reward saved.');
            }else if(action==='reward_reset'){
                const embed=new EmbedBuilder().setColor(0xe74c3c).setTitle('Clear this reward set?')
                    .setDescription(`This removes **all** ${slot==='first'?'first-clear':'replayable'} rewards. The other set is unaffected.`);
                await interaction.update({embeds:[embed],components:[new ActionRowBuilder().addComponents(
                    editorButton(`${ACTION_ID}reward_reset_confirm:${event.id}:${slot}`,'Yes, clear all',ButtonStyle.Danger),
                    editorButton(`${ACTION_ID}reward_open:${event.id}:${slot}`,'Cancel',ButtonStyle.Secondary)
                )]});
            }else if(action==='reward_reset_confirm'){
                const saved=await changeReward(event,slot,value=>{
                    for(const key of Object.keys(value))delete value[key];
                });
                await rewardEditorResponse(interaction,saved,slot,'Reward set cleared.');
            }else{
                await interaction.reply({content:'Unknown reward editor action.',flags:64});
            }
        }catch(error){
            console.error('Event reward editor:',error);
            const payload={content:`Could not update rewards: ${error.message}`,flags:64};
            if(interaction.replied||interaction.deferred)await interaction.followUp(payload).catch(()=>{});
            else await interaction.reply(payload).catch(()=>{});
        }
        return true;
    }
    // Old reward modals remain supported only for previously opened pre-update clients.
    if(action==='save_rewards' && interaction.isModalSubmit?.()){
        try{
            if(!['draft','active'].includes(event.status))throw new Error('This event cannot be edited.');
            const first=validateRewardJSON(interaction.fields.getTextInputValue('evt_first'));
            const replay=validateRewardJSON(interaction.fields.getTextInputValue('evt_replay'));
            const saved=(await db.gameQuery(`UPDATE mzk_events SET first_reward=$3::jsonb,replay_reward=$4::jsonb
                WHERE id=$1 AND owner_id=$2 AND status IN ('draft','active') RETURNING *`,
                [event.id,interaction.user.id,JSON.stringify(first),JSON.stringify(replay)])).rows[0];
            if(!saved)throw new Error('Event is no longer editable.');
            await interaction.reply({...rewardDashboardPayload(saved),flags:64});
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
        await interaction.reply({content:`Event **${result.title}** published. Its public panel is now available through \`!boss\`.`,flags:64});
        // A public event announcement is necessary: draft/editor replies were ephemeral.
        await interaction.channel.send({content:`**Event boss: ${result.title}** is now live! Earn XP by chatting or using XP-earning commands to damage it. Use **!boss** for its live HP, custom health bar, and progress.`,allowedMentions:{parse:[]}}).catch(error=>console.error('Could not announce public event:',error));
        await require('../commands/boss').ensureRaidStatusMessage(interaction.client,interaction.guildId,{guild:interaction.guild})
            .catch(error=>console.error('Could not publish event in global raid-status panel:',error));
        return true;
    }
    if(action==='discard'){
        const removed=await db.gameQuery("DELETE FROM mzk_events WHERE id=$1 AND owner_id=$2 AND status='draft'",[event.id,interaction.user.id]);
        await interaction.reply({content:removed.rowCount?'Draft discarded.':'Published events cannot be discarded using this button.',flags:64});return true;
    }
    if(action==='open'||action==='refresh'){
        if(event.status!=='active'||Number(event.expires_at)<=Date.now()){
            await interaction.reply({content:'This event has ended.',flags:64});return true;
        }
        let visible=event;

        if(action==='refresh'&&interaction.isButton?.())await interaction.update(eventPayload(visible,false,null,interaction.guild));
        else await interaction.reply(eventPayload(visible,false,null,interaction.guild));
        return true;
    }
    if(action==='myprogress'){
        if(event.kind!=='challenge')return false;
        const progress=(await db.gameQuery('SELECT current_hp,clears,ability_state FROM mzk_event_progress WHERE event_id=$1 AND user_id=$2',[event.id,interaction.user.id])).rows[0];
        const personal={...event,current_hp:progress?.current_hp??event.max_hp,ability_state:progress?.ability_state||{}};
        const embed=eventPayload(personal,false,null,interaction.guild).embeds[0]
            .setTitle('EVENT CHALLENGE — YOUR LIVE PROGRESS')
            .addFields({name:'Your clears',value:String(Number(progress?.clears||0))});
        await interaction.reply({embeds:[embed],flags:64});
        return true;
    }
    return false;
}
module.exports={initialize,command,getActiveEvent,eventPayload,handleInteraction,validateRewardJSON,parseDuration,isCommandTripleXP,recordEarnedXP,calculateEventHit,parseAdvantages};
