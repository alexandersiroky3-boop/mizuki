const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
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



function formatInventoryLine(
    type,
    inventory
){

    const emoji =
        type === "xp"
            ? "⚡"
            : "🍀";


    return TIERS.map(

        tier =>
            `${emoji} **${TIER_LABELS[tier]}:** x${inventory[type][tier]}`

    ).join("  |  ");

}



function getNextTierData(hourlyXP){

    let tier =
        null;

    let previousRequirement =
        0;

    let nextRequirement =
        1250;


    if(hourlyXP < 1250){

        tier =
            "tier1";

    }
    else if(hourlyXP < 5000){

        tier =
            "tier2";

        previousRequirement =
            1250;

        nextRequirement =
            5000;

    }
    else if(hourlyXP < 12500){

        tier =
            "tier3";

        previousRequirement =
            5000;

        nextRequirement =
            12500;

    }
    else if(hourlyXP < 25000){

        tier =
            "max";

        previousRequirement =
            12500;

        nextRequirement =
            25000;

    }
    else{

        return {

            tier:
                null,

            xpTier:
                "✅ MAX Reached",

            luckTier:
                "✅ MAX Reached",

            needed:
                0,

            percentage:
                100,

            progressBar:
                "█".repeat(20)

        };

    }


    const needed =
        Math.max(
            0,
            nextRequirement -
            hourlyXP
        );


    let percentage =
        Math.floor(

            (
                (
                    hourlyXP -
                    previousRequirement
                )

                /

                (
                    nextRequirement -
                    previousRequirement
                )
            ) * 100

        );


    percentage =
        Math.max(
            0,
            Math.min(
                percentage,
                100
            )
        );


    const filled =
        Math.floor(
            percentage / 5
        );


    return {

        tier,

        xpTier:
            `<@&${boosts.BOOST_PROFILES[tier].roleID}>`,

        luckTier:
            `<@&${luck.LUCK_ROLES[tier].roleID}>`,

        needed,

        percentage,

        progressBar:
            "█".repeat(filled) +
            "░".repeat(
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
                    `XP ${TIER_LABELS[tier]} • x${xpAmount}`
                )

                .setEmoji(
                    "⚡"
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
                    `Luck ${TIER_LABELS[tier]} • x${luckAmount}`
                )

                .setEmoji(
                    "🍀"
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
            `❌ You do not have that ${boostTypeName} in your inventory.`
        );

    }


    if(
        result.status ===
        "stronger-active"
    ){

        return (
            `❌ You already have a stronger ${boostTypeName} active. The weaker item was not consumed.`
        );

    }


    if(!result.success){

        return (
            `❌ That ${boostTypeName} could not be activated.`
        );

    }


    const unixExpiry =
        Math.floor(
            result.boost.expiresAt /
            1000
        );


    let action =
        "activated";


    if(
        result.status ===
        "refreshed"
    ){

        action =
            "refreshed";

    }
    else if(
        result.status ===
        "upgraded"
    ){

        action =
            "upgraded to";

    }


    return (

        `✅ You ${action} <@&${result.boost.roleID}>. Remaining copies: **x${result.remaining}**. Expires <t:${unixExpiry}:R>.`

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
        streakData
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
        )

    ]);


    const inventory =
        mapInventory(
            inventoryRows
        );


    const nextTier =
        getNextTierData(
            Number(hourlyXP) || 0
        );


    const xpBoostName =

        activeXPBoost.roleID

            ? `<@&${activeXPBoost.roleID}>`

            : "❌ None";


    const luckBoostName =

        activeLuckBoost.roleID

            ? `<@&${activeLuckBoost.roleID}>`

            : "❌ None";


    const xpTimeLeft =

        activeXPBoost.expiresAt

            ? formatTime(
                activeXPBoost.expiresAt -
                Date.now()
            )

            : "No active XP Boost";


    const luckTimeLeft =

        activeLuckBoost.expiresAt

            ? formatTime(
                activeLuckBoost.expiresAt -
                Date.now()
            )

            : "No active Luck Boost";


    const embed =
        new EmbedBuilder()

            .setColor(
                "#8A2BE2"
            )

            .setAuthor({

                name:
                    `${message.author.username}'s Boost Inventory`,

                iconURL:
                    message.author.displayAvatarURL()

            })

            .setThumbnail(
                message.author.displayAvatarURL()
            )

            .setDescription(

`## 🗲 Active Boosts

**Current XP Boost**
${xpBoostName}
⏳ ${xpTimeLeft}

**Current Luck Boost**
${luckBoostName}
⏳ ${luckTimeLeft}

## 📦 Boost Inventory

${formatInventoryLine("xp", inventory)}

${formatInventoryLine("luck", inventory)}

*Press a button below to consume one copy and activate it.*

## 📈 Hourly Progress

**Hourly XP**
${Number(hourlyXP).toLocaleString()} XP

**Current Critical Streak**
💥 ${streakData.current}

**Highest Critical Streak**
🐦‍🔥 ${streakData.best}

**Next Tier**
**XP Boost:** ${nextTier.xpTier}
**Luck Boost:** ${nextTier.luckTier}

**XP Needed**
${nextTier.needed.toLocaleString()} XP

${nextTier.progressBar}

**${nextTier.percentage}%**`

            )

            .setFooter({

                text:
                    disableAll
                        ? "Buttons expired. Run !boost again."
                        : "Boosts stay stored until you choose to use them."

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


    const collector =
        reply.createMessageComponentCollector({

            componentType:
                ComponentType.Button,

            time:
                2 * 60 * 1000

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
                        "❌ This boost inventory belongs to someone else.",

                    ephemeral:
                        true

                });

            }


            const [
                action,
                type,
                tier
            ] = interaction.customId.split(
                ":"
            );


            if(action !== "use_boost"){

                return;

            }


            await interaction.deferUpdate();


            try{

                let result;


                if(type === "xp"){

                    result =
                        await boosts.activateXPBoostFromInventory(
                            interaction.member,
                            tier
                        );

                }
                else{

                    result =
                        await luck.activateLuckBoostFromInventory(
                            interaction.member,
                            tier
                        );

                }


                await reply.edit(
                    await buildDashboard(
                        message
                    )
                );


                await interaction.followUp({

                    content:
                        getActivationMessage(
                            type,
                            result
                        ),

                    ephemeral:
                        true

                });

            }
            catch(error){

                console.error(
                    "Failed to activate boost:",
                    error
                );


                await interaction.followUp({

                    content:
                        "❌ Something went wrong while activating that boost. The item was returned to your inventory.",

                    ephemeral:
                        true

                });

            }

        }

    );


    collector.on(
        "end",
        async () => {

            await reply.edit(
                await buildDashboard(
                    message,
                    true
                )
            ).catch(() => {});

        }

    );

}



module.exports = {

    execute

};
