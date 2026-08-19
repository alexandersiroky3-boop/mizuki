const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const quests =
    require("../systems/quests");

const leveling =
    require("../systems/leveling");


function progressBar(
    progress,
    target,
    completed
){

    const safeTarget =
        Math.max(
            1,
            Number(target) || 1
        );


    const percentage =
        completed
            ? 100
            : Math.max(
                0,
                Math.min(
                    100,
                    Math.floor(
                        (
                            Number(progress) /
                            safeTarget
                        ) * 100
                    )
                )
            );


    const filled =
        Math.round(
            percentage / 10
        );


    return (
        "■".repeat(filled) +
        "□".repeat(10 - filled)
    );

}


function formatQuest(quest){

    const current =
        Math.min(
            Number(quest.progress) || 0,
            Number(quest.target) || 0
        );


    const status =
        quest.completed
            ? "Completed"
            : `${current.toLocaleString()} / ${Number(quest.target).toLocaleString()}`;


    return (
        `${quest.icon} **${quest.label}**\n` +
        `\`${progressBar(
            current,
            quest.target,
            quest.completed
        )}\` **${status}**`
    );

}


function formatRewards(rewards){

    return rewards
        .map(
            reward =>
                `• ${quests.formatReward(reward)}`
        )
        .join("\n");

}


function getResetCount(cycle){

    return Math.max(
        0,
        Number(
            cycle?.resetcount || 0
        )
    );

}


function formatCycle(
    cycle,
    cycleName,
    cycleType
){

    const questText =
        cycle.quests
            .map(formatQuest)
            .join("\n\n");


    const rewardStatus =
        cycle.rewarded
            ? "\n\n**All rewards claimed.**"
            : "";


    const resetTimestamp =
        Math.floor(
            Number(cycle.expiresat) /
            1000
        );


    const resetConfig =
        quests.QUEST_RESET_CONFIG[
            cycleType
        ];


    return (
        `${questText}\n\n` +
        `**${cycleName} Rewards**\n` +
        `${formatRewards(cycle.rewards)}` +
        `${rewardStatus}\n\n` +
        `Paid resets used: **${getResetCount(cycle)}/${resetConfig.maxResets}**\n` +
        `Naturally resets <t:${resetTimestamp}:R>`
    );

}


function formatResetOptions(dashboard){

    const dailyConfig =
        quests.QUEST_RESET_CONFIG.daily;


    const weeklyConfig =
        quests.QUEST_RESET_CONFIG.weekly;


    const dailyUsed =
        getResetCount(
            dashboard.daily
        );


    const weeklyUsed =
        getResetCount(
            dashboard.weekly
        );


    const dailyCompleted =
        quests.isQuestCycleCompleted(
            dashboard.daily
        );


    const weeklyCompleted =
        quests.isQuestCycleCompleted(
            dashboard.weekly
        );


    return (
        `🔄 **Daily:** ${dailyConfig.price.toLocaleString()} XP • ` +
        (
            dailyCompleted
                ? "**Completed — reset unavailable**"
                : `**${Math.max(0, dailyConfig.maxResets - dailyUsed)}** reset(s) remaining today`
        ) +
        "\n" +
        `🔁 **Weekly:** ${weeklyConfig.price.toLocaleString()} XP • ` +
        (
            dashboard.weeklyLocked
                ? `Locked until Level ${quests.QUEST_UNLOCK_LEVEL}`
                : weeklyCompleted
                    ? "**Completed — reset unavailable**"
                    : `**${Math.max(0, weeklyConfig.maxResets - weeklyUsed)}** reset(s) remaining this week`
        ) +
        "\n\nA paid reset only rerolls an **unfinished** section. It replaces that section's quests and rewards and erases **all current progress**. A completed section cannot be reset."
    );

}


function createResetButtons(
    dashboard,
    disableAll = false
){

    const dailyConfig =
        quests.QUEST_RESET_CONFIG.daily;


    const weeklyConfig =
        quests.QUEST_RESET_CONFIG.weekly;


    const dailyUsed =
        getResetCount(
            dashboard.daily
        );


    const weeklyUsed =
        getResetCount(
            dashboard.weekly
        );


    const dailyCompleted =
        quests.isQuestCycleCompleted(
            dashboard.daily
        );


    const weeklyCompleted =
        quests.isQuestCycleCompleted(
            dashboard.weekly
        );


    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "quests_reset:daily"
                    )
                    .setLabel(
                        dailyCompleted
                            ? "Daily Completed - Reset Locked"
                            : `Reset Daily - ${dailyConfig.price.toLocaleString()} XP (${dailyUsed}/${dailyConfig.maxResets})`
                    )
                    .setEmoji("🔄")
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        disableAll
                        ||
                        dailyCompleted
                        ||
                        dailyUsed >=
                            dailyConfig.maxResets
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        "quests_reset:weekly"
                    )
                    .setLabel(
                        weeklyCompleted
                            ? "Weekly Completed - Reset Locked"
                            : `Reset Weekly - ${weeklyConfig.price.toLocaleString()} XP (${weeklyUsed}/${weeklyConfig.maxResets})`
                    )
                    .setEmoji("🔁")
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        disableAll
                        ||
                        dashboard.weeklyLocked
                        ||
                        !dashboard.weekly
                        ||
                        weeklyCompleted
                        ||
                        weeklyUsed >=
                            weeklyConfig.maxResets
                    )
            )
    ];

}


async function buildQuestPanel(
    guildID,
    user,
    disableAll = false
){

    const dashboard =
        await quests.getDashboard(
            guildID,
            user.id
        );


    const embed =
        new EmbedBuilder()
            .setColor("#7A5CFF")
            .setAuthor({
                name:
                    `${user.username}'s Quests`,
                iconURL:
                    user.displayAvatarURL()
            })
            .setDescription(
                "Complete every quest in a section to receive all of its rewards automatically. Use the separate reset buttons only when you want to replace a section."
            )
            .addFields(
                {
                    name: "Daily Quests",
                    value:
                        formatCycle(
                            dashboard.daily,
                            "Daily",
                            "daily"
                        ),
                    inline: false
                },
                {
                    name: "Weekly Quests",
                    value:
                        dashboard.weeklyLocked
                            ? `**Get to Level ${quests.QUEST_UNLOCK_LEVEL} to unlock Weekly quests**`
                            : formatCycle(
                                dashboard.weekly,
                                "Weekly",
                                "weekly"
                            ),
                    inline: false
                },
                {
                    name: "Paid Quest Resets",
                    value:
                        formatResetOptions(
                            dashboard
                        ),
                    inline: false
                }
            )
            .setFooter({
                text:
                    dashboard.weeklyLocked
                        ? "Daily resets renew at 00:00 UTC. Weekly quests unlock at Level 100."
                        : "Daily reset uses renew each day; weekly reset uses renew each Monday at 00:00 UTC."
            })
            .setTimestamp();


    return {
        embeds: [
            embed
        ],
        components:
            createResetButtons(
                dashboard,
                disableAll
            ),
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    };

}


function getResetResultMessage(
    result,
    cycleType
){

    const cycleName =
        cycleType === "daily"
            ? "Daily"
            : "Weekly";


    if(result.success){

        return (
            `✅ **${cycleName} quests were rerolled and all previous progress was cleared.**\n` +
            `Cost: **${Number(result.price).toLocaleString()} XP**\n` +
            `XP balance: **${Number(result.balance).toLocaleString()} XP**\n` +
            `Resets used: **${result.resetCount}/${result.maxResets}**\n` +
            `Resets remaining: **${result.remainingResets}**`
        );

    }


    if(result.status === "quests-completed"){

        const nextResetTimestamp =
            Math.floor(
                Number(result.nextResetAt) /
                1000
            );


        return (
            `🏁 Your ${cycleName.toLowerCase()} quests are already **completed**. ` +
            "Completed quest sections cannot be reset.\n" +
            `New ${cycleName.toLowerCase()} quests arrive <t:${nextResetTimestamp}:R>.`
        );

    }


    if(result.status === "not-enough-xp"){

        return (
            `❌ You need **${Number(result.price).toLocaleString()} XP** to reset your ${cycleName.toLowerCase()} quests.\n` +
            `Current balance: **${Number(result.balance).toLocaleString()} XP**\n` +
            `Missing: **${Number(result.missing).toLocaleString()} XP**`
        );

    }


    if(result.status === "reset-limit-reached"){

        const nextResetTimestamp =
            Math.floor(
                Number(result.nextResetAt) /
                1000
            );


        return (
            `❌ You already used all **${result.maxResets} ${cycleName.toLowerCase()} resets** for this cycle.\n` +
            `They renew <t:${nextResetTimestamp}:R>.`
        );

    }


    if(result.status === "weekly-locked"){

        return (
            `🔒 Weekly quests and resets unlock at **Level ${result.unlockLevel}**. ` +
            `Your current level is **${result.level}**.`
        );

    }


    if(
        result.status === "cycle-expired"
        ||
        result.status === "missing-cycle"
    ){

        return (
            `🔄 Your ${cycleName.toLowerCase()} quest cycle changed while you were clicking. ` +
            "The panel has been refreshed; try again if you still want to reset it."
        );

    }


    return (
        `❌ Your ${cycleName.toLowerCase()} quests could not be reset.`
    );

}


async function execute(message){

    if(!message.guild){
        return;
    }


    const panelOwnerID =
        message.author.id;


    const questMessage =
        await message.reply(
            await buildQuestPanel(
                message.guild.id,
                message.author
            )
        );


    const collector =
        questMessage.createMessageComponentCollector({
            componentType:
                ComponentType.Button
        });


    collector.on(
        "collect",
        async interaction => {

            const [
                action,
                cycleType
            ] = interaction.customId.split(":");


            if(action !== "quests_reset"){
                return;
            }


            if(interaction.user.id !== panelOwnerID){

                return interaction.reply({
                    content:
                        "This quest panel belongs to someone else. Use **!quests** to open your own reset buttons.",
                    flags:
                        MessageFlags.Ephemeral
                });

            }


            try{

                await interaction.deferReply({
                    flags:
                        MessageFlags.Ephemeral
                });


                const result =
                    await quests.resetQuestCycle(
                        interaction.guild.id,
                        interaction.user.id,
                        cycleType
                    );


                if(result.success){

                    try{

                        const levelResult =
                            await leveling.syncLevelAndAnnounce(
                                interaction.client,
                                interaction.guild.id,
                                interaction.user.id
                            );


                        await quests.recordLevelChange(
                            interaction,
                            levelResult,
                            interaction.user.id
                        );

                    }
                    catch(error){

                        console.error(
                            "Quest reset level sync failed:",
                            error
                        );

                    }

                }


                try{

                    const updatedPanel =
                        await buildQuestPanel(
                            interaction.guild.id,
                            message.author
                        );


                    await questMessage.edit(
                        updatedPanel
                    );

                }
                catch(error){

                    console.error(
                        "Could not refresh the quest panel:",
                        error
                    );

                }


                await interaction.editReply({
                    content:
                        getResetResultMessage(
                            result,
                            cycleType
                        )
                });

            }
            catch(error){

                console.error(
                    "Quest reset failed:",
                    error
                );


                const content =
                    "The quest reset ran into an error. Reopen **!quests** before trying again so you can check whether it completed.";


                if(
                    interaction.deferred
                    ||
                    interaction.replied
                ){

                    await interaction.editReply({
                        content
                    }).catch(() => {});

                }
                else{

                    await interaction.reply({
                        content,
                        flags:
                            MessageFlags.Ephemeral
                    }).catch(() => {});

                }

            }

        }
    );


    return questMessage;

}


module.exports = {
    execute,
    buildQuestPanel,
    createResetButtons,
    getResetResultMessage
};
