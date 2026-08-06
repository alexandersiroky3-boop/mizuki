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
        targets: [2000000],
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
        targets: [50, 100, 200],
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
        targets: [10],
        mode: "max",
        label: () => "Reach a 10x critical streak"
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
                    5000000,
                    10000000,
                    20000000
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
                    randomChoice([10, 20])
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "max",
                amount:
                    randomChoice([10, 20])
            },

            {
                type: "boost",
                boostType: "luck",
                tier: "tier3",
                amount:
                    randomChoice([50, 100])
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

    getDashboard,

    recordEvent,

    recordLevelChange,

    consumeGuaranteedRoll,

    useRollCooldown,

    formatReward

};
