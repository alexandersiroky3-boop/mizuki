const {
    EmbedBuilder
} = require("discord.js");


const database =
    require("../database");


const upgrades =
    require("../utils/upgrades");


const OWNER_ID =
    "1239975819112353969";


const USAGE =
    "`!setupgrade [@user/userID] <chatting|rolling|boosts|quests|shop|trading> <level>`";


function parseSetUpgradeArguments(
    content,
    fallbackUserID
){

    const args =
        String(content || "")
            .trim()
            .split(/\s+/)
            .slice(1);


    let targetUserID =
        String(fallbackUserID || "");


    const targetIndex =
        args.findIndex(argument =>
            /^<@!?\d{17,20}>$/.test(argument)
            ||
            /^\d{17,20}$/.test(argument)
        );


    if(targetIndex !== -1){

        targetUserID =
            args[targetIndex]
                .replace(/\D/g, "");


        args.splice(
            targetIndex,
            1
        );

    }


    return {
        targetUserID,
        categoryInput:
            args[0] || "",
        levelInput:
            args[1] || "",
        extraArgumentCount:
            Math.max(
                0,
                args.length - 2
            )
    };

}


function buildUsageMessage(){

    return (
        `Usage: ${USAGE}\n` +
        "Examples:\n" +
        "• `!setupgrade chatting 5` — set yourself\n" +
        "• `!setupgrade @user rolling 3` — set another user\n\n" +
        "Maximums: Chatting `8`, Rolling `6`, Boosts `3`, " +
        "Quests `3`, Shop/Merchant `3`, Trading `2`. Level `0` removes a track's progress."
    );

}


async function execute(message){

    if(message.author.id !== OWNER_ID){

        return message.reply(
            "❌ You cannot use this command."
        );

    }


    if(!message.guild){

        return message.reply(
            "❌ This command can only be used inside the server."
        );

    }


    const parsed =
        parseSetUpgradeArguments(
            message.content,
            message.author.id
        );


    const category =
        upgrades.normalizeCategory(
            parsed.categoryInput
        );


    if(
        !category
        ||
        parsed.levelInput === ""
        ||
        parsed.extraArgumentCount > 0
    ){

        return message.reply(
            buildUsageMessage()
        );

    }


    const requestedLevel =
        Number(parsed.levelInput);


    const maxLevel =
        upgrades.getMaxLevel(
            category
        );


    if(
        !/^\d+$/.test(parsed.levelInput)
        ||
        !Number.isInteger(requestedLevel)
        ||
        requestedLevel < 0
        ||
        requestedLevel > maxLevel
    ){

        return message.reply(
            `❌ **${upgrades.UPGRADE_DEFINITIONS[category].name}** must be between **0 and ${maxLevel}**.\n${USAGE}`
        );

    }


    let targetMember =
        parsed.targetUserID === message.author.id
            ? message.member
            : message.mentions.members.get(
                parsed.targetUserID
            )
            || message.guild.members.cache.get(
                parsed.targetUserID
            );


    if(!targetMember){

        targetMember =
            await message.guild.members.fetch(
                parsed.targetUserID
            ).catch(() => null);

    }


    if(!targetMember){

        return message.reply(
            "❌ That user could not be found in this server."
        );

    }


    try{

        const result =
            await database.setUserUpgradeLevel(
                message.guild.id,
                targetMember.id,
                category,
                requestedLevel
            );


        if(!result.success){

            return message.reply(
                result.status === "invalid-level"
                    ? `❌ That level must be between **0 and ${result.maxLevel}**.`
                    : buildUsageMessage()
            );

        }


        const definition =
            upgrades.UPGRADE_DEFINITIONS[
                result.category
            ];


        const direction =
            result.level > result.previousLevel
                ? "📈 Increased"
                : result.level < result.previousLevel
                    ? "📉 Decreased"
                    : "➖ Unchanged";


        const embed =
            new EmbedBuilder()
                .setColor(
                    result.level < result.previousLevel
                        ? 0xED4245
                        : result.level > result.previousLevel
                            ? 0x57F287
                            : 0xFEE75C
                )
                .setTitle("🧬 Upgrade Override")
                .setDescription(
                    `${direction} **${definition.name}** for ${targetMember}.`
                )
                .addFields(
                    {
                        name: "Upgrade level",
                        value:
                            `**${result.previousLevel}/${result.maxLevel}** ➜ ` +
                            `**${result.level}/${result.maxLevel}**`,
                        inline: true
                    },
                    {
                        name: "Cost",
                        value: "**Free — owner override**",
                        inline: true
                    }
                )
                .setFooter({
                    text:
                        `User ID: ${targetMember.id} • Track: ${result.category}`
                });


        return message.reply({
            embeds: [embed],
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }
    catch(error){

        console.error(
            "Could not set owner upgrade override:",
            error
        );


        return message.reply(
            "❌ The upgrade could not be changed. Nothing was charged or removed."
        );

    }

}


module.exports = {
    OWNER_ID,
    USAGE,
    parseSetUpgradeArguments,
    buildUsageMessage,
    execute
};
