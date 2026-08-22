const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const database =
    require("../database");


const MUTE_PANEL_DURATION_MS =
    2 * 60 * 1000;


function buildMutePanel(
    preferences,
    disabled = false
){

    const xpMuted =
        Boolean(
            preferences?.xpBoostMessages
        );


    const criticalMuted =
        Boolean(
            preferences?.criticalMessages
        );


    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("mute_xp_boost_messages")
                    .setLabel(
                        `XP Boost Replies: ${xpMuted ? "MUTED" : "ON"}`
                    )
                    .setEmoji("⚡")
                    .setStyle(
                        xpMuted
                            ? ButtonStyle.Danger
                            : ButtonStyle.Success
                    )
                    .setDisabled(disabled),

                new ButtonBuilder()
                    .setCustomId("mute_critical_messages")
                    .setLabel(
                        `Critical Replies: ${criticalMuted ? "MUTED" : "ON"}`
                    )
                    .setEmoji("💥")
                    .setStyle(
                        criticalMuted
                            ? ButtonStyle.Danger
                            : ButtonStyle.Success
                    )
                    .setDisabled(disabled)
            );


    return {
        content:
            "## 🔕 Personal Reply Settings\n" +
            "Choose which replies Mizuki should mute **for your account only**. " +
            "Your rewards, XP, boosts, criticals, reactions, and other users' messages are not affected.\n\n" +
            `⚡ XP Boost replies: **${xpMuted ? "MUTED" : "ON"}**\n` +
            `💥 Critical streak/loss replies: **${criticalMuted ? "MUTED" : "ON"}**` +
            (disabled ? "\n\n*Run `!mute` again to change these settings.*" : ""),
        components: [row],
        allowedMentions: {
            parse: []
        }
    };

}


async function execute(message){

    if(!message.guild){
        return;
    }


    let preferences =
        await database.getMessageMutePreferences(
            message.guild.id,
            message.author.id
        );


    const panel =
        await message.reply(
            buildMutePanel(
                preferences
            )
        );


    const collector =
        panel.createMessageComponentCollector({
            componentType:
                ComponentType.Button,
            time:
                MUTE_PANEL_DURATION_MS
        });


    collector.on("collect", async interaction => {

        try{

        if(interaction.user.id !== message.author.id){

            await interaction.reply({
                content:
                    "These are someone else's personal mute settings. Run `!mute` to open yours.",
                flags:
                    MessageFlags.Ephemeral
            }).catch(() => {});

            return;

        }


        const type =
            interaction.customId === "mute_xp_boost_messages"
                ? "xp_boost"
                : interaction.customId === "mute_critical_messages"
                    ? "critical"
                    : null;


        if(!type){
            return;
        }


        preferences =
            await database.toggleMessageTypeMute(
                message.guild.id,
                message.author.id,
                type
            );


        await interaction.update(
            buildMutePanel(
                preferences
            )
        );

        }
        catch(error){

            console.error(
                "Personal mute interaction failed:",
                error
            );


            const errorReply = {
                content:
                    "I couldn't save that setting right now. Please press it again or rerun `!mute`.",
                flags:
                    MessageFlags.Ephemeral
            };


            if(
                interaction.replied
                ||
                interaction.deferred
            ){

                await interaction.followUp(
                    errorReply
                ).catch(() => {});

            }
            else{

                await interaction.reply(
                    errorReply
                ).catch(() => {});

            }

        }

    });


    collector.once("end", async() => {

        await panel.edit(
            buildMutePanel(
                preferences,
                true
            )
        ).catch(() => {});

    });


    return panel;

}


module.exports = {
    execute,
    buildMutePanel
};
