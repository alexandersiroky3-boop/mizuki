const {
    EmbedBuilder
} = require("discord.js");

const database =
    require("../database");

const boosts =
    require("./boosts");

const luck =
    require("../utils/luck");

const leveling =
    require("./leveling");


const QUEST_TIME_ZONE =
    "Europe/Prague";


const DAILY_QUEST_COUNT =
    3;


const WEEKLY_QUEST_COUNT =
    3;

const QUEST_RULESET_VERSION =
    2;


const DAILY_QUEST_POOL = [

    {
        type: "messages",
        icon: "💬",
        targets: [25, 50, 100, 200],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [5000, 10000, 50000],
        label: target => `Roll ${target.toLocaleString()} XP`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [20000, 50000, 100000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [500, 1000, 2500],
        label: target => `Steal ${target.toLocaleString()} XP`
    },

    {
        type: "get_stolen",
        icon: "💰",
        targets: [1],
        label: () => "Get stolen from by someone"
    },

    {
        type: "kiss_given",
        icon: "💋",
        targets: [3, 5, 10],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [3, 5, 10],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [10, 20, 50],
        label: target => `Use !roll ${target} times`
    },

    {
        type: "critical_streak",
        icon: "💥",
        targets: [2, 3],
        mode: "max",
        label: target => `Reach a ${target}x critical streak`
    },

    {
        type: "level_change",
        icon: "★",
        targets: [1],
        label: () => "Gain or lose a level"
    },

    {
        type: "shop_purchase",
        icon: "💸",
        targets: [1],
        label: () => "Buy something from the shop"
    },

    {
        type: "successful_trade",
        icon: "🤝",
        targets: [2, 4, 6],
        label: target => `Successfully trade with someone ${target} times`
    },

    {
        type: "hug_given",
        icon: "🫂",
        targets: [1],
        label: () => "Hug someone"
    }

];


const WEEKLY_QUEST_POOL = [

    {
        type: "messages",
        icon: "💬",
        targets: [1000, 2000, 5000],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [1000000],
        label: target => `Roll ${target.toLocaleString()} XP`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [2000000, 5000000, 10000000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [20000, 50000, 75000],
        label: target => `Steal ${target.toLocaleString()} XP`
    },

    {
        type: "kiss_given",
        icon: "💋",
        targets: [50, 100, 200],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [25, 35, 50],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [500, 1000, 1500],
        label: target => `Use !roll ${target.toLocaleString()} times`
    },

    {
        type: "critical_streak",
        icon: "💥",
        targets: [10, 15, 20],
        mode: "max",
        label: target => `Reach a ${target}x critical streak`
    },

    {
        type: "successful_trade",
        icon: "🤝",
        targets: [25, 50, 75],
        label: target => `Successfully trade with someone ${target} times`
    },

    {
        type: "buy_luck_max",
        icon: "💸",
        targets: [2, 3],
        label: target => `Buy Luck Boost MAX ${target} times`
    }

];


function randomChoice(values){

    return values[
        Math.floor(
            Math.random() * values.length
        )
    ];

}


function shuffle(values){

    const copy =
        [...values];


    for(
        let index = copy.length - 1;
        index > 0;
        index--
    ){

        const otherIndex =
            Math.floor(
                Math.random() * (index + 1)
            );


        [
            copy[index],
            copy[otherIndex]
        ] = [
            copy[otherIndex],
            copy[index]
        ];

    }


    return copy;

}


function makeQuest(
    definition,
    slot
){

    const target =
        randomChoice(
            definition.targets
        );


    return {
        id:
            `${definition.type}:${slot}`,

        rulesetVersion:
            QUEST_RULESET_VERSION,

        type:
            definition.type,

        icon:
            definition.icon,

        label:
            definition.label(target),

        target,

        progress:
            0,

        mode:
            definition.mode || "add",

        completed:
            false,

        completedAt:
            null
    };

}


function generateQuests(
    cycleType
){

    const pool =
        cycleType === "daily"
            ? DAILY_QUEST_POOL
            : WEEKLY_QUEST_POOL;


    const amount =
        cycleType === "daily"
            ? DAILY_QUEST_COUNT
            : WEEKLY_QUEST_COUNT;


    return shuffle(pool)
        .slice(0, amount)
        .map(makeQuest);

}


function generateDailyRewards(){

    const xpReward = {
        type: "xp",
        amount:
            randomChoice([
                200000,
                500000,
                1000000
            ])
    };


    const extraReward =
        randomChoice([

            {
                type: "boost",
                boostType: "luck",
                tier:
                    randomChoice([
                        "tier2",
                        "tier3"
                    ]),
                amount: 5
            },

            {
                type: "boost",
                boostType: "xp",
                tier:
                    randomChoice([
                        "tier2",
                        "tier3"
                    ]),
                amount: 5
            },

            {
                type: "guaranteed_roll",
                rollType: "daily_25k_75k",
                amount: 1
            }

        ]);


    return [
        xpReward,
        extraReward
    ];

}


function generateWeeklyRewards(){

    const rewards = [
        {
            type: "xp",
            amount:
                randomChoice([
                    2000000,
                    5000000,
                    10000000
                ])
        }
    ];


    const extras =
        shuffle([

            {
                type: "boost",
                boostType: "luck",
                tier: "max",
                amount:
                    randomChoice([2, 3, 5])
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "max",
                amount:
                    randomChoice([2, 3, 5])
            },

            {
                type: "boost",
                boostType: "luck",
                tier: "tier3",
                amount:
                    randomChoice([5, 10])
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "tier3",
                amount:
                    randomChoice([5, 10])
            },

            {
                type: "guaranteed_roll",
                rollType: "impossible",
                amount: 1
            },

            {
                type: "triple_roll",
                durationMs:
                    24 * 60 * 60 * 1000
            }

        ]);


    const extraCount =
        Math.random() < 0.5
            ? 2
            : 3;


    rewards.push(
        ...extras.slice(0, extraCount)
    );


    return rewards;

}

function generateRewards(cycleType){

    return cycleType === "daily"
        ? generateDailyRewards()
        : generateWeeklyRewards();

}


const dateFormatter =
    new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone:
                QUEST_TIME_ZONE,

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit"
        }
    );


function getLocalDateParts(timestamp){

    const parts =
        dateFormatter.formatToParts(
            new Date(timestamp)
        );


    const values = {};


    for(const part of parts){

        if(part.type !== "literal"){

            values[part.type] =
                Number(part.value);

        }

    }


    return {
        year:
            values.year,

        month:
            values.month,

        day:
            values.day
    };

}


function addCalendarDays(
    parts,
    amount
){

    const date =
        new Date(
            Date.UTC(
                parts.year,
                parts.month - 1,
                parts.day + amount
            )
        );


    return {
        year:
            date.getUTCFullYear(),

        month:
            date.getUTCMonth() + 1,

        day:
            date.getUTCDate()
    };

}


function zonedMidnightToUTC(parts){

    const wantedLocalAsUTC =
        Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            0,
            0,
            0
        );


    let guess =
        wantedLocalAsUTC;


    for(let attempt = 0; attempt < 4; attempt++){

        const actualLocal =
            getLocalDateTimeParts(
                guess
            );


        const actualLocalAsUTC =
            Date.UTC(
                actualLocal.year,
                actualLocal.month - 1,
                actualLocal.day,
                actualLocal.hour,
                actualLocal.minute,
                actualLocal.second
            );


        const difference =
            wantedLocalAsUTC -
            actualLocalAsUTC;


        guess +=
            difference;


        if(Math.abs(difference) < 1000){

            break;

        }

    }


    return guess;

}


const dateTimeFormatter =
    new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone:
                QUEST_TIME_ZONE,

            year:
                "numeric",

            month:
                "2-digit",

            day:
                "2-digit",

            hour:
                "2-digit",

            minute:
                "2-digit",

            second:
                "2-digit",

            hourCycle:
                "h23"
        }
    );


function getLocalDateTimeParts(timestamp){

    const parts =
        dateTimeFormatter.formatToParts(
            new Date(timestamp)
        );


    const values = {};


    for(const part of parts){

        if(part.type !== "literal"){

            values[part.type] =
                Number(part.value);

        }

    }


    return values;

}


function formatDateKey(parts){

    return [
        String(parts.year),
        String(parts.month).padStart(2, "0"),
        String(parts.day).padStart(2, "0")
    ].join("-");

}


function getCycleInfo(
    cycleType,
    now = Date.now()
){

    const today =
        getLocalDateParts(now);


    if(cycleType === "daily"){

        const tomorrow =
            addCalendarDays(
                today,
                1
            );


        return {
            cycleType,
            cycleKey:
                formatDateKey(today),
            expiresAt:
                zonedMidnightToUTC(tomorrow)
        };

    }


    const weekday =
        new Date(
            Date.UTC(
                today.year,
                today.month - 1,
                today.day
            )
        ).getUTCDay();


    const daysSinceMonday =
        (weekday + 6) % 7;


    const monday =
        addCalendarDays(
            today,
            -daysSinceMonday
        );


    const nextMonday =
        addCalendarDays(
            monday,
            7
        );


    return {
        cycleType,
        cycleKey:
            formatDateKey(monday),
        expiresAt:
            zonedMidnightToUTC(nextMonday)
    };

}


function normalizeJSON(value){

    if(typeof value === "string"){

        try{

            return JSON.parse(value);

        }
        catch{

            return [];

        }

    }


    return value;

}


function normalizeCycle(row){

    if(!row){

        return null;

    }


    return {
        ...row,

        cycletype:
            row.cycletype || row.cycleType,

        cyclekey:
            row.cyclekey || row.cycleKey,

        expiresat:
            Number(
                row.expiresat ||
                row.expiresAt ||
                0
            ),

        quests:
            normalizeJSON(row.quests) || [],

        rewards:
            normalizeJSON(row.rewards) || [],

        rewarded:
            Boolean(row.rewarded)
    };

}


function getQuestDefinition(
    cycleType,
    questType
){

    const pool =
        cycleType === "daily"
            ? DAILY_QUEST_POOL
            : WEEKLY_QUEST_POOL;


    return pool.find(
        definition =>
            definition.type === questType
    ) || null;

}


function migrateWeeklyTarget(quest){

    const target =
        Number(quest.target) || 0;


    if(quest.type === "kiss_received"){

        const oldToNew = {
            50: 25,
            100: 35,
            200: 50
        };


        if(oldToNew[target])
            return oldToNew[target];


        if([25, 35, 50].includes(target))
            return target;


        return Math.max(
            25,
            Math.min(50, target || 25)
        );

    }


    if(quest.type === "critical_streak"){

        if([10, 15, 20].includes(target))
            return target;


        return Math.max(
            10,
            Math.min(20, target || 10)
        );

    }


    if(quest.type === "earn_xp"){

        if([
            2000000,
            5000000,
            10000000
        ].includes(target)){

            return target;

        }


        if(target <= 2000000)
            return 2000000;

        if(target <= 5000000)
            return 5000000;

        return 10000000;

    }


    return target;

}


function migrateWeeklyReward(reward){

    const migrated = {
        ...reward
    };


    if(migrated.type === "xp"){

        migrated.amount =
            Math.min(
                10000000,
                Math.max(
                    0,
                    Number(migrated.amount) || 0
                )
            );

    }
    else if(migrated.type === "boost"){

        const tier =
            String(
                migrated.tier || ""
            ).toLowerCase();


        if(tier === "max"){

            migrated.amount =
                Math.min(
                    5,
                    Math.max(
                        1,
                        Number(migrated.amount) || 1
                    )
                );

        }
        else if(tier === "tier3"){

            migrated.amount =
                Math.min(
                    10,
                    Math.max(
                        1,
                        Number(migrated.amount) || 1
                    )
                );

        }

    }


    return migrated;

}


function migrateCycleData(cycle){

    const normalized =
        normalizeCycle(cycle);


    if(!normalized){

        return {
            changed: false,
            cycle: normalized
        };

    }


    const beforeQuests =
        JSON.stringify(
            normalized.quests
        );

    const beforeRewards =
        JSON.stringify(
            normalized.rewards
        );


    const quests =
        normalized.quests.map(
            quest => {

                const migrated = {
                    ...quest
                };


                const legacyRuleset =
                    Number(
                        migrated.rulesetVersion ||
                        0
                    ) < QUEST_RULESET_VERSION;


                if(
                    normalized.cycletype === "weekly" &&
                    legacyRuleset
                ){

                    migrated.target =
                        migrateWeeklyTarget(
                            migrated
                        );

                }


                migrated.rulesetVersion =
                    QUEST_RULESET_VERSION;


                const definition =
                    getQuestDefinition(
                        normalized.cycletype,
                        migrated.type
                    );


                if(definition){

                    migrated.icon =
                        definition.icon;

                    migrated.mode =
                        definition.mode || "add";

                    migrated.label =
                        definition.label(
                            Number(migrated.target)
                        );

                }


                const progress =
                    Math.max(
                        0,
                        Number(migrated.progress) || 0
                    );

                const target =
                    Math.max(
                        1,
                        Number(migrated.target) || 1
                    );


                // Keep the user's saved progress. If a nerfed target is now
                // already met, finish the quest instead of throwing progress away.
                migrated.progress =
                    progress;


                if(
                    !migrated.completed &&
                    progress >= target
                ){

                    migrated.completed =
                        true;

                    migrated.completedAt =
                        migrated.completedAt ||
                        Date.now();

                }


                return migrated;

            }
        );


    let rewards =
        normalized.rewards;


    // Never claw back rewards that were already claimed.
    if(
        normalized.cycletype === "weekly" &&
        !normalized.rewarded
    ){

        rewards =
            normalized.rewards.map(
                migrateWeeklyReward
            );

    }


    const changed =
        beforeQuests !==
            JSON.stringify(quests)
        ||
        beforeRewards !==
            JSON.stringify(rewards);


    return {
        changed,
        cycle: {
            ...normalized,
            quests,
            rewards
        }
    };

}


async function migrateActiveQuestCycles(
    client = null
){

    const rows =
        await database.getActiveQuestCycles(
            Date.now()
        );


    let changedCount = 0;
    let autoClaimedCount = 0;


    for(const row of rows){

        const migrated =
            migrateCycleData(
                row
            );


        if(!migrated.changed)
            continue;


        const cycle =
            migrated.cycle;


        const updated =
            await database.replaceQuestCycleData(
                row.guildid || row.guildID,
                row.userid || row.userID,
                cycle.cycletype,
                cycle.cyclekey,
                cycle.quests,
                cycle.rewards
            );


        if(!updated)
            continue;


        changedCount++;


        const normalizedUpdated =
            normalizeCycle(
                updated
            );


        const allCompleted =
            normalizedUpdated.quests.length > 0 &&
            normalizedUpdated.quests.every(
                quest =>
                    Boolean(quest.completed)
            );


        if(
            allCompleted &&
            !normalizedUpdated.rewarded
        ){

            const claim =
                await database.claimQuestCycleRewards(
                    row.guildid || row.guildID,
                    row.userid || row.userID,
                    normalizedUpdated.cycletype,
                    normalizedUpdated.cyclekey
                );


            if(claim?.claimed){

                autoClaimedCount++;


                if(
                    client &&
                    claim.rewards.some(
                        reward =>
                            reward.type === "xp" &&
                            Number(reward.amount) > 0
                    )
                ){

                    await leveling.syncLevelAndAnnounce(
                        client,
                        row.guildid || row.guildID,
                        row.userid || row.userID
                    ).catch(
                        () => {}
                    );

                }

            }

        }

    }


    console.log(
        `✅ Quest migration updated ${changedCount} active cycles and auto-claimed ${autoClaimedCount} completed cycles without resetting progress.`
    );


    return {
        changedCount,
        autoClaimedCount
    };

}


async function ensureCycle(
    guildID,
    userID,
    cycleType
){

    const cycleInfo =
        getCycleInfo(cycleType);


    let cycle =
        await database.getQuestCycle(
            guildID,
            userID,
            cycleType,
            cycleInfo.cycleKey
        );


    if(!cycle){

        await database.createQuestCycle(
            guildID,
            userID,
            cycleType,
            cycleInfo.cycleKey,
            cycleInfo.expiresAt,
            generateQuests(cycleType),
            generateRewards(cycleType)
        );


        cycle =
            await database.getQuestCycle(
                guildID,
                userID,
                cycleType,
                cycleInfo.cycleKey
            );

    }


    const migrated =
        migrateCycleData(
            cycle
        );


    if(migrated.changed){

        cycle =
            await database.replaceQuestCycleData(
                guildID,
                userID,
                cycleType,
                cycleInfo.cycleKey,
                migrated.cycle.quests,
                migrated.cycle.rewards
            );

    }


    return normalizeCycle(cycle);

}


async function ensureUserQuests(
    guildID,
    userID
){

    const [
        daily,
        weekly
    ] = await Promise.all([

        ensureCycle(
            guildID,
            userID,
            "daily"
        ),

        ensureCycle(
            guildID,
            userID,
            "weekly"
        )

    ]);


    return {
        daily,
        weekly
    };

}


function getContext(
    source,
    userIDOverride = null
){

    const guild =
        source.guild ||
        source.message?.guild ||
        null;


    const client =
        source.client ||
        source.message?.client ||
        null;


    const channel =
        source.channel ||
        source.message?.channel ||
        null;


    const userID =
        userIDOverride ||
        source.author?.id ||
        source.user?.id ||
        source.member?.id ||
        null;


    return {
        guild,
        client,
        channel,
        userID
    };

}


function formatReward(reward){

    if(reward.type === "xp"){

        return `**${Number(reward.amount).toLocaleString()} XP**`;

    }


    if(reward.type === "boost"){

        const profile =
            reward.boostType === "xp"
                ? boosts.BOOST_PROFILES[reward.tier]
                : luck.LUCK_ROLES[reward.tier];


        const name =
            profile
                ? `<@&${profile.roleID}>`
                : `${reward.boostType} ${reward.tier}`;


        return `**${reward.amount}x** ${name}`;

    }


    if(
        reward.type === "guaranteed_roll" &&
        reward.rollType === "daily_25k_75k"
    ){

        return "Guaranteed **25,000–75,000 XP** on your next `!roll`";

    }


    if(
        reward.type === "guaranteed_roll" &&
        reward.rollType === "impossible"
    ){

        return "Guaranteed **Impossible Roll** on your next `!roll`";

    }


    if(reward.type === "triple_roll"){

        return "Use `!roll` **3 times per cooldown window** for 24 hours";

    }


    return "Unknown reward";

}


async function sendQuestCompleted(
    context,
    cycleType,
    quest
){

    if(!context.channel){

        return;

    }


    const cycleName =
        cycleType === "daily"
            ? "Daily"
            : "Weekly";


    await context.channel.send(

        `${quest.icon} <@${context.userID}> completed a **${cycleName} Quest**: **${quest.label}**`

    ).catch(() => {});

}


async function sendCycleCompleted(
    context,
    cycleType,
    rewards
){

    if(!context.channel){

        return;

    }


    const cycleName =
        cycleType === "daily"
            ? "Daily Quests Completed"
            : "Weekly Quests Completed";


    const embed =
        new EmbedBuilder()

            .setColor(
                cycleType === "daily"
                    ? "#7A5CFF"
                    : "#D4AF37"
            )

            .setTitle(
                cycleName
            )

            .setDescription(
                `<@${context.userID}> completed every ${cycleType} quest.\n\n` +
                rewards
                    .map(
                        reward =>
                            `• ${formatReward(reward)}`
                    )
                    .join("\n")
            )

            .setFooter({
                text:
                    "Rewards were added automatically."
            })

            .setTimestamp();


    await context.channel.send({
        embeds: [
            embed
        ]
    }).catch(() => {});

}


async function claimCompletedCycle(
    context,
    cycleType,
    cycleKey
){

    const claim =
        await database.claimQuestCycleRewards(
            context.guild.id,
            context.userID,
            cycleType,
            cycleKey
        );


    if(!claim?.claimed){

        return null;

    }


    const hasXPReward =
        claim.rewards.some(
            reward =>
                reward.type === "xp" &&
                Number(reward.amount) > 0
        );


    if(
        hasXPReward &&
        context.client
    ){

        await leveling.syncLevelAndAnnounce(
            context.client,
            context.guild.id,
            context.userID
        );

    }


    await sendCycleCompleted(
        context,
        cycleType,
        claim.rewards
    );


    return claim;

}


async function recordEventUnsafe(
    source,
    eventType,
    amount = 1,
    options = {}
){

    const context =
        getContext(
            source,
            options.userID || null
        );


    if(
        !context.guild ||
        !context.userID
    ){

        return [];

    }


    const numericAmount =
        Number(amount) || 0;


    if(numericAmount <= 0){

        return [];

    }


    const cycles =
        await ensureUserQuests(
            context.guild.id,
            context.userID
        );


    const results = [];


    for(const cycleType of [
        "daily",
        "weekly"
    ]){

        const cycle =
            cycles[cycleType];


        const result =
            await database.updateQuestCycleProgress(
                context.guild.id,
                context.userID,
                cycleType,
                cycle.cyclekey,
                eventType,
                numericAmount
            );


        if(!result){

            continue;

        }


        for(const quest of result.newlyCompleted){

            await sendQuestCompleted(
                context,
                cycleType,
                quest
            );

        }


        if(result.allCompleted){

            await claimCompletedCycle(
                context,
                cycleType,
                cycle.cyclekey
            );

        }


        results.push(result);

    }


    return results;

}


async function recordEvent(
    source,
    eventType,
    amount = 1,
    options = {}
){

    try{

        return await recordEventUnsafe(
            source,
            eventType,
            amount,
            options
        );

    }
    catch(error){

        console.error(
            "Quest progress update failed:",
            error
        );


        return [];

    }

}


async function recordLevelChange(
    source,
    levelResult,
    userID = null
){

    if(!levelResult){

        return;

    }


    const oldLevel =
        Number(levelResult.oldLevel);


    const newLevel =
        Number(
            levelResult.newLevel ??
            levelResult.level
        );


    const changed =
        Number.isFinite(oldLevel) &&
        Number.isFinite(newLevel)
            ? oldLevel !== newLevel
            : Boolean(levelResult.leveledUp);


    if(changed){

        await recordEvent(
            source,
            "level_change",
            1,
            {
                userID
            }
        );

    }

}


async function getDashboard(
    guildID,
    userID
){

    return ensureUserQuests(
        guildID,
        userID
    );

}


async function consumeGuaranteedRoll(
    guildID,
    userID
){

    return database.consumeGuaranteedQuestRoll(
        guildID,
        userID
    );

}


async function useRollCooldown(
    guildID,
    userID,
    cooldownMs
){

    return database.useQuestRollCooldown(
        guildID,
        userID,
        cooldownMs
    );

}


module.exports = {

    ensureUserQuests,

    migrateActiveQuestCycles,

    getDashboard,

    recordEvent,

    recordLevelChange,

    consumeGuaranteedRoll,

    useRollCooldown,

    formatReward

};
