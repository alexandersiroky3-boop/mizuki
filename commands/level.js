const {
    EmbedBuilder
} = require("discord.js");

const database = require("../database");
const xp = require("../utils/xp");
const levelRoles =
    require("../systems/levelRoles");


async function execute(message){


    const user =
        await database.getUser(
            message.guild.id,
            message.author.id
        );


    const totalXP =
        Math.max(
            0,
            Number(user.xp) || 0
        );


    // Always calculate the real level from total XP instead
    // of trusting a possibly stale stored level.
    //
    // This also repairs old trade cases where XP was removed
    // but the stored level had not been lowered yet.
    const currentLevel =
        xp.getLevel(
            totalXP
        );


    const storedLevel =
        Number(user.level) || 1;


    if(currentLevel !== storedLevel){

        await database.setLevel(
            message.guild.id,
            message.author.id,
            currentLevel
        );

    }


    const levelRoleResult =
        await levelRoles.syncMemberLevelRole(
            message.member,
            currentLevel
        );


    const levelRoleMention =
        levelRoleResult?.role?.roleID
            ? `<@&${levelRoleResult.role.roleID}>`
            : "None";


    const currentXP =
        xp.getLevelXP(
            currentLevel
        );


    const nextXP =
        xp.getNextLevelXP(
            currentLevel
        );


    const progressXP =
        Math.max(
            0,
            totalXP - currentXP
        );


    const neededXP =
        nextXP - currentXP;



    let percentage =
        Math.floor(
            (progressXP / neededXP) * 100
        );


    if(percentage < 0)
        percentage = 0;


    if(percentage > 100)
        percentage = 100;



    // 10 blocks keeps the progress bar compact on mobile.
    const bars = 10;


    const filled =
        Math.round(
            bars * percentage / 100
        );


    const progressBar =
        "🟪".repeat(filled) +
        "⬛".repeat(bars - filled);




    const leaderboard =
        await database.getLeaderboard(
            message.guild.id,
            999999
        );



    const rank =
        leaderboard.findIndex(
            u =>
            u.userid === message.author.id
        ) + 1;



    const embed =
        new EmbedBuilder()

        .setColor("#7A5CFF")

        .setAuthor({

            name:
            `${message.author.username}`,

            iconURL:
            message.author.displayAvatarURL()

        })


        .setThumbnail(

            message.author.displayAvatarURL({

                size:1024

            })

        )


        .setDescription(

`## ★ Level ${currentLevel}

${progressBar}

**${progressXP.toLocaleString()} / ${neededXP.toLocaleString()} XP**

\`${percentage}% Complete\`

> 🎖️ **Level Role:** ${levelRoleMention}
> 🏆 **Rank:** #${rank}
> 💬 **Messages:** ${user.messages.toLocaleString()}
> ✦ **Total XP:** ${totalXP.toLocaleString()}`

        )


        .setFooter({

            text:
            "GothMommy Level System"

        })


        .setTimestamp();



    message.reply({

        embeds:[embed]

    });


}



module.exports = {

    execute

};
