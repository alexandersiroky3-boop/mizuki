const database = require("../database");
const xp = require("../utils/xp");
const luck = require("../utils/luck");


// ======================
// SETTINGS
// ======================

const COOLDOWN =
    60 * 60 * 1000; // 1 hour



// ======================
// RANDOM XP
// ======================

function randomXP(min,max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}



// ======================
// COMMAND
// ======================

async function execute(message){


    if(!message.guild)
        return;


    const guildID =
        message.guild.id;

    const userID =
        message.author.id;



    // ======================
    // Cooldown
    // ======================

const remaining =
    await database.getCommandCooldownRemaining(
        guildID,
        userID,
        "ezwin"
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

        `⏳ Mizuki is tired... You can use **!ezwin** again in **${hours}h ${minutes}m**.`

    );


}



await database.setCommandCooldown(
    guildID,
    userID,
    "ezwin",
    Date.now() + COOLDOWN
);



    // ======================
    // Give/Take XP
    // ======================

    const users =
        await database.getLeaderboard(
            guildID,
            1000
        );


    const user =
        await database.getUser(
            guildID,
            userID
        );


    const currentLevel =
        xp.getLevel(
            Number(user?.xp) || 0
        );


    const highLevel =
        currentLevel > 100;


    const activeLuck =
        await luck.getActiveLuckBoost(
            message.member
        );


    const usedLuckExtra =
        luck.buildUsedCommandLuckExtra(
            activeLuck
        );


    const gainedXP =
        highLevel
            ? luck.rollCommandXP(
                100000,
                250000,
                activeLuck
            )
            : luck.rollCommandXP(
                12500,
                50000,
                activeLuck
            );


    const lostXP =
        highLevel
            ? luck.rollCommandXP(
                20000,
                100000,
                activeLuck
            )
            : luck.rollCommandXP(
                2000,
                12500,
                activeLuck
            );


    for(const user of users){

        if(user.userid === userID || user.userID === userID)
            continue;


        await database.addXP(

            guildID,

            user.userid || user.userID,

            -lostXP

        );

    }



    await database.addXP(

        guildID,

        userID,

        gainedXP

    );



    // ======================
    // Message
    // ======================

message.channel.send(

`*Mizuki giggles playfully and flies closer to ${message.author} before snapping her fingers, using only **0.000001%** of her power...*

💥 **Everyone loses ${lostXP.toLocaleString()} XP!**

🌸 **${message.author} gains +${gainedXP.toLocaleString()} XP!**${usedLuckExtra}`

);

}



module.exports = {

    execute

};
