const database = require("../database");
const xp = require("../utils/xp");
const luck = require("../utils/luck");
const leveling = require("../systems/leveling");


// ======================
// SETTINGS
// ======================

const COOLDOWN =
    24 * 60 * 60 * 1000; // 24 hours



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


    // Protection starts at exactly Level 100, even though the
    // existing EZ Win reward tier still uses its old >100 check.
    const isLevel100PlusActor =
        currentLevel >= 100;


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


        const affectedUserID =
            user.userid || user.userID;


        const affectedUser =
            await database.getUser(
                guildID,
                affectedUserID
            );


        const affectedLevel =
            xp.getLevel(
                Number(affectedUser?.xp) || 0
            );


        // Existing low-level protection remains for low-level
        // attackers (30% of the rolled loss).
        //
        // NEW: if the !ezwin user is Level 100+, a Level 1-99
        // victim only takes 10% of the rolled loss.
        const affectedLoss =
            affectedLevel < 100
                ? Math.max(
                    1,
                    Math.floor(
                        lostXP *
                        (
                            isLevel100PlusActor
                                ? 0.10
                                : 0.30
                        )
                    )
                )
                : lostXP;


        await database.addXP(

            guildID,

            affectedUserID,

            -affectedLoss

        );


        // Recalculate the user's level immediately after
        // losing XP. syncLevelAndAnnounce updates levels
        // downward too, but only announces actual level-ups.
        await leveling.syncLevelAndAnnounce(

            message.client,

            guildID,

            affectedUserID

        );

    }



    await database.addXP(

        guildID,

        userID,

        gainedXP

    );


    // Recalculate the winner too, so any level-up from
    // !ezwin is reflected immediately.
    await leveling.syncLevelAndAnnounce(

        message.client,

        guildID,

        userID

    );



    // ======================
    // Message
    // ======================

message.channel.send(

`*Mizuki giggles playfully and flies closer to ${message.author} before snapping her fingers, using only **0.000001%** of her power...*

💥 **Level 100+ users lose ${lostXP.toLocaleString()} XP!**
🛡️ **Users below Level 100 lose ${isLevel100PlusActor ? "90%" : "70%"} less XP!**

🌸 **${message.author} gains +${gainedXP.toLocaleString()} XP!**${usedLuckExtra}`

);

}



module.exports = {

    execute

};
