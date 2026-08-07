const database = require("../database");
const xp = require("../utils/xp");
const boosts = require("./boosts");
const XP_LOG_CHANNEL =
    "1527632057574887474";


console.log("XP MODULE:", xp);



const XP_COOLDOWN = 10000;


const cooldowns = new Map();





// ===================================
// GIVE XP
// ===================================


async function giveXP(message){


    if(message.author.bot)
        return null;



    if(!message.guild)
        return null;



    const guildID =
        message.guild.id;


    const userID =
        message.author.id;




    // ======================
    // Cooldown
    // ======================


    if(cooldowns.has(userID)){


        const last =
            cooldowns.get(userID);



        if(
            Date.now() - last
            < XP_COOLDOWN
        ){

            return null;

        }


    }



    cooldowns.set(
        userID,
        Date.now()
    );


const chatUser =
    await database.getUser(
        guildID,
        userID
    );


const currentLevel =
    xp.getLevel(
        Number(chatUser.xp) || 0
    );


const streakData =
    await database.getCriticalStreak(
        guildID,
        userID
    );


const previousCriticalStreak =
    Number(
        streakData.current
    ) || 0;



    // ======================
    // Calculate XP
    // ======================


const reward =
    xp.getXPAmount(
        message.member,
        previousCriticalStreak,
        currentLevel
    );


    const earnedXP =
        reward.xp;


if(reward.critical){

    await database.setCriticalStreak(
        guildID,
        userID,
        reward.criticalStreak
    );

}
else{

    await database.resetCriticalStreak(
        guildID,
        userID
    );

}






    // ======================
    // Get old user
    // ======================


    const user =
        await database.getUser(
            guildID,
            userID
        );



    const oldLevel =
        user.level;







    // ======================
    // Add XP
    // ======================


    await database.addXP(

        guildID,

        userID,

        earnedXP

    );


await database.addXPLog(
    guildID,
    userID,
    earnedXP,
    reward.critical,
    reward.criticalStreak,
    reward.criticalMultiplier,
    "message"
);







    // ======================
    // Boost tracking
    // ======================


    await database.addBoostActivity(

        guildID,

        userID,

        earnedXP

    );








    // ======================
    // Update boosts
    // ======================


    await boosts.updateBoost(
        message.member
    );









    // ======================
    // Level calculation
    // ======================


    const updatedUser =
        await database.getUser(

            guildID,

            userID

        );




    const newLevel =
        xp.getLevel(
            updatedUser.xp
        );





    let leveledUp = false;





    if(newLevel > oldLevel){


        await database.setLevel(

            guildID,

            userID,

            newLevel

        );


        leveledUp = true;

    }








return {


    earnedXP,


    critical:
        reward.critical,


    criticalBonus:
        reward.criticalBonus,


    baseCriticalChance:
        reward.baseCriticalChance,


    luckCriticalBonus:
        reward.luckCriticalBonus,


    momentumBonus:
        reward.momentumBonus,


    criticalChance:
        reward.criticalChance,


    nextCriticalChance:
        reward.nextCriticalChance,


    criticalMultiplier:
        reward.criticalMultiplier,


criticalStreak:
    reward.criticalStreak,


lostCriticalStreak:
    reward.critical
        ? 0
        : previousCriticalStreak,


leveledUp,


        level:
            newLevel,


        user:
            await database.getUser(

                guildID,

                userID

            )


    };


}

// ===================================
// SYNC LEVEL AND ANNOUNCE
// ===================================

const LEVEL_CHANNEL_ID =
    "1324972482951774249";


async function syncLevelAndAnnounce(
    client,
    guildID,
    userID
){


    const user =
        await database.getUser(
            guildID,
            userID
        );


    if(!user){

        return {
            leveledUp: false,
            oldLevel: 1,
            newLevel: 1
        };

    }


    const oldLevel =
        Number(user.level) || 1;


    const newLevel =
        xp.getLevel(
            Number(user.xp) || 0
        );


    // Update the stored level even if it went down.
    if(newLevel !== oldLevel){

        await database.setLevel(
            guildID,
            userID,
            newLevel
        );

    }


    // Only announce actual level-ups.
    if(newLevel > oldLevel){


        const levelChannel =
            await client.channels.fetch(
                LEVEL_CHANNEL_ID
            ).catch(() => null);


        if(levelChannel){


            const levelDifference =
                newLevel - oldLevel;


            let messageText;


            if(levelDifference > 1){

                messageText =

`🎉 Congratulations <@${userID}>! You jumped from **Level ${oldLevel}** to **Level ${newLevel}**!

🔥 You gained **${levelDifference} levels** at once!`;

            }
            else{

                messageText =

`🎉 Congratulations my sweet little pancake aka <@${userID}>! You reached **Level ${newLevel}**!`;

            }


            await levelChannel.send(
                messageText
            ).catch(console.error);

        }


        return {

            leveledUp: true,

            oldLevel,

            newLevel,

            levelsGained:
                newLevel - oldLevel

        };

    }


    return {

        leveledUp: false,

        oldLevel,

        newLevel,

        levelsGained: 0

    };

}






module.exports = {

    giveXP,

    syncLevelAndAnnounce

};
