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
            percentage / 12.5
        );


    return (
        "█".repeat(filled) +
        "░".repeat(8 - filled)
    );

}


function formatQuest(quest){

    const current =
        Math.min(
            Number(quest.progress) || 0,
            Number(quest.target) || 0
        );


    const target =
        Math.max(
            1,
            Number(quest.target) || 1
        );


    const percentage =
        quest.completed
            ? 100
            : Math.floor(
                Math.min(
                    100,
                    current / target * 100
                )
            );


    return (
        `${quest.completed ? "✅" : quest.icon} **${quest.label}**\n` +
        `\`${progressBar(
            current,
            quest.target,
            quest.completed
        )}\` **${current.toLocaleString()} / ${target.toLocaleString()}** • ${percentage}%`
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


function getResetPrice(
    cycleType,
    dashboard
){

    return quests.getQuestResetPrice(
        cycleType,
        dashboard.questUpgradeLevel
    );

}


function createNavigationButtons(
    activeView,
    disableAll = false
){

    return new ActionRowBuilder()
        .addComponents(
            ...[
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["info", "Info"]
            ].map(([view, label]) =>
                new ButtonBuilder()
                    .setCustomId(
                        `quests_view:${view}`
                    )
                    .setLabel(label)
                    .setStyle(
                        view === activeView
                            ? ButtonStyle.Primary
                            : ButtonStyle.Secondary
                    )
                    .setDisabled(
                        disableAll ||
                        view === activeView
                    )
            )
        );

}


function createResetButtons(
    dashboard,
    activeView = "daily",
    disableAll = false
){

    if(typeof activeView === "boolean"){
        disableAll = activeView;
        activeView = "daily";
    }


    const cycleType =
            ["daily", "weekly"].includes(activeView)
                ? activeView
                : null;


    if(!cycleType){
        return [];
    }


    const cycle =
        dashboard[cycleType];


    const config =
        quests.QUEST_RESET_CONFIG[cycleType];


    const price =
        getResetPrice(
            cycleType,
            dashboard
        );


    const used =
        getResetCount(cycle);


    const completed =
        quests.isQuestCycleCompleted(cycle);


    let label =
        `Reset ${cycleType === "daily" ? "Daily" : "Weekly"} • ${price.toLocaleString()} XP`;


    if(!dashboard.questResetUnlocked){
        label = "Reset locked • Quest Upgrade 2";
    }
    else if(completed){
        label = "Completed • Reset unavailable";
    }
    else if(used >= config.maxResets){
        label = "Reset already used";
    }


    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `quests_reset:${cycleType}`
                    )
                    .setLabel(label)
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        disableAll ||
                        !dashboard.questResetUnlocked ||
                        !cycle ||
                        completed ||
                        used >= config.maxResets
                    )
            )
    ];

}


async function buildQuestPanel(
    guildID,
    user,
    activeView = "daily",
    disableAll = false
){

    if(typeof activeView === "boolean"){
        disableAll = activeView;
        activeView = "daily";
    }


    const selectedView =
        ["daily", "weekly", "info"].includes(activeView)
            ? activeView
            : "daily";

    const dashboard =
        await quests.getDashboard(
            guildID,
            user.id
        );


    const embed =
            new EmbedBuilder()
                .setColor(
                    selectedView === "daily"
                        ? "#5865F2"
                        : selectedView === "weekly"
                            ? "#D6A13B"
                            : "#3B3F46"
                )
                .setAuthor({
                    name: `${user.username}'s Quests`,
                    iconURL: user.displayAvatarURL()
                });


    if(selectedView === "info"){
            const upgradeLevel =
                Number(dashboard.questUpgradeLevel) || 0;


            const resetStatus =
                dashboard.questResetUnlocked
                    ? "Unlocked"
                    : "Locked until Quest Upgrade 2";


            const dailyRewardCount =
                upgradeLevel === 0
                    ? "2"
                    : upgradeLevel === 1
                        ? "3–4"
                        : "4";


            const weeklyRewardCount =
                upgradeLevel === 0
                    ? "3"
                    : upgradeLevel === 1
                        ? "4–5"
                        : "5";


            embed
                .setTitle("Quest information")
                .setDescription(
                    "Quest upgrades improve the rewards. They do **not** make the Daily or Weekly objectives harder."
                )
                .addFields(
                    {
                        name: "Current upgrade",
                        value:
                            `**Quest Upgrade ${upgradeLevel}/3**\n` +
                            `Daily rewards: **${dailyRewardCount}**\n` +
                            `Weekly rewards: **${weeklyRewardCount}**`,
                        inline: true
                    },
                    {
                        name: "Paid resets",
                        value:
                            `**${resetStatus}**\n` +
                            `Daily: **${getResetPrice("daily", dashboard).toLocaleString()} XP**\n` +
                            `Weekly: **${getResetPrice("weekly", dashboard).toLocaleString()} XP**`,
                        inline: true
                    },
                    {
                        name: "Upgrade rewards",
                        value:
                            "**1:** More rewards + Power Runes\n" +
                            "**2:** Resets + 15% Weekly special boost chance\n" +
                            "**3:** 10% Daily / 45% Weekly special boost chance, half-price resets, and a 5% Weekly double-reward chance",
                        inline: false
                    },
                    {
                        name: "Reset schedule",
                        value:
                            `Daily renews <t:${Math.floor(Number(dashboard.daily.expiresat) / 1000)}:R>\n` +
                            `Weekly renews <t:${Math.floor(Number(dashboard.weekly.expiresat) / 1000)}:R>`,
                        inline: false
                    }
                )
                .setFooter({
                    text: "Rewards are claimed automatically when all quests in a section are complete."
                });
    }
    else{
            const cycle =
                dashboard[selectedView];


            const completedCount =
                cycle.quests.filter(
                    quest => Boolean(quest.completed)
                ).length;


            const totalCount =
                cycle.quests.length;


            const resetConfig =
                quests.QUEST_RESET_CONFIG[selectedView];


            const resetCount =
                getResetCount(cycle);


            const resetText =
                !dashboard.questResetUnlocked
                    ? "Paid reset locked"
                    : quests.isQuestCycleCompleted(cycle)
                        ? "Reset unavailable after completion"
                        : `Paid reset ${resetCount}/${resetConfig.maxResets}`;


            embed
                .setTitle(
                    selectedView === "daily"
                        ? "Daily quests"
                        : "Weekly quests"
                )
                .setDescription(
                    `**${completedCount}/${totalCount} complete** • ${resetText} • Renews <t:${Math.floor(Number(cycle.expiresat) / 1000)}:R>\n\n` +
                    cycle.quests
                        .map(formatQuest)
                        .join("\n\n")
                )
                .addFields({
                    name:
                        cycle.rewarded
                            ? "Rewards claimed"
                            : "Rewards",
                    value:
                        formatRewards(cycle.rewards),
                    inline: false
                })
                .setFooter({
                    text:
                        `Quest Upgrade ${Number(dashboard.questUpgradeLevel) || 0}/3 • Rewards claim automatically`
                });
    }


    return {
        embeds: [embed],
        components: [
            createNavigationButtons(
                selectedView,
                disableAll
            ),
            ...createResetButtons(
                dashboard,
                selectedView,
                disableAll
            )
        ],
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


    if(result.status === "reset-upgrade-locked"){

        return (
            "🔒 Paid quest resets require **Quest Upgrade 2/3**. " +
            "Use `!upgrades` to unlock them."
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


    let activeView =
        "daily";


    const questMessage =
        await message.reply(
            await buildQuestPanel(
                message.guild.id,
                message.author,
                activeView
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


            if(
                action !== "quests_view"
                &&
                action !== "quests_reset"
            ){
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


            if(action === "quests_view"){
                activeView =
                    ["daily", "weekly", "info"].includes(cycleType)
                        ? cycleType
                        : "daily";


                await interaction.deferUpdate();


                return questMessage.edit(
                    await buildQuestPanel(
                        interaction.guild.id,
                        message.author,
                        activeView
                    )
                );
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
                            message.author,
                            activeView
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
    createNavigationButtons,
    createResetButtons,
    getResetResultMessage
};
