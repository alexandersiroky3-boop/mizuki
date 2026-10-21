const {EmbedBuilder} = require("discord.js");
const chests = require("../systems/chests");


function buildCommandsEmbed(guild = null){

    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("📖 Mizuki Commands")
        .setDescription(
            "Use `!` before each command. Commands marked 🔒 must first be obtained or unlocked."
        )
        .addFields(
            {
                name: "📈 Progress & economy",
                value:
                    "`!level` • `!rank` / `!leaderboard` • `!quests` • `!upgrades`\n" +
                    "`!boost` • `!values` • `!sell` • `!shop` • `!merchant` • `!trade @user`"
            },
            {
                name: "🎲 XP commands",
                value:
                    "`!roll` • `!hug @user` • `!kiss @user` • `!steal @user`\n" +
                    "`!troll @user` • `!ezwin` • `!boss`"
            },
            {
                name: "🔒 Obtainable commands",
                value:
                    "`!fight @user` — complete Boss Challenge #3\n" +
                    `\`!bless everyone\` — ${chests.getChestEmoji(guild, "bronze")} Bronze Chest reward\n` +
                    `\`!spawnboss\` — consumes one ${chests.getChestEmoji(guild, "boss")} Boss Chest reward use\n` +
                    `\`!coinflip heads|tails <XP> <1.1x-10x>\` — ${chests.getChestEmoji(guild, "boss")} Boss Chest reward`
            },
            {
                name: "🧰 Utility",
                value:
                    "`!afk` • `!mute` • `!updates` • `!ping` • `!commands`"
            },
            {
                name: "🛡️ Staff",
                value:
                    "`!warn @user` • `!ban @user` • `!unban userID` • `!kick @user` • `!permaban userID`"
            }
        )
        .setFooter({
            text: "Open !boost for chests • Open !boss for raids, challenges, and the Boss Shop"
        });

}


async function execute(message){

    if(!message.guild){
        return null;
    }


    return message.reply({
        embeds: [buildCommandsEmbed(message.guild)],
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

}


module.exports = {
    execute,
    buildCommandsEmbed
};
