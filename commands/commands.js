const { EmbedBuilder } = require("discord.js");


async function execute(message) {


    const embed = new EmbedBuilder()

        .setColor("#8A2BE2")

        .setTitle("📜 Bot Commands")

        .setDescription(
`
Here are all available commands:

★ **Level System**

\`!level\`
> Shows your level, XP, message count and progress.

\`!rank\`
> Shows the server XP leaderboard.

\`!boost\`
> Shows your current XP Boost Tier, timer, progress and next tier.

\`!shop\`
> Buy boosts & more from the shop.


🥵 **Fun Commands**

\`!ping\`
> Just pings the bot, nothing special...

\`!kiss @user/userid/bot\`
> You're able to kiss the user..... and even the bot~

\`!steal @user/userid/bot\`
> You can steal XP from other users... or even the bot

\`!hug @user/userid/bot\`
> You can hug other users and even the bot

\`!ezwin\`
> Takes everyone's XP (except you) and you gain XP...

\`!roll\`
> Roll a dice and get random XP rewards (you can earn/lose big amount of XP)...

\`!warn @user/userid\`
> Warn a bad behaving little user and remove 500+ XP from them...
> My dad can only use this. (aka Kape)


✦ **XP Management**

\`!givexp userid amount\`
> Gives XP to a user.
> My dad can only use this. (aka Kape)

\`!setlevel userid levelamount\`
> Sets a specific level to a user.
> My dad can only use this. (aka Kape)


⚙️ **System**

\`!logs\`
> Shows the last 20 XP logs of the user.

\`!commands\`
> Shows this command list.

*more commands are coming*
`
        )

        .setFooter({
            text: "my own level system because arcane sucks :3"
        })

        .setTimestamp();



    message.reply({
        embeds:[embed]
    });


}



module.exports = {

    execute

};
