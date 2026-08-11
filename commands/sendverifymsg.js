const {
    EmbedBuilder
} = require("discord.js");


// =====================================================
// SETTINGS
// =====================================================

const OWNER_ID =
    "1239975819112353969";


const VERIFY_ROLE_ID =
    "1324940845912162324";


const VERIFY_EMOJI =
    "✅";


const VERIFY_EMBED_TITLE =
    "✅ Verification";


const VERIFY_EMBED_FOOTER =
    "Mizuki Verification";


// =====================================================
// COMMAND
// =====================================================

async function execute(message){

    if(!message.guild){
        return;
    }


    // Only the server owner/bot owner can post
    // official Mizuki verification messages.
    if(
        message.author.id !==
            OWNER_ID
    ){

        return message.reply(
            "❌ You cannot use this command."
        );

    }


    const role =
        await message.guild.roles.fetch(
            VERIFY_ROLE_ID
        ).catch(
            () => null
        );


    if(!role){

        return message.reply(
            "❌ I couldn't find the verification Member role."
        );

    }


    const embed =
        new EmbedBuilder()

            .setColor(
                "#57F287"
            )

            .setTitle(
                VERIFY_EMBED_TITLE
            )

            .setDescription(
                `To have access to all of the channels and to be an official <@&${VERIFY_ROLE_ID}> for this server, you'll need to react with ${VERIFY_EMOJI}.\n\n↓ This emoticon`
            )

            .setFooter({
                text:
                    VERIFY_EMBED_FOOTER
            });


    const verifyMessage =
        await message.channel.send({
            embeds: [
                embed
            ]
        });


    await verifyMessage.react(
        VERIFY_EMOJI
    );


    return verifyMessage;

}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    execute,

    VERIFY_ROLE_ID,

    VERIFY_EMOJI,

    VERIFY_EMBED_TITLE,

    VERIFY_EMBED_FOOTER

};
