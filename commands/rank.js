const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    escapeMarkdown
} = require("discord.js");

const database = require("../database");
const xp = require("../utils/xp");
const leveling = require("../systems/leveling");


const LEADERBOARD_LIMIT = 10;

const OWNER_ID =
    "1239975819112353969";

const RESET_ANNOUNCEMENT_CHANNEL_ID =
    "1324937238190227592";

const BUTTON_LIFETIME =
    15 * 60 * 1000;


const PERIODS = {

    all: {
        title: "🏆 All-Time Leaderboard",
        buttonLabel: "All-Time",
        buttonEmoji: "🏆",
        footer: "All-time XP"
    },

    monthly: {
        title: "🗓️ Monthly Leaderboard",
        buttonLabel: "Monthly",
        buttonEmoji: "🗓️",
        footer: "XP earned in the current monthly cycle"
    },

    weekly: {
        title: "📅 Weekly Leaderboard",
        buttonLabel: "Weekly",
        buttonEmoji: "📅",
        footer: "XP earned in the current weekly cycle"
    },

    info: {
        title: "ℹ️ Rank Rewards & Info",
        buttonLabel: "Info",
        buttonEmoji: "ℹ️",
        footer: "Current weekly and monthly prize pools"
    }

};


function buildButtons(
    selectedPeriod,
    disableAll = false
){


    const buttons =
        Object.entries(PERIODS)
            .map(([period, details]) =>

                new ButtonBuilder()

                    .setCustomId(
                        `leaderboard:${period}`
                    )

                    .setLabel(
                        details.buttonLabel
                    )

                    .setEmoji(
                        details.buttonEmoji
                    )

                    .setStyle(
                        period === selectedPeriod
                            ? ButtonStyle.Primary
                            : ButtonStyle.Secondary
                    )

                    .setDisabled(
                        disableAll ||
                        period === selectedPeriod
                    )

            );


    return new ActionRowBuilder()
        .addComponents(buttons);

}


function formatRewardList(rewards){

    if(!Array.isArray(rewards) || rewards.length === 0){
        return "No reward configured.";
    }


    return rewards
        .map(reward =>
            `• ${String(reward.label || "Reward")}`
        )
        .join("\n")
        .slice(0, 1024);

}


function buildCycleFields(
    cycle,
    options = {}
){

    if(!cycle){
        return [];
    }


    const includeRewards =
        options.includeRewards !== false;


    const cycleLabel =
        String(options.cycleLabel || "")
            .trim();


    const resetTimestamp =
        Math.floor(
            Number(cycle.cycleEnd) /
            1000
        );


    const resetValue = [
        `Automatic reset: <t:${resetTimestamp}:F>`,
        `Countdown: <t:${resetTimestamp}:R>`
    ];


    if(cycle.period === "monthly"){

        resetValue.push(
            `Reward type: **${cycle.rewardMode === "money" ? "Money" : "Normal"}**`
        );

    }


    const fields = [
        {
            name: cycleLabel
                ? `${cycle.period === "weekly" ? "📅" : "🗓️"} ${cycleLabel} Cycle`
                : "⏳ Current Cycle",
            value: resetValue.join("\n"),
            inline: false
        }
    ];


    if(!includeRewards){
        return fields;
    }


    const medals = ["🥇", "🥈", "🥉"];


    fields.push(
        ...medals.map((medal, index) => ({
            name:
                `${medal} ${cycleLabel ? `${cycleLabel} ` : ""}` +
                `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"} Place Rewards`,
            value: formatRewardList(
                cycle.rewards?.[
                    String(index + 1)
                ]
            ),
            inline: false
        }))
    );


    return fields;

}


async function getLeaderboard(
    guildID,
    period
){


    if(period === "all"){

        return database.getLeaderboard(
            guildID,
            LEADERBOARD_LIMIT
        );

    }


    return database.getPeriodLeaderboard(
        guildID,
        period,
        LEADERBOARD_LIMIT
    );

}


async function resolveUsernames(
    guild,
    leaderboard
){


    const entries =
        await Promise.all(

            leaderboard.map(async user => {

                const userID =
                    String(
                        user.userid ??
                        user.userID
                    );


                const cachedMember =
                    guild.members.cache.get(
                        userID
                    );


                const member =
                    cachedMember ??
                    await guild.members
                        .fetch(userID)
                        .catch(() => null);


                const username =
                    member
                        ? escapeMarkdown(
                            member.user.username
                        )
                        : `Unknown User (${userID})`;


                return {
                    ...user,
                    username,
                    userID
                };

            })

        );


    return entries;

}


function makeProgressBar(user){


    const level =
        Number(user.level) || 1;


    const totalXP =
        Number(user.xp) || 0;


    const currentXP =
        xp.getLevelXP(level);


    const nextXP =
        xp.getNextLevelXP(level);


    const progress =
        totalXP - currentXP;


    const needed =
        nextXP - currentXP;


    const percent =
        needed > 0
            ? Math.max(
                0,
                Math.min(
                    100,
                    Math.floor(
                        progress / needed * 100
                    )
                )
            )
            : 100;


    const filled =
        Math.round(
            percent / 10
        );


    return {

        percent,

        bar:
            "🟦".repeat(filled) +
            "⬜".repeat(10 - filled)

    };

}


function buildDescription(
    leaderboard,
    period
){


    if(leaderboard.length === 0){

        if(period === "weekly"){

            return (
                "*Nobody has earned XP in the " +
                "current weekly cycle yet!*"
            );

        }


        if(period === "monthly"){

            return (
                "*Nobody has earned XP in the " +
                "current monthly cycle yet!*"
            );

        }


        return "*Nobody has earned XP yet!*";

    }


    const medals = [
        "🥇",
        "🥈",
        "🥉"
    ];


    let description = "";


    for(
        const [index, user] of
        leaderboard.entries()
    ){


        const place =
            medals[index] ??
            `**#${index + 1}**`;


        const level =
            Number(user.level) || 1;


        const totalXP =
            Number(user.xp) || 0;


        if(period === "all"){

            const progress =
                makeProgressBar(user);


            description +=

`${place} **${user.username}**
> ★ **Level ${level}** • ✦ **${totalXP.toLocaleString()} XP**
> ${progress.bar} **${progress.percent}%**

`;

            continue;

        }


        const periodXP =
            Number(
                user.periodXP ??
                user.periodxp
            ) || 0;


        description +=

`${place} **${user.username}**
> ✦ **${periodXP.toLocaleString()} XP earned** • ★ **Level ${level}**
> Total XP: **${totalXP.toLocaleString()}**

`;

    }


    return description;

}


async function buildInfoEmbed(message){

    const [weeklyCycle, monthlyCycle] =
        await Promise.all([
            database.getLeaderboardCycle(
                message.guild.id,
                "weekly"
            ),
            database.getLeaderboardCycle(
                message.guild.id,
                "monthly"
            )
        ]);


    return new EmbedBuilder()
        .setColor("#F1C40F")
        .setTitle(
            PERIODS.info.title
        )
        .setDescription(
            "These are the exact prizes currently available for the " +
            "**Weekly** and **Monthly** leaderboards. The top three players " +
            "receive their listed rewards when each timer ends."
        )
        .setThumbnail(
            message.guild.iconURL({
                size: 1024
            })
        )
        .addFields(
            ...buildCycleFields(
                weeklyCycle,
                {
                    cycleLabel: "Weekly"
                }
            ),
            ...buildCycleFields(
                monthlyCycle,
                {
                    cycleLabel: "Monthly"
                }
            )
        )
        .setFooter({
            text:
                "Prize pools refresh when a new leaderboard cycle begins"
        })
        .setTimestamp();

}


async function buildEmbed(
    message,
    period
){


    if(period === "info"){
        return buildInfoEmbed(
            message
        );
    }


    const [leaderboard, cycle] =
        await Promise.all([
            getLeaderboard(
                message.guild.id,
                period
            ),
            period === "all"
                ? Promise.resolve(null)
                : database.getLeaderboardCycle(
                    message.guild.id,
                    period
                )
        ]);


    const resolvedLeaderboard =
        await resolveUsernames(
            message.guild,
            leaderboard
        );


    const periodDetails =
        PERIODS[period];


    const embed =
        new EmbedBuilder()

        .setColor("#5FE1E6")

        .setTitle(
            periodDetails.title
        )

        .setDescription(
            buildDescription(
                resolvedLeaderboard,
                period
            )
        )

        .setThumbnail(
            message.guild.iconURL({
                size: 1024
            })
        )

        .setFooter({
            text:
                `Top ${resolvedLeaderboard.length} Players • ` +
                periodDetails.footer
        })

        .setTimestamp();


    const cycleFields =
        buildCycleFields(
            cycle,
            {
                includeRewards: false
            }
        );


    if(cycleFields.length > 0){

        embed.addFields(
            cycleFields
        );

    }
    else{

        embed.addFields(
            {
                name: "🎁 Weekly & Monthly Prizes",
                value:
                    "Use the **Info** button below to view both exact prize " +
                    "pools and their live reset timers.",
                inline: false
            }
        );

    }


    return embed;

}


async function execute(message){


    let selectedPeriod = "all";


    const initialEmbed =
        await buildEmbed(
            message,
            selectedPeriod
        );


    const leaderboardMessage =
        await message.reply({

            embeds: [initialEmbed],

            components: [
                buildButtons(selectedPeriod)
            ]

        });


    const collector =
        leaderboardMessage
            .createMessageComponentCollector({

                componentType:
                    ComponentType.Button,

                time:
                    BUTTON_LIFETIME

            });


    collector.on(
        "collect",
        async interaction => {


            if(
                interaction.user.id !==
                    message.author.id
            ){

                return interaction.reply({

                    content:
                        "Run `!rank` or `!leaderboard` " +
                        "to open your own leaderboard buttons.",

                    ephemeral: true

                });

            }


            const period =
                interaction.customId
                    .split(":")[1];


            if(!PERIODS[period]){
                return;
            }


            await interaction.deferUpdate();


            try {

                const embed =
                    await buildEmbed(
                        message,
                        period
                    );


                selectedPeriod = period;


                await leaderboardMessage.edit({

                    embeds: [embed],

                    components: [
                        buildButtons(
                            selectedPeriod
                        )
                    ]

                });

            }
            catch(error){

                console.error(
                    "Failed to switch leaderboard:",
                    error
                );


                await interaction.followUp({

                    content:
                        "I couldn't load that leaderboard. " +
                        "Please try again.",

                    ephemeral: true

                }).catch(() => null);

            }

        }
    );


    collector.on(
        "end",
        async () => {


            await leaderboardMessage.edit({

                components: [
                    buildButtons(
                        selectedPeriod,
                        true
                    )
                ]

            }).catch(() => null);

        }
    );

}


function buildResetAnnouncementEmbed(event){

    const isWeekly =
        event.period === "weekly";


    const embed =
        new EmbedBuilder()
            .setColor(
                isWeekly
                    ? "#57F287"
                    : "#F1C40F"
            )
            .setTitle(
                isWeekly
                    ? "📅 Weekly Leaderboard Results"
                    : "🗓️ Monthly Leaderboard Results"
            )
            .setDescription(
                `The **${event.period} leaderboard** reset automatically. ` +
                "The winners and their rolled rewards are shown below." +
                (
                    event.rewardMode === "money"
                        ? "\n\n💵 Any XP reward was applied automatically. Cash prizes were recorded as **pending owner payouts**."
                        : "\n\n✅ All in-bot rewards were applied automatically."
                )
            )
            .setTimestamp(
                Number(event.cycleEnd)
            );


    if(!Array.isArray(event.winners) || event.winners.length === 0){

        embed.addFields({
            name: "No eligible winners",
            value:
                "Nobody earned XP during this cycle, so no rewards were awarded."
        });


        return embed;

    }


    const medals = ["🥇", "🥈", "🥉"];


    for(const winner of event.winners){

        const place =
            Math.max(
                1,
                Number(winner.place) || 1
            );


        embed.addFields({
            name:
                `${medals[place - 1] || `#${place}`} ` +
                `<@${winner.userID}>`,
            value:
                `Earned **${Number(winner.periodXP || 0).toLocaleString()} XP** this cycle\n` +
                formatRewardList(
                    winner.rewards
                ),
            inline: false
        });

    }


    return embed;

}


function buildCycleAnnouncementEmbed(cycle){

    const isWeekly =
        cycle.period === "weekly";


    const isMoney =
        !isWeekly &&
        cycle.rewardMode === "money";


    const resetTimestamp =
        Math.floor(
            Number(cycle.cycleEnd) /
            1000
        );


    const periodLabel =
        isWeekly
            ? "weekly"
            : "monthly";


    const embed =
        new EmbedBuilder()
            .setColor(
                isMoney
                    ? "#F1C40F"
                    : isWeekly
                        ? "#57F287"
                        : "#5865F2"
            )
            .setTitle(
                isMoney
                    ? "💵 Monthly Rank Giveaway Is Live!"
                    : isWeekly
                        ? "🎁 Weekly Rank Giveaway Is Live!"
                        : "🏆 Monthly Rank Giveaway Is Live!"
            )
            .setDescription(
                `A fresh **${periodLabel} leaderboard** has started. ` +
                "Earn XP and finish in the top three to win the prizes below.\n\n" +
                `**Ends:** <t:${resetTimestamp}:F>\n` +
                `**Time remaining:** <t:${resetTimestamp}:R>` +
                (
                    isWeekly
                        ? ""
                        : `\n**Prize type:** ${isMoney ? "Money" : "Normal"}`
                ) +
                (
                    isMoney
                        ? "\n\n*Cash prizes are paid by the bot owner after the results are recorded.*"
                        : ""
                )
            )
            .setFooter({
                text:
                    "Use !rank or !leaderboard to view the live standings"
            })
            .setTimestamp(
                Number(cycle.cycleStart)
            );


    const medals = ["🥇", "🥈", "🥉"];


    for(let index = 0; index < medals.length; index++){

        embed.addFields({
            name:
                `${medals[index]} ${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : "rd"} Place`,
            value: formatRewardList(
                cycle.rewards?.[
                    String(index + 1)
                ]
            ),
            inline: false
        });

    }


    return embed;

}


async function getAnnouncementChannel(client){

    const channel =
        await client.channels.fetch(
            RESET_ANNOUNCEMENT_CHANNEL_ID
        ).catch(() => null);


    if(!channel?.isTextBased()){

        throw new Error(
            `Leaderboard announcement channel ${RESET_ANNOUNCEMENT_CHANNEL_ID} is unavailable.`
        );

    }


    return channel;

}


async function sendCycleAnnouncement(
    client,
    cycle
){

    const channel =
        await getAnnouncementChannel(
            client
        );


    return channel.send({
        embeds: [
            buildCycleAnnouncementEmbed(
                cycle
            )
        ],
        allowedMentions: {
            parse: []
        }
    });

}


let resetCheckRunning = false;


async function processScheduledResets(
    client,
    guildID
){

    if(resetCheckRunning || !guildID){
        return;
    }


    resetCheckRunning = true;


    try{

        const completed =
            await database.processDueLeaderboardResets(
                guildID
            );


        const affectedUsers =
            new Set();


        for(const result of completed){

            for(const winner of result.event.winners || []){

                affectedUsers.add(
                    String(winner.userID)
                );

            }

        }


        for(const userID of affectedUsers){

            await leveling.syncLevelAndAnnounce(
                client,
                guildID,
                userID
            ).catch(error => {

                console.error(
                    `Leaderboard reward level sync failed for ${userID}:`,
                    error
                );

            });

        }


        const pendingEvents =
            await database.getUnannouncedLeaderboardResetEvents(
                guildID
            );


        if(pendingEvents.length === 0){
            return;
        }


        const channel =
            await getAnnouncementChannel(
                client
            );


        const finalEventIndexByPeriod =
            new Map();


        pendingEvents.forEach((event, index) => {

            finalEventIndexByPeriod.set(
                event.period,
                index
            );

        });


        const currentCycles =
            new Map();


        for(const period of finalEventIndexByPeriod.keys()){

            currentCycles.set(
                period,
                await database.getLeaderboardCycle(
                    guildID,
                    period
                )
            );

        }


        for(
            const [index, event] of
            pendingEvents.entries()
        ){

            const embeds = [
                buildResetAnnouncementEmbed(
                    event
                )
            ];


            const currentCycle =
                currentCycles.get(
                    event.period
                );


            if(
                finalEventIndexByPeriod.get(
                    event.period
                ) === index
                &&
                Number(currentCycle?.cycleEnd) >
                    Date.now()
            ){

                embeds.push(
                    buildCycleAnnouncementEmbed(
                        currentCycle
                    )
                );

            }

            await channel.send({
                embeds,
                allowedMentions: {
                    parse: []
                }
            });


            await database.markLeaderboardResetEventAnnounced(
                event.id
            );

        }

    }
    finally{

        resetCheckRunning = false;

    }

}


async function runManualReset(
    message,
    period,
    rewardMode = "normal"
){

    if(message.author.id !== OWNER_ID){

        return message.reply(
            "🚫 Only the bot owner can reset ranked leaderboards."
        );

    }


    const cycle =
        await database.resetLeaderboardCycleWithoutRewards(
            message.guild.id,
            period,
            rewardMode
        );


    let announcementSent = false;


    try{

        await sendCycleAnnouncement(
            message.client,
            cycle
        );


        announcementSent = true;

    }
    catch(error){

        console.error(
            `Failed to announce the manually reset ${period} leaderboard:`,
            error
        );

    }


    const embed =
        new EmbedBuilder()
            .setColor("#ED4245")
            .setTitle(
                period === "weekly"
                    ? "📅 Weekly Leaderboard Reset"
                    : "🗓️ Monthly Leaderboard Reset"
            )
            .setDescription(
                "The rankings and previous prize pool were discarded. " +
                "**No users received rewards.** A fresh prize pool is now active.\n\n" +
                (
                    announcementSent
                        ? `✅ The new giveaway was posted in <#${RESET_ANNOUNCEMENT_CHANNEL_ID}>.`
                        : `⚠️ The reset succeeded, but I could not post the giveaway in <#${RESET_ANNOUNCEMENT_CHANNEL_ID}>.`
                )
            )
            .addFields(
                buildCycleFields(cycle)
            )
            .setTimestamp();


    return message.reply({
        embeds: [embed]
    });

}


async function resetWeeklyRank(message){

    return runManualReset(
        message,
        "weekly",
        "normal"
    );

}


async function resetMonthlyRank(message){

    const parts =
        message.content
            .trim()
            .toLowerCase()
            .split(/\s+/);


    const rewardMode =
        parts[1];


    if(
        parts.length !== 2
        ||
        !["normal", "money"].includes(
            rewardMode
        )
    ){

        return message.reply(
            "Use `!resetmonthlyrank normal` or `!resetmonthlyrank money`."
        );

    }


    return runManualReset(
        message,
        "monthly",
        rewardMode
    );

}


module.exports = {
    execute,
    processScheduledResets,
    resetWeeklyRank,
    resetMonthlyRank
};
