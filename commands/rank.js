const {
    EmbedBuilder
} = require("discord.js");

const database = require("../database");
const xp = require("../utils/xp");


async function execute(message){


    const leaderboard =
        await database.getLeaderboard(
            message.guild.id,
            10
        );



    if(leaderboard.length === 0){

        return message.reply(
            "Nobody has earned XP yet!"
        );

    }



    const medals = [
        "🥇",
        "🥈",
        "🥉"
    ];



    let description = "";



    for(const [index,user] of leaderboard.entries()){



        const member =
            await message.guild.members
                .fetch(user.userid)
                .catch(()=>null);



        const username =
            member
            ? member.user.username
            : "Unknown User";



        const currentXP =
            xp.getLevelXP(
                user.level
            );



        const nextXP =
            xp.getNextLevelXP(
                user.level
            );



        const progress =
            user.xp - currentXP;



        const needed =
            nextXP - currentXP;



        const percent =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.floor(
                        progress / needed * 100
                    )
                )
            );



        const filled =
            Math.round(
                percent / 10
            );



        const bar =
            "🟦".repeat(filled) +
            "⬜".repeat(10 - filled);



        const place =
            medals[index] ??
            `**#${index+1}**`;



        description +=

`${place} **${username}**
> ★ **Level ${user.level}** • ✦ **${user.xp.toLocaleString()} XP**
> ${bar} **${percent}%**

`;

    }



    const embed =
        new EmbedBuilder()

        .setColor("#5FE1E6")

        .setTitle("🏆 Server Leaderboard")

        .setDescription(description)

        .setThumbnail(
            message.guild.iconURL({
                size:1024
            })
        )

        .setFooter({
            text:
            `Top ${leaderboard.length} Players`
        })

        .setTimestamp();



    message.reply({

        embeds:[embed]

    });


}



module.exports = {

    execute

};