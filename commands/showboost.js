const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

const database = require("../database");
const boosts = require("../systems/boosts");
const leveling = require("../systems/leveling");
const powerRunes = require("../systems/powerRunes");
const luck = require("../utils/luck");


const PANEL_DURATION_MS =
    200 * 60 * 1000;


const PANEL_COLORS = {
    active:
        0x7C5CFC,
    updated:
        0x57F287,
    expired:
        0x747F8D
};


const XP_TIERS =
    [
        "tier1",
        "tier2",
        "max",
        "infinity"
    ];


const LUCK_TIERS =
    [
        "tier1",
        "tier2",
        "tier3",
        "max",
        "omega"
    ];


const POWER_RUNE_TIERS =
    powerRunes.POWER_RUNE_TIERS;


function inventoryMap(rows){

    return new Map(
        rows.map(row => [
            `${String(row.boosttype).toLowerCase()}:${String(row.tier).toLowerCase()}`,
            Number(row.amount) || 0
        ])
    );

}


function getInventoryAmount(
    inventory,
    type,
    tier
){

    return Number(
        inventory.get(
            `${type}:${tier}`
        ) || 0
    );

}


function formatActiveBoost(profile){

    if(!profile?.roleID){
        return "None";
    }


    const expiresAt =
        Number(profile.expiresAt) || 0;


    const expiry =
        expiresAt > Date.now()
            ? ` • ends <t:${Math.floor(expiresAt / 1000)}:R>`
            : "";


    return `<@&${profile.roleID}>${expiry}`;

}


function buildXPInventoryLines(inventory){

    return XP_TIERS.map(tier => {

        const profile =
            boosts.BOOST_PROFILES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "xp",
                tier
            );


        return (
            `• <@&${profile.roleID}> — **x${amount.toLocaleString()}**`
        );

    });

}


function buildLuckInventoryLines(inventory){

    return LUCK_TIERS.map(tier => {

        const profile =
            luck.LUCK_ROLES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "luck",
                tier
            );


        return (
            `• <@&${profile.roleID}> — **x${amount.toLocaleString()}**`
        );

    });

}


function buildPowerRuneInventoryLines(inventory){

    return POWER_RUNE_TIERS.map(tier => {

        const profile =
            powerRunes
                .POWER_RUNE_PROFILES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "rune",
                tier
            );


        return (
            `• <@&${profile.roleID}> — **x${amount.toLocaleString()}** — ` +
            `**${profile.xp.toLocaleString()} XP each** — ` +
            `**${profile.chance}%** per XP-earning chat message`
        );

    });

}


function buildButtons(
    inventory,
    disabled = false
){

    const xpRow =
        new ActionRowBuilder();


    for(const tier of XP_TIERS){

        const profile =
            boosts.BOOST_PROFILES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "xp",
                tier
            );


        xpRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`activate_xp_${tier}`)
                .setLabel(
                    `${profile.name} (x${amount.toLocaleString()})`
                )
                .setStyle(
                    tier === "infinity"
                        ? ButtonStyle.Danger
                        : tier === "max"
                            ? ButtonStyle.Success
                            : ButtonStyle.Primary
                )
                .setDisabled(
                    disabled || amount <= 0
                )
        );

    }


    const luckRow =
        new ActionRowBuilder();


    for(const tier of LUCK_TIERS){

        const profile =
            luck.LUCK_ROLES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "luck",
                tier
            );


        luckRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`activate_luck_${tier}`)
                .setLabel(
                    `${profile.name} (x${amount.toLocaleString()})`
                )
                .setStyle(
                    tier === "omega"
                        ? ButtonStyle.Danger
                        : tier === "max"
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                )
                .setDisabled(
                    disabled || amount <= 0
                )
        );

    }


    const powerRuneRow =
        new ActionRowBuilder();


    for(const tier of POWER_RUNE_TIERS){

        const profile =
            powerRunes
                .POWER_RUNE_PROFILES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "rune",
                tier
            );


        powerRuneRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`activate_rune_${tier}`)
                .setLabel(
                    `${profile.name} (x${amount.toLocaleString()})`
                )
                .setStyle(
                    tier === "tier3"
                        ? ButtonStyle.Danger
                        : tier === "tier2"
                            ? ButtonStyle.Success
                            : ButtonStyle.Primary
                )
                .setDisabled(
                    disabled || amount <= 0
                )
        );

    }


    return [
        xpRow,
        luckRow,
        powerRuneRow
    ];

}


async function buildBoostPanel(
    member,
    disabled = false,
    notice = ""
){

    const [
        rows,
        hourlyXP,
        activeXP,
        activeLuck,
        criticalStreak
    ] = await Promise.all([
        database.getBoostInventory(
            member.guild.id,
            member.id
        ),
        database.getHourlyBoostXP(
            member.guild.id,
            member.id
        ),
        boosts.getActiveBoost(
            member
        ),
        luck.getActiveLuckBoost(
            member
        ),
        database.getCriticalStreak(
            member.guild.id,
            member.id
        )
    ]);


    const inventory =
        inventoryMap(rows);


    const description =
        `**Hourly chat XP:** ${Number(hourlyXP).toLocaleString()} *(tracking only)*\n` +
        `**Active XP Boost:** ${formatActiveBoost(activeXP)}\n` +
        `**Active Luck Boost:** ${formatActiveBoost(activeLuck)}\n` +
        `💥 **Critical Streak:** ${Number(criticalStreak?.current || 0).toLocaleString()}　` +
        `❤️‍🔥 **Best Streak:** ${Number(criticalStreak?.best || 0).toLocaleString()}\n\n` +
        "**⚔️ XP Boosts**\n" +
        `${buildXPInventoryLines(inventory).join("\n")}\n\n` +
        "**🌿 Luck Boosts**\n" +
        `${buildLuckInventoryLines(inventory).join("\n")}\n\n` +
        "**🔷 Power Runes**\n" +
        "*Chat-only drops • Click a Rune below and enter how many to use*\n" +
        `${buildPowerRuneInventoryLines(inventory).join("\n")}` +
        (notice ? `\n\n${notice}` : "");


    const embed =
        new EmbedBuilder()
            .setColor(
                disabled
                    ? PANEL_COLORS.expired
                    : notice
                        ? PANEL_COLORS.updated
                        : PANEL_COLORS.active
            )
            .setTitle(
                "⚡ Boost & Power Rune Inventory"
            )
            .setDescription(
                description
            )
            .setFooter({
                text:
                    disabled
                        ? "Panel expired • Run !boost to open it again"
                        : "Choose a boost or Power Rune below • Only you can use these buttons"
            });


    return {
        embeds: [
            embed
        ],
        components:
            buildButtons(
                inventory,
                disabled
            ),
        allowedMentions: {
            parse: []
        }
    };

}


function activationFailureMessage(result){

    if(result?.status === "no-stock"){
        return "That boost is no longer in your inventory.";
    }


    if(result?.status === "stronger-active"){
        return (
            `You already have the stronger <@&${result.currentBoost.roleID}> active. ` +
            "The weaker item was not consumed."
        );
    }


    return "That boost could not be activated.";

}


function powerRuneFailureMessage(result){

    if(
        result?.status ===
            "insufficient-inventory"
    ){

        return (
            `You only have **${Number(result.available || 0).toLocaleString()}** ` +
            `${result.rune?.name || "Power Runes"} available.`
        );

    }


    if(
        result?.status ===
            "invalid-quantity"
        ||
        result?.status ===
            "invalid-redemption"
    ){

        return (
            "Enter a positive whole number no larger than " +
            `**${powerRunes.MAX_POWER_RUNE_REDEEM_QUANTITY.toLocaleString()}**.`
        );

    }


    return "That Power Rune could not be activated.";

}


function buildPowerRuneModal(
    profile,
    available,
    customID
){

    const modal =
        new ModalBuilder()
            .setCustomId(customID)
            .setTitle(
                `Use ${profile.name}`
            );


    const amountInput =
        new TextInputBuilder()
            .setCustomId(
                "power_rune_amount"
            )
            .setLabel(
                "How much do you want to use?"
            )
            .setPlaceholder(
                `You own ${Number(available).toLocaleString()}`
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(7);


    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                amountInput
            )
    );


    return modal;

}


async function execute(message){

    if(!message.guild || !message.member){
        return null;
    }


    let lastNotice = "";


    const panel =
        await message.reply(
            await buildBoostPanel(
                message.member
            )
        );


    const collector =
        panel.createMessageComponentCollector({
            componentType:
                ComponentType.Button,
            time:
                PANEL_DURATION_MS
        });


    collector.on("collect", async interaction => {

        try{

        if(interaction.user.id !== message.author.id){

            await interaction.reply({
                content:
                    "This is someone else's boost inventory. Run `!boost` to open yours.",
                flags:
                    MessageFlags.Ephemeral
            }).catch(() => {});


            return;

        }


        const powerRuneMatch =
            /^activate_rune_(tier1|tier2|tier3)$/
                .exec(
                    interaction.customId
                );


        if(powerRuneMatch){

            const tier =
                powerRuneMatch[1];


            const profile =
                powerRunes
                    .getPowerRuneProfile(
                        tier
                    );


            const available =
                await database
                    .getBoostInventoryAmount(
                        message.guild.id,
                        message.author.id,
                        "rune",
                        tier
                    );


            if(!profile || available <= 0){

                await interaction.reply({
                    content:
                        "That Power Rune is no longer in your inventory.",
                    flags:
                        MessageFlags.Ephemeral
                });


                await panel.edit(
                    await buildBoostPanel(
                        message.member,
                        false,
                        lastNotice
                    )
                ).catch(() => {});


                return;

            }


            const modalCustomID =
                `power_rune_redeem:${tier}:${interaction.id}`;


            await interaction.showModal(
                buildPowerRuneModal(
                    profile,
                    available,
                    modalCustomID
                )
            );


            const submission =
                await interaction.awaitModalSubmit({
                    time:
                        2 * 60 * 1000,
                    filter:
                        modalInteraction =>
                            modalInteraction.user.id ===
                                message.author.id
                            &&
                            modalInteraction.customId ===
                                modalCustomID
                }).catch(() => null);


            if(!submission){
                return;
            }


            const quantityText =
                submission.fields
                    .getTextInputValue(
                        "power_rune_amount"
                    );


            const quantity =
                powerRunes
                    .parsePowerRuneQuantity(
                        quantityText
                    );


            if(!quantity){

                await submission.reply({
                    content:
                        powerRuneFailureMessage({
                            status:
                                "invalid-quantity"
                        }),
                    flags:
                        MessageFlags.Ephemeral
                });


                return;

            }


            await submission.deferUpdate();


            const result =
                await powerRunes.redeemPowerRunes(
                    message.member,
                    tier,
                    quantity
                );


            if(!result.success){

                await submission.followUp({
                    content:
                        powerRuneFailureMessage(
                            result
                        ),
                    flags:
                        MessageFlags.Ephemeral
                }).catch(() => {});


                await panel.edit(
                    await buildBoostPanel(
                        message.member,
                        false,
                        lastNotice
                    )
                ).catch(() => {});


                return;

            }


            await leveling.syncLevelAndAnnounce(
                message.client,
                message.guild.id,
                message.author.id
            ).catch(error => {

                console.error(
                    "Could not synchronize level after Power Rune redemption:",
                    error
                );

            });


            lastNotice =
                `✅ Used **${quantity.toLocaleString()}x** <@&${profile.roleID}> ` +
                `and received **${Number(result.totalXP).toLocaleString()} XP**. ` +
                `Inventory remaining: **x${Number(result.remaining).toLocaleString()}**. ` +
                `The Rune role lasts **20 seconds**.`;


            await panel.edit(
                await buildBoostPanel(
                    message.member,
                    false,
                    lastNotice
                )
            );


            return;

        }


        const match =
            /^activate_(xp|luck)_(tier1|tier2|tier3|max|infinity|omega)$/
                .exec(
                    interaction.customId
                );


        if(!match){
            return;
        }


        const [, type, tier] =
            match;


        const result =
            type === "xp"
                ? await boosts.activateXPBoostFromInventory(
                    message.member,
                    tier
                )
                : await luck.activateLuckBoostFromInventory(
                    message.member,
                    tier
                );


        if(!result.success){

            await interaction.reply({
                content:
                    activationFailureMessage(result),
                flags:
                    MessageFlags.Ephemeral,
                allowedMentions: {
                    parse: []
                }
            }).catch(() => {});


            await panel.edit(
                await buildBoostPanel(
                    message.member,
                    false,
                    lastNotice
                )
            ).catch(() => {});


            return;

        }


        const statusText = {
            activated: "activated",
            refreshed: "refreshed for a fresh duration",
            upgraded: "upgraded"
        }[result.status] || "activated";


        lastNotice =
            `✅ <@&${result.boost.roleID}> ${statusText}. ` +
            `Inventory remaining: **x${Number(result.remaining).toLocaleString()}**.`;


        await interaction.update(
            await buildBoostPanel(
                message.member,
                false,
                lastNotice
            )
        );

        }
        catch(error){

            console.error(
                "Boost panel interaction failed:",
                error
            );


            const errorReply = {
                content:
                    "The boost panel hit a temporary error. Your inventory was protected; run `!boost` again to refresh it.",
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

        try{

            await panel.edit(
                await buildBoostPanel(
                    message.member,
                    true,
                    lastNotice
                )
            ).catch(() => {});

        }
        catch(error){

            console.error(
                "Could not close expired boost panel:",
                error
            );

        }

    });


    return panel;

}


module.exports = {
    execute,
    buildBoostPanel
};
