const database = require("../database");
const leveling =
    require("../systems/leveling");
const luck =
    require("../utils/luck");
const xp =
    require("../utils/xp");
const quests =
    require("../systems/quests");


// 1 hour cooldown
const COOLDOWN =
    20 * 60 * 1000;



const BOT_NAME =
    "bot";



function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


const KISS_TABLES = {

    level1To100: [
        {
            key: "common",
            chancePercent: 65.009,
            min: 1000,
            max: 4000,
            rarity: "💖 COMMON KISS"
        },
        {
            key: "rare",
            chancePercent: 20,
            min: 4000,
            max: 10000,
            rarity: "💜 RARE KISS"
        },
        {
            key: "epic",
            chancePercent: 12.89,
            min: 10000,
            max: 50000,
            rarity: "🌌 EPIC KISS"
        },
        {
            key: "legendary",
            chancePercent: 2,
            min: 50000,
            max: 250000,
            rarity: "✨ LEGENDARY KISS"
        },
        {
            key: "mythic",
            chancePercent: 0.1,
            min: 500000,
            max: 3000000,
            rarity: "🔮 MYTHIC KISS"
        },
        {
            key: "divine",
            chancePercent: 0.001,
            min: 3000000,
            max: 7500000,
            rarity: "🌠 DIVINE KISS"
        }
    ],

    level101Plus: [
        {
            key: "common",
            chancePercent: 40.995,
            min: 5000,
            max: 15000,
            rarity: "💖 COMMON KISS"
        },
        {
            key: "rare",
            chancePercent: 50,
            min: 15000,
            max: 50000,
            rarity: "💜 RARE KISS"
        },
        {
            key: "epic",
            chancePercent: 7,
            min: 50000,
            max: 300000,
            rarity: "🌌 EPIC KISS"
        },
        {
            key: "legendary",
            chancePercent: 2,
            min: 300000,
            max: 1500000,
            rarity: "✨ LEGENDARY KISS"
        },
        {
            key: "divine",
            chancePercent: 0.005,
            min: 2000000,
            max: 7500000,
            rarity: "🌠 DIVINE KISS"
        }
    ]

};

// =====================================================
// LEVEL 1-99 EXACT KISS CHANCES FOR LUCK II / III / MAX
// =====================================================
//
// These are intentionally MUCH weaker than the Level 101+
// tables. Lower-level players still benefit from Luck, but
// they should not jump straight into Legendary/Mythic/Divine
// outcomes too often.
//
// No Luck, Luck I and Luck Ω remain unchanged.
const LEVEL1_TO99_EXACT_LUCK_TABLES = {

    tier2: [
        {
            key: "common",
            chancePercent: 35
        },
        {
            key: "rare",
            chancePercent: 45
        },
        {
            key: "epic",
            chancePercent: 17
        },
        {
            key: "legendary",
            chancePercent: 2.5
        },
        {
            key: "mythic",
            chancePercent: 0.45
        },
        {
            key: "divine",
            chancePercent: 0.05
        }
    ],

    tier3: [
        {
            key: "common",
            chancePercent: 27
        },
        {
            key: "rare",
            chancePercent: 42
        },
        {
            key: "epic",
            chancePercent: 25
        },
        {
            key: "legendary",
            chancePercent: 5
        },
        {
            key: "mythic",
            chancePercent: 0.9
        },
        {
            key: "divine",
            chancePercent: 0.1
        }
    ],

    max: [
        {
            key: "common",
            chancePercent: 18
        },
        {
            key: "rare",
            chancePercent: 36
        },
        {
            key: "epic",
            chancePercent: 34
        },
        {
            key: "legendary",
            chancePercent: 10
        },
        {
            key: "mythic",
            chancePercent: 1.85
        },
        {
            key: "divine",
            chancePercent: 0.15
        }
    ]

};


// =====================================================
// LEVEL 101+ EXACT KISS CHANCES FOR LUCK II / III / MAX
// =====================================================
//
// These are direct final percentages for !kiss only.
// They do NOT affect !hug, !steal, !roll, etc.
//
// No Luck, Luck I and Luck Ω still use the normal
// command-luck weighting system unchanged.
const LEVEL101_PLUS_EXACT_LUCK_TABLES = {

    tier2: [
        {
            key: "common",
            chancePercent: 15
        },
        {
            key: "rare",
            chancePercent: 60
        },
        {
            key: "epic",
            chancePercent: 20
        },
        {
            key: "legendary",
            chancePercent: 4.9
        },
        {
            key: "divine",
            chancePercent: 0.1
        }
    ],

    tier3: [
        {
            key: "common",
            chancePercent: 18
        },
        {
            key: "rare",
            chancePercent: 52
        },
        {
            key: "epic",
            chancePercent: 24
        },
        {
            key: "legendary",
            chancePercent: 5.8
        },
        {
            key: "divine",
            chancePercent: 0.2
        }
    ],

    max: [
        {
            key: "common",
            chancePercent: 10
        },
        {
            key: "rare",
            chancePercent: 45
        },
        {
            key: "epic",
            chancePercent: 32
        },
        {
            key: "legendary",
            chancePercent: 12.7
        },
        {
            key: "divine",
            chancePercent: 0.3
        }
    ]

};


function rollExactKissOutcome(
    baseTable,
    exactChanceTable
){

    let roll =
        Math.random() * 100;


    for(const entry of exactChanceTable){

        roll -=
            Number(
                entry.chancePercent
            );


        if(roll < 0){

            return (
                baseTable.find(
                    outcome =>
                        outcome.key ===
                        entry.key
                )
                ||
                baseTable[0]
            );

        }

    }


    return baseTable[
        baseTable.length - 1
    ];

}



function getKissDialogue(
    key,
    author,
    target
){

    const dialogues = {

        common:
`*${author} leans toward ${target} and gives them a quick kiss before pulling away with a grin.*

*Mizuki notices and quietly giggles.*

*"Awww... that was actually kinda cute~"*`,

        rare:
`*${author} gently pulls ${target} closer and gives them a warm kiss.*

*For a moment, soft purple hearts float around them while Mizuki watches with a surprised smile.*

*"Okayyy... that one had some feeling behind it~"*`,

        epic:
`*The moment ${author} kisses ${target}, the air around them flashes violet.*

*Tiny stars and glowing hearts begin orbiting them as time seems to slow for a few seconds.*

*Mizuki blinks twice.*

*"U-Uh... kisses aren't normally supposed to do that."*`,

        legendary:
`*${author} steps toward ${target} as the sky suddenly turns deep purple.*

*Their kiss releases a wave of energy that shakes the ground and sends glowing particles across the horizon.*

*Mizuki shields her face from the blast.*

*"WHAT KIND OF KISS WAS THAT?!"*`,

        mythic:
`*${author} kisses ${target} and reality bends around them.*

*A gigantic purple galaxy forms overhead while constellations begin spinning around the two of them.*

*For several seconds, gravity itself seems to forget what it is supposed to do.*

*Mizuki stares upward in silence.*

*"...That kiss just reached another universe."*`,

        divine:
`*Everything stops the instant ${author} kisses ${target}.*

*Sound disappears. The stars freeze. A violet light spreads through every visible corner of reality.*

*Entire constellations rearrange themselves into a glowing heart above them before exploding into cosmic dust.*

*Mizuki slowly lowers her hands, completely speechless.*

*"The universe itself just approved that kiss..."*`

    };


    return dialogues[key] || dialogues.common;

}


async function syncAndTrackLevel(
    message,
    userID
){

    const levelResult =
        await leveling.syncLevelAndAnnounce(
            message.client,
            message.guild.id,
            userID
        );


    await quests.recordLevelChange(
        message,
        levelResult,
        userID
    );


    return levelResult;

}


async function execute(message, options = {}){


    if(!message.guild)
        return;


    const guildID =
        message.guild.id;


    const userID =
        message.author.id;


    if(!options.questRepeatChild){

        const targetInput =
            message.content
                .trim()
                .split(/\s+/)[1];


        const normalizedTargetID =
            String(targetInput || "")
                .replace(/[^0-9]/g, "");


        const repeatTargetLooksValid =
            String(targetInput || "").toLowerCase() === BOT_NAME
            ||
            /^\d{17,20}$/.test(
                normalizedTargetID
            );


        const repeatCount =
            targetInput
            &&
            repeatTargetLooksValid
            &&
            normalizedTargetID !== userID
                ? await quests.getSocialCommandRepeatCount(
                    guildID,
                    userID
                )
                : 1;


        if(repeatCount > 1){

            const remaining =
                await database.getCommandCooldownRemaining(
                    guildID,
                    userID,
                    "kiss"
                );


            if(remaining > 0){

                return execute(
                    message,
                    {
                        questRepeatChild: true
                    }
                );

            }


            for(
                let repeatIndex = 0;
                repeatIndex < repeatCount;
                repeatIndex++
            ){

                await execute(
                    message,
                    {
                        questRepeatChild: true,
                        skipCooldown:
                            repeatIndex > 0
                    }
                );

            }


            return;

        }

    }



    // ==========================
    // Cooldown check
    // ==========================

const remaining =
    options.skipCooldown
        ? 0
        : await database.getCommandCooldownRemaining(
            guildID,
            userID,
            "kiss"
        );


if(remaining > 0){


    const minutes =
        Math.ceil(
            remaining / 60000
        );


    return message.reply(

        `⏳ You can use !kiss again in ${minutes} minutes.`

    );


}



    const args =
        message.content.trim().split(" ");



    const targetInput =
        args[1];



    if(!targetInput){


        return message.reply(
            "💋 Usage: !kiss @user / user ID / Bot"
        );


    }





    let target = null;



    // ==========================
    // Kiss Mizuki / bot
    // ==========================
    //
    // Treat all of these EXACTLY like "!kiss bot":
    // - !kiss bot
    // - !kiss @Mizuki
    // - !kiss <Mizuki's user ID>
    //
    // This prevents Mizuki from falling through into the
    // normal player-kiss path and receiving leaderboard XP.
    const mizukiUserID =
        String(
            message.client.user.id
        );


    const normalizedTargetInput =
        String(
            targetInput
        ).trim().toLowerCase();


    const isMizukiTarget =
        normalizedTargetInput ===
            BOT_NAME
        ||
        normalizedTargetInput ===
            mizukiUserID
        ||
        normalizedTargetInput ===
            `<@${mizukiUserID}>`
        ||
        normalizedTargetInput ===
            `<@!${mizukiUserID}>`;


    if(isMizukiTarget){

await database.setCommandCooldown(
    guildID,
    userID,
    "kiss",
    Date.now() + COOLDOWN
);

await quests.recordEvent(
    message,
    "kiss_given",
    1
);

const activeLuck =
    await luck.getActiveLuckBoost(
        message.member
    );


const usedLuckExtra =
    luck.buildUsedCommandLuckExtra(
        activeLuck
    );


const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "kiss"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "kiss"
    );


        const nice =
            Math.random() <
            luck.getCommandSuccessChance(
                0.5,
                activeLuck
            );



        if(nice){


            const reward =
                luck.rollCommandXP(
                    5,
                    100,
                    activeLuck
                );



await database.giveXP(
    message.guild.id,
    userID,
    reward
);

await quests.recordEvent(
    message,
    "earn_xp",
    reward
);

await syncAndTrackLevel(
    message,
    userID
);



            return message.channel.send(

`*Goth mommy bot blushed so hard that her whole face turned as red as a tomato... then she licks her lips and keeps looking at you.*

"For your kiss, I will give you **${reward} XP**~~ 💋"${luckExtra}`

            );


        }


        else{


            const loss =
                luck.rollCommandPenalty(
                    5,
                    100,
                    activeLuck
                );



const user =
    await database.getUser(
        message.guild.id,
        userID
    );


await database.setXP(

    message.guild.id,

    userID,

    Math.max(
        0,
        user.xp - loss
    )

);

await syncAndTrackLevel(
    message,
    userID
);



            return message.channel.send(

`*Goth mommy blushes for a second... then suddenly slaps you.*

"EW! DON'T YOU KISS ME!" *she says with pure shock and anger.*

"For that, I will take **${loss} XP**!" 😤${usedLuckExtra}${luckExtra}`

            );


        }

    }






    // ==========================
    // Mention
    // ==========================

    target =
        message.mentions.users.first();





    // ==========================
    // User ID
    // ==========================

    if(!target && /^\d+$/.test(targetInput)){


        try{


            target =
                await message.client.users.fetch(
                    targetInput
                );


        }
        catch{

            return message.reply(
                "❌ User not found."
            );

        }


    }




    if(!target){


        return message.reply(
            "❌ I couldn't find that user."
        );


    }




    // Prevent kissing yourself

    if(target.id === userID){


        return message.reply(
            "💀 You cannot kiss yourself."
        );


    }




await database.setCommandCooldown(
    guildID,
    userID,
    "kiss",
    Date.now() + COOLDOWN
);

await quests.recordEvent(
    message,
    "kiss_given",
    1
);

await quests.recordEvent(
    message,
    "kiss_received",
    1,
    {
        userID: target.id
    }
);

// ==========================
// KISS RARITY + XP
// ==========================

const activeLuck =
    await luck.getActiveLuckBoost(
        message.member
    );


const usedLuckExtra =
    luck.buildUsedCommandLuckExtra(
        activeLuck
    );


const authorData =
    await database.getUser(
        guildID,
        userID
    );


const currentLevel =
    xp.getLevel(
        Number(authorData?.xp) || 0
    );


const targetData =
    await database.getUser(
        guildID,
        target.id
    );


const targetLevel =
    xp.getLevel(
        Number(targetData?.xp) || 0
    );


const lowLevelTargetProtection =
    currentLevel >= 100
    &&
    targetLevel < 100;


const kissTable =
    currentLevel >= 100
        ? KISS_TABLES.level101Plus
        : KISS_TABLES.level1To100;


// Level 100+ keeps Luck useful, but II / III / MAX
// use the softer command balance from utils/luck.js.
const commandLuck =
    currentLevel >= 100
        ? luck.getLevel100PlusCommandLuckProfile(
            activeLuck
        )
        : activeLuck;


const activeLuckTier =
    String(
        activeLuck?.tier || ""
    ).toLowerCase();


const exactLuckTable =
    currentLevel < 100
        ? LEVEL1_TO99_EXACT_LUCK_TABLES[
            activeLuckTier
        ]
        : (
            currentLevel >= 100
                ? LEVEL101_PLUS_EXACT_LUCK_TABLES[
                    activeLuckTier
                ]
                : null
        );


const outcome =
    exactLuckTable
        ? rollExactKissOutcome(
            kissTable,
            exactLuckTable
        )
        : luck.rollCommandOutcome(
            kissTable,
            commandLuck
        );


const reward =
    luck.rollCommandXP(
        outcome.min,
        outcome.max,
        commandLuck
    );


// A Level 1-99 target only receives 10% of a player-command
// reward when the command author is Level 100+.
const targetReward =
    lowLevelTargetProtection
        ? Math.max(
            1,
            Math.floor(
                reward * 0.10
            )
        )
        : reward;


await database.giveXP(
    message.guild.id,
    target.id,
    targetReward
);


// The kisser receives 15% less XP than the kissed user.
const kisserReward =
    Math.floor(
        reward * 0.85
    );


await database.giveXP(
    message.guild.id,
    userID,
    kisserReward
);


await quests.recordEvent(
    message,
    "earn_xp",
    targetReward,
    {
        userID: target.id
    }
);


await quests.recordEvent(
    message,
    "earn_xp",
    kisserReward,
    {
        userID
    }
);


await syncAndTrackLevel(
    message,
    target.id
);


await syncAndTrackLevel(
    message,
    userID
);


const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "kiss"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "kiss"
    );


const dialogue =
    getKissDialogue(
        outcome.key,
        message.author,
        target
    );


return message.channel.send(

`${outcome.rarity}

${dialogue}

💋 **${message.author.username} kissed ${target.username}!**

💖 **${target.username} received +${targetReward.toLocaleString()} XP!**${lowLevelTargetProtection ? " 🛡️ *(90% Lv1-99 protection applied)*" : ""}

💕 **${message.author.username} received +${kisserReward.toLocaleString()} XP!**${usedLuckExtra}${luckExtra}`

);



}



module.exports = {

    execute

};
