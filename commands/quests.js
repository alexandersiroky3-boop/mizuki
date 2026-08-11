const {
    EmbedBuilder
} = require("discord.js");

const quests =
    require("../systems/quests");


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


function formatCycle(
    cycle,
    cycleName
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


    return (
        `${questText}\n\n` +
        `**${cycleName} Rewards**\n` +
        `${formatRewards(cycle.rewards)}` +
        `${rewardStatus}\n\n` +
        `Resets <t:${resetTimestamp}:R>`
    );

}


async function execute(message){

    if(!message.guild){

        return;

    }


    const dashboard =
        await quests.getDashboard(
            message.guild.id,
            message.author.id
        );


    const embed =
        new EmbedBuilder()

            .setColor(
                "#7A5CFF"
            )

            .setAuthor({
                name:
                    `${message.author.username}'s Quests`,

                iconURL:
                    message.author.displayAvatarURL()
            })

            .setDescription(
                "Complete every quest in a section to receive all of its rewards automatically."
            )

            .addFields(

                {
                    name:
                        "Daily Quests",

                    value:
                        formatCycle(
                            dashboard.daily,
                            "Daily"
                        ),

                    inline:
                        false
                },

                {
                    name:
                        "Weekly Quests",

                    value:
                        dashboard.weeklyLocked
                            ? "**Get to Level 100 to unlock Weekly quests**"
                            : formatCycle(
                                dashboard.weekly,
                                "Weekly"
                            ),

                    inline:
                        false
                }

            )

            .setFooter({
                text:
                    dashboard.weeklyLocked
                        ? "Daily quests reset at 00:00 UTC. Weekly quests unlock at Level 100."
                        : "Daily and weekly quests reset globally at 00:00 UTC."
            })

            .setTimestamp();


    return message.reply({
        embeds: [
            embed
        ]
    });

}


module.exports = {
    execute
};
