const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");


const database =
    require("../database");


const boosts =
    require("../systems/boosts");


const luck =
    require("../utils/luck");


const TIERS = [
    "tier1",
    "tier2",
    "tier3",
    "max"
];


const TIER_LABELS = {

    tier1:
        "I",

    tier2:
        "II",

    tier3:
        "III",

    max:
        "MAX"

};



// ==========================
// HELPERS
// ==========================

function formatTime(milliseconds){

    if(
        !milliseconds
        ||
        milliseconds <= 0
    ){

        return "Expired";

    }


    const totalSeconds =
        Math.ceil(
            milliseconds / 1000
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) / 60
        );


    const seconds =
        totalSeconds %
        60;


    return (
        `${hours}h ${minutes}m ${seconds}s`
    );

}



function createEmptyInventory(){

    return {

        xp: {

            tier1: 0,
            tier2: 0,
            tier3: 0,
            max: 0

        },

        luck: {

            tier1: 0,
            tier2: 0,
            tier3: 0,
            max: 0

        }

    };

}



function mapInventory(rows){

    const inventory =
        createEmptyInventory();


    for(const row of rows){

        const type =
            String(
                row.boosttype
            ).toLowerCase();


        const tier =
            String(
                row.tier
            ).toLowerCase();


        if(
            inventory[type]
            &&
            Object.prototype.hasOwnProperty.call(
                inventory[type],
                tier
            )
        ){

            inventory[type][tier] =
                Number(
                    row.amount
                ) || 0;

        }

    }


    return inventory;

}



function formatInventoryTable(
    inventory
){

    const formatTier = (label, amount) =>
        `\`${label} x${amount}\``;


    const xpInventory = [
        formatTier("I", inventory.xp.tier1),
        formatTier("II", inventory.xp.tier2),
        formatTier("III", inventory.xp.tier3),
        formatTier("MAX", inventory.xp.max)
    ].join("  ");


    const luckInventory = [
        formatTier("I", inventory.luck.tier1),
        formatTier("II", inventory.luck.tier2),
        formatTier("III", inventory.luck.tier3),
        formatTier("MAX", inventory.luck.max)
    ].join("  ");


    return (
        `**XP Boosts**
${xpInventory}

` +
        `**Luck Boosts**
${luckInventory}`
    );

}


function getNextTierData(
    hourlyXP,
    progressData = null
){

    const safeXP =
        Math.max(
            0,
            Number(hourlyXP) || 0
        );


    const maxRoleID =
        boosts.BOOST_PROFILES.max.roleID;


    const savedRole =
        progressData?.role || null;


    const savedLastAwardXP =
        Number(
            progressData?.lastawardxp ??
            progressData?.lastAwardXP ??
            0
        ) || 0;


    // After MAX is earned, start a new MAX progress cycle.
    // Repeated MAX rewards require another 1,000,000 hourly XP.
    if(safeXP >= 25000){

        const cycleStartXP =
            savedRole === maxRoleID
            &&
            savedLastAwardXP > 0

                ? savedLastAwardXP
                : 25000;


        const requiredXP =
            1000000;


        const currentXP =
            Math.max(
                0,
                Math.min(
                    requiredXP,
                    safeXP - cycleStartXP
                )
            );


        const percentage =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.floor(
                        (
                            currentXP /
                            requiredXP
                        ) * 100
                    )
                )
            );


        const filled =
            Math.round(
                percentage / 5
            );


        return {

            tier:
                "max",

            xpTier:
                `<@&${boosts.BOOST_PROFILES.max.roleID}>`,

            luckTier:
                `<@&${luck.LUCK_ROLES.max.roleID}>`,

            currentXP,

            requiredXP,

            needed:
                Math.max(
                    0,
                    requiredXP -
                    currentXP
                ),

            percentage,

            progressBar:
                "■".repeat(filled) +
                "□".repeat(
                    20 - filled
                )

        };

    }


    const tiers = [

        {
            tier: "tier1",
            startXP: 0,
            requiredXP: 1250
        },

        {
            tier: "tier2",
            startXP: 1250,
            requiredXP: 5000
        },

        {
            tier: "tier3",
            startXP: 5000,
            requiredXP: 12500
        },

        {
            tier: "max",
            startXP: 12500,
            requiredXP: 25000
        }

    ];


    const next =
        tiers.find(
            entry =>
                safeXP <
                entry.requiredXP
        );


    const tierProgress =
        safeXP -
        next.startXP;


    const tierRequirement =
        next.requiredXP -
        next.startXP;


    const percentage =
        Math.max(
            0,
            Math.min(
                100,
                Math.floor(
                    (
                        tierProgress /
                        tierRequirement
                    ) * 100
                )
            )
        );


    const filled =
        Math.round(
            percentage / 5
        );


    return {

        tier:
            next.tier,

        xpTier:
            `<@&${boosts.BOOST_PROFILES[next.tier].roleID}>`,

        luckTier:
            `<@&${luck.LUCK_ROLES[next.tier].roleID}>`,

        currentXP:
            Math.max(
                0,
                tierProgress
            ),

        requiredXP:
            tierRequirement,

        needed:
            Math.max(
                0,
                next.requiredXP -
                safeXP
            ),

        percentage,

        progressBar:
            "■".repeat(filled) +
            "□".repeat(
                20 - filled
            )

    };

}


function createBoostButtons(
    userID,
    inventory,
    disableAll = false
){

    const xpRow =
        new ActionRowBuilder();


    const luckRow =
        new ActionRowBuilder();


    for(const tier of TIERS){

        const xpAmount =
            inventory.xp[tier];


        const luckAmount =
            inventory.luck[tier];


        xpRow.addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `use_boost:xp:${tier}:${userID}`
                )

                .setLabel(
                    `XP ${TIER_LABELS[tier]}  |  ${xpAmount}`
                )

                .setStyle(
                    tier === "max"
                        ? ButtonStyle.Danger
                        : ButtonStyle.Primary
                )

                .setDisabled(
                    disableAll
                    ||
                    xpAmount <= 0
                )

        );


        luckRow.addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `use_boost:luck:${tier}:${userID}`
                )

                .setLabel(
                    `Luck ${TIER_LABELS[tier]}  |  ${luckAmount}`
                )

                .setStyle(
                    tier === "max"
                        ? ButtonStyle.Danger
                        : ButtonStyle.Success
                )

                .setDisabled(
                    disableAll
                    ||
                    luckAmount <= 0
                )

        );

    }


    return [
        xpRow,
        luckRow
    ];

}


function getActivationMessage(
    type,
    result
){

    const boostTypeName =
        type === "xp"
            ? "XP Boost"
            : "Luck Boost";


    if(
        result.status ===
        "no-stock"
    ){

        return (
            `You do not have that ${boostTypeName} in your inventory.`
        );

    }


    if(
        result.status ===
        "stronger-active"
    ){

        return (
            `A stronger ${boostTypeName} is already active. The selected boost was not consumed.`
        );

    }


    if(!result.success){

        return (
            `The ${boostTypeName} could not be activated.`
        );

    }


    const unixExpiry =
        Math.floor(
            result.boost.expiresAt /
            1000
        );


    const actionText = {

        activated:
            "activated",

        refreshed:
            "refreshed",

        upgraded:
            "upgraded to"

    }[result.status] || "activated";


    return (
        `Successfully ${actionText} <@&${result.boost.roleID}>.\n` +
        `Inventory remaining: **${result.remaining}**\n` +
        `Expires: <t:${unixExpiry}:R>`
    );

}


async function buildDashboard(
    message,
    disableAll = false
){

    const guildID =
        message.guild.id;


    const userID =
        message.author.id;


    const [
        activeXPBoost,
        activeLuckBoost,
        inventoryRows,
        hourlyXP,
        streakData,
        progressData
    ] = await Promise.all([

        boosts.getActiveBoost(
            message.member
        ),

        luck.getActiveLuckBoost(
            message.member
        ),

        database.getBoostInventory(
            guildID,
            userID
        ),

        database.getHourlyBoostXP(
            guildID,
            userID
        ),

        database.getCriticalStreak(
            guildID,
            userID
        ),

        database.getXPBoostProgress(
            guildID,
            userID
        )

    ]);


    const inventory =
        mapInventory(
            inventoryRows
        );


    const safeHourlyXP =
        Number(hourlyXP) || 0;


    const nextTier =
        getNextTierData(
            safeHourlyXP,
            progressData
        );


    const xpBoostName =
        activeXPBoost.roleID
            ? `<@&${activeXPBoost.roleID}>`
            : "None";


    const luckBoostName =
        activeLuckBoost.roleID
            ? `<@&${activeLuckBoost.roleID}>`
            : "None";


    const xpTimeLeft =
        activeXPBoost.expiresAt
            ? formatTime(
                activeXPBoost.expiresAt -
                Date.now()
            )
            : "Not active";


    const luckTimeLeft =
        activeLuckBoost.expiresAt
            ? formatTime(
                activeLuckBoost.expiresAt -
                Date.now()
            )
            : "Not active";


    const embed =
        new EmbedBuilder()

            .setColor(
                "#7A5CFF"
            )

            .setAuthor({

                name:
                    `${message.author.username}'s Boosts`,

                iconURL:
                    message.author.displayAvatarURL()

            })

            .setThumbnail(
                message.author.displayAvatarURL({
                    size:
                        1024
                })
            )

            .setDescription(

`## Active Boosts

**XP Boost**
${xpBoostName}
\`${xpTimeLeft}\`

**Luck Boost**
${luckBoostName}
\`${luckTimeLeft}\`

## Inventory

${formatInventoryTable(inventory)}

*The number beside each tier is how many copies you own.*

## Hourly Progress

**Hourly XP:** ${safeHourlyXP.toLocaleString()} XP

\`${nextTier.progressBar}\`

**Tier Progress:** ${nextTier.currentXP.toLocaleString()} / ${nextTier.requiredXP.toLocaleString()} XP

\`${nextTier.percentage}% Complete\`

> **Next XP Boost:** ${nextTier.xpTier}
> **Next Luck Boost:** ${nextTier.luckTier}
> **✦ XP Needed:** ${nextTier.needed.toLocaleString()}
> **:boom: Critical Streak:** ${Number(streakData.current) || 0}
> **:heart_on_fire: Best Streak:** ${Number(streakData.best) || 0}`

            )

            .setFooter({

                text:
                    disableAll
                        ? "This panel is unavailable."
                        : "Choose a boost below to activate it. This panel stays active until the bot restarts."

            })

            .setTimestamp();


    return {

        embeds: [
            embed
        ],

        components:
            createBoostButtons(
                userID,
                inventory,
                disableAll
            )

    };

}


// ==========================
// COMMAND
// ==========================

async function execute(message){

    if(!message.guild)
        return;


    const dashboard =
        await buildDashboard(
            message
        );


    const reply =
        await message.reply(
            dashboard
        );


    const processingUsers =
        new Set();


    const collector =
        reply.createMessageComponentCollector({

            componentType:
                ComponentType.Button

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
                        "This boost panel belongs to someone else.",

                    flags:
                        MessageFlags.Ephemeral

                });

            }


            const [
                action,
                type,
                tier,
                ownerID
            ] = interaction.customId.split(
                ":"
            );


            if(
                action !== "use_boost"
                ||
                ownerID !==
                message.author.id
            ){

                return;

            }


            const processingKey =
                `${interaction.guild.id}:${interaction.user.id}`;


            if(
                processingUsers.has(
                    processingKey
                )
            ){

                return interaction.reply({

                    content:
                        "A boost is already being activated. Try again in a moment.",

                    flags:
                        MessageFlags.Ephemeral

                });

            }


            processingUsers.add(
                processingKey
            );


            await interaction.deferReply({

                flags:
                    MessageFlags.Ephemeral

            });


            try{

                const member =
                    await interaction.guild.members.fetch(
                        interaction.user.id
                    );


                let result;


                if(type === "xp"){

                    result =
                        await boosts.activateXPBoostFromInventory(
                            member,
                            tier
                        );

                }
                else if(type === "luck"){

                    result =
                        await luck.activateLuckBoostFromInventory(
                            member,
                            tier
                        );

                }
                else{

                    return interaction.editReply({

                        content:
                            "Unknown boost type."

                    });

                }


                await interaction.editReply({

                    content:
                        getActivationMessage(
                            type,
                            result
                        )

                });


                await reply.edit(
                    await buildDashboard(
                        message
                    )
                ).catch(error => {

                    console.error(
                        "Boost activated, but the panel could not refresh:",
                        error
                    );

                });

            }
            catch(error){

                console.error(
                    "Failed to activate boost:",
                    error
                );


                await interaction.editReply({

                    content:
                        "The boost could not be activated. Nothing should have been consumed."

                }).catch(() => {});

            }
            finally{

                processingUsers.delete(
                    processingKey
                );

            }

        }

    );


}


module.exports = {

    execute

};
