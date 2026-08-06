const database = require("../database");
const leveling = require("../systems/leveling");
const luck = require("../utils/luck");
const boosts = require("../systems/boosts");
const quests = require("../systems/quests");


const COOLDOWN =
    5 * 60 * 60 * 1000; // 5 hours


const MAX_BOOST_DURATION =
    60 * 60 * 1000; // 1 hour


const MAX_BOOST_ROLE =
    "1526995218098815016";



// ======================
// RANDOM NUMBER
// ======================

function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}



// ======================
// GIVE MAX BOOST
// ======================

async function giveMaxBoost(
    message,
    userID
){

    const member =
        await message.guild.members.fetch(
            userID
        );


    return boosts.awardXPBoost(
        member,
        "max",
        "DIVINE !hug"
    );

}



// ======================
// EXECUTE
// ======================

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



    // ======================
    // COOLDOWN
    // ======================

const remaining =
    await database.getCommandCooldownRemaining(
        guildID,
        userID,
        "hug"
    );


if(remaining > 0){


    const hours =
        Math.floor(
            remaining / 3600000
        );


    const minutes =
        Math.ceil(
            (
                remaining %
                3600000
            ) / 60000
        );


    return message.reply(

        `💞 You need to wait **${hours}h ${minutes}m** before hugging again!`

    );


}



    // ======================
    // TARGET
    // ======================

    const target =
        message.mentions.users.first();



    if(!target){

        return message.reply(
            "💞 You need to hug someone!"
        );

    }



    if(target.id === userID){

        return message.reply(
            "💞 You can't hug yourself!"
        );

    }


    await quests.recordEvent(
        message,
        "hug_given",
        1
    );


    // ======================
    // HUG BOT
    // ======================

    if(target.bot){


await database.setCommandCooldown(
    guildID,
    userID,
    "hug",
    Date.now() + COOLDOWN
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "hug"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "hug"
    );


        const success =
            Math.random() < 0.5;



        // 50% chance:
        // Guaranteed +50,000 XP
        if(success){


            const reward =
                50000;


            await database.addXP(
                guildID,
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

`*Mizuki was just hovering above the ground, looking at her cute members, but suddenly ${message.author} ran up to her and wrapped their arms around her, hugging her tightly... Mizuki immediately blushed and smiled.*

**"T-Thank you... ${message.author}."**

💖 ${message.author} earned **${reward.toLocaleString()} XP!**${luckExtra}`

            );

        }



        // 50% chance:
        // Guaranteed -25,000 XP
        const loss =
            25000;


        const user =
            await database.getUser(
                guildID,
                userID
            );


        const currentXP =
            Math.max(
                0,
                Number(user.xp) || 0
            );


        const newXP =
            Math.max(
                0,
                currentXP - loss
            );


        const actualLoss =
            currentXP - newXP;


        await database.setXP(
            guildID,
            userID,
            newXP
        );


await syncAndTrackLevel(
    message,
    userID
);


        return message.channel.send(

`*${message.author} suddenly ran toward Mizuki and tried to hug her, but Mizuki quickly moved out of the way.*

*${message.author} fell face-first onto the ground while Mizuki stared down at them.*

**"You could've at least warned me first..."**

💔 ${message.author} lost **${actualLoss.toLocaleString()} XP!**${luckExtra}`

        );

    }



    // ======================
    // NORMAL USER HUG
    // ======================

    const chance =
        Math.random();


    let reward;
    let rarity;
    let text;



    // ======================
    // COMMON
    // 65%
    // 15,000 - 30,000 XP
    // ======================

    if(chance < 0.65){


        reward =
            random(
                15000,
                30000
            );


        rarity =
            "💞 COMMON";


        text =

`🫂 **${message.author} hugged ${target}!** 🫂`;

    }



    // ======================
    // RARE
    // 20%
    // 30,000 - 75,000 XP
    // ======================

    else if(chance < 0.85){


        reward =
            random(
                30000,
                75000
            );


        rarity =
            "💖 RARE";


        text =

`🫂💖 **A HEARTFELT HUG** 💖🫂

*${message.author} ran up to ${target} and pulled them into a tight hug.*

*Beautiful particles slowly began appearing around them, glowing brighter as the hug continued.*`;

    }



    // ======================
    // EPIC
    // 10%
    // 75,000 - 250,000 XP
    // ======================

    else if(chance < 0.95){


        reward =
            random(
                75000,
                250000
            );


        rarity =
            "🌇 EPIC";


        text =

`🌇🫂 **THE SURPRISE HUG** 🫂🌇

*${message.author} quietly walked up behind ${target} without making a sound.*

*Before ${target} could turn around, ${message.author} wrapped both arms around them from behind and lifted them slightly into the air.*

*${target} was completely caught off guard, but eventually relaxed into the hug.*`;

    }



    // ======================
    // LEGENDARY
    // 3.9%
    // 250,000 - 750,000 XP
    // ======================

    else if(chance < 0.989){


        reward =
            random(
                250000,
                750000
            );


        rarity =
            "🪄 LEGENDARY";


        text =

`🪄💫 **THE BACK-BREAKING GROUP HUG** 💫🪄

*${message.author} immediately lifted ${target} into the air and hugged them really, really tightly.*

*${message.author} started spinning around while continuing to squeeze ${target}, nearly breaking their back in the process.*

*Mizuki saw what was happening and excitedly flew toward them.*

*"Wait for me! I want to join too~!"*

*Mizuki wrapped her arms around both of them, turning it into a chaotic group hug.*

*${target}'s back may never recover.*`;

    }



    // ======================
    // MYTHIC
    // 1%
    // 750,000 - 3,000,000 XP
    // ======================

    else if(chance < 0.999){


        reward =
            random(
                750000,
                3000000
            );


        rarity =
            "🌌 MYTHIC";


        text =

`🌌🌠 **A HUG BEYOND THE UNIVERSE** 🌠🌌

*${message.author} slowly approached ${target} as the sky above them began changing.*

*Stars appeared in the middle of the day, and waves of cosmic energy spread across the area.*

*${message.author} wrapped their arms around ${target}.*

*The moment they hugged, both of them were lifted into the air as a massive galaxy formed around their bodies.*

*Mizuki stared upward in disbelief.*

*"That isn't just a hug..."*

*"Their energy is connecting across the entire universe..."*

*Thousands of glowing stars circled around ${message.author} and ${target} before exploding into beautiful cosmic particles.*

*They slowly returned to the ground, still holding onto each other as the universe became silent once again.*`;

    }



    // ======================
    // DIVINE
    // 0.1%
    // Guaranteed 10,000,000 XP
    // Guaranteed XP MAX boost
    // ======================

    else{


        reward =
            10000000;


        rarity =
            "✨ DIVINE";


        text =

`✨💞 **THE PERFECT HUG** 💞✨

*The entire universe suddenly stopped.*

*Every sound disappeared, time froze and even the stars stopped moving.*

*${message.author} and ${target} slowly walked toward each other.*

*The moment they hugged, an endless wave of energy erupted from their bodies and travelled across every universe.*

*Mizuki covered her eyes as the light became brighter than anything she had ever seen.*

*"W-What is this power...?"*

*The energy surrounding ${message.author} and ${target} transformed into countless glowing hearts, stars and galaxies.*

*For one perfect moment, nothing else in existence mattered.*

*Only the hug remained.*

🌠 **The universe has acknowledged their bond.**`;

    }



    // ======================
    // GIVE XP TO BOTH USERS
    // ======================

    await database.addXP(
        guildID,
        userID,
        reward
    );


    await database.addXP(
        guildID,
        target.id,
        reward
    );


    await quests.recordEvent(
        message,
        "earn_xp",
        reward,
        {
            userID
        }
    );


    await quests.recordEvent(
        message,
        "earn_xp",
        reward,
        {
            userID: target.id
        }
    );


    // ======================
    // UPDATE LEVELS
    // ======================

await syncAndTrackLevel(
    message,
    userID
);


await syncAndTrackLevel(
    message,
    target.id
);



    // ======================
    // DIVINE MAX BOOST
    // ======================

    let authorMaxBoost =
        null;


    let targetMaxBoost =
        null;


    if(rarity === "✨ DIVINE"){


        authorMaxBoost =
            await giveMaxBoost(
                message,
                userID
            );


        targetMaxBoost =
            await giveMaxBoost(
                message,
                target.id
            );

    }



    // ======================
    // START COOLDOWN
    // ======================

await database.setCommandCooldown(
    guildID,
    userID,
    "hug",
    Date.now() + COOLDOWN
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "hug"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "hug"
    );



    // ======================
    // RESPONSE
    // ======================

    if(rarity === "✨ DIVINE"){

        return message.channel.send(

`${text}

${rarity}

💞 Both users received **${reward.toLocaleString()} XP!**

💎 ${message.author} stored <@&${MAX_BOOST_ROLE}>! Inventory: **x${authorMaxBoost.amount}**

💎 ${target} stored <@&${MAX_BOOST_ROLE}>! Inventory: **x${targetMaxBoost.amount}**${luckExtra}`

        );

    }


    return message.channel.send(

`${text}

${rarity}

💞 Both users received **${reward.toLocaleString()} XP!**${luckExtra}`

    );

}



module.exports = {

    execute

};
