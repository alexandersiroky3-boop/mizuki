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
    15 * 60 * 1000;



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
            chancePercent: 65,
            min: 2000,
            max: 7500,
            rarity: "💖 COMMON KISS"
        },
        {
            key: "rare",
            chancePercent: 20,
            min: 7500,
            max: 20000,
            rarity: "💜 RARE KISS"
        },
        {
            key: "epic",
            chancePercent: 12.89,
            min: 20000,
            max: 100000,
            rarity: "🌌 EPIC KISS"
        },
        {
            key: "legendary",
            chancePercent: 2,
            min: 100000,
            max: 500000,
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
            chancePercent: 0.01,
            min: 3000000,
            max: 12500000,
            rarity: "🌠 DIVINE KISS"
        }
    ],

    level101Plus: [
        {
            key: "common",
            chancePercent: 35,
            min: 12500,
            max: 25000,
            rarity: "💖 COMMON KISS"
        },
        {
            key: "rare",
            chancePercent: 50,
            min: 25000,
            max: 100000,
            rarity: "💜 RARE KISS"
        },
        {
            key: "epic",
            chancePercent: 10,
            min: 100000,
            max: 750000,
            rarity: "🌌 EPIC KISS"
        },
        {
            key: "legendary",
            chancePercent: 4.5,
            min: 750000,
            max: 5000000,
            rarity: "✨ LEGENDARY KISS"
        },
        {
            key: "divine",
            chancePercent: 0.5,
            min: 5000000,
            max: 25000000,
            rarity: "🌠 DIVINE KISS"
        }
    ]

};


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


async function execute(message){


    if(!message.guild)
        return;


    const guildID =
        message.guild.id;


    const userID =
        message.author.id;



    // ==========================
    // Cooldown check
    // ==========================

const remaining =
    await database.getCommandCooldownRemaining(
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
    // Kiss bot
    // ==========================

    if(
        targetInput.toLowerCase()
        === BOT_NAME
    ){

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


const kissTable =
    currentLevel > 100
        ? KISS_TABLES.level101Plus
        : KISS_TABLES.level1To100;


const outcome =
    luck.rollCommandOutcome(
        kissTable,
        activeLuck
    );


const reward =
    luck.rollCommandXP(
        outcome.min,
        outcome.max,
        activeLuck
    );


await database.giveXP(
    message.guild.id,
    target.id,
    reward
);


// The user who gave the kiss also earns XP.
// They receive 15% less than the kissed user.
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
    reward,
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

💖 **${target.username} received +${reward.toLocaleString()} XP!**

💕 **${message.author.username} received +${kisserReward.toLocaleString()} XP!**${usedLuckExtra}${luckExtra}`

);



}



module.exports = {

    execute

};
