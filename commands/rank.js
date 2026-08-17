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


const LEADERBOARD_LIMIT = 10;

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
        footer: "XP earned in the last 30 days"
    },

    weekly: {
        title: "📅 Weekly Leaderboard",
        buttonLabel: "Weekly",
        buttonEmoji: "📅",
        footer: "XP earned in the last 7 days"
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
                "last 7 days yet!*"
            );

        }


        if(period === "monthly"){

            return (
                "*Nobody has earned XP in the " +
                "last 30 days yet!*"
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


async function buildEmbed(
    message,
    period
){


    const leaderboard =
        await getLeaderboard(
            message.guild.id,
            period
        );


    const resolvedLeaderboard =
        await resolveUsernames(
            message.guild,
            leaderboard
        );


    const periodDetails =
        PERIODS[period];


    return new EmbedBuilder()

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


module.exports = {
    execute
};
