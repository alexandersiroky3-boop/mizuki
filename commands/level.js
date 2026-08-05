const {
    EmbedBuilder
} = require("discord.js");

const database = require("../database");
const xp = require("../utils/xp");


async function execute(message){


    const user =
        await database.getUser(
            message.guild.id,
            message.author.id
        );


    const currentLevel =
        user.level;


    const currentXP =
        xp.getLevelXP(
            currentLevel
        );


    const nextXP =
        xp.getNextLevelXP(
            currentLevel
        );


    const progressXP =
        user.xp - currentXP;


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



    const bars = 20;


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

> 🏆 **Rank:** #${rank}
> 💬 **Messages:** ${user.messages.toLocaleString()}
> ✦ **Total XP:** ${user.xp.toLocaleString()}`

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