const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require("discord.js");


const database =
    require("../database");


const boosts =
    require("../systems/boosts");


const leveling =
    require("../systems/leveling");


const luck =
    require("../utils/luck");


const boostSell =
    require("../utils/boostSell");


const SELL_CUSTOM_ID_PREFIX =
    "boost-sell";


const BOOST_EMOJIS = {
    "xp:tier1": "⚡",
    "xp:tier2": "⚡",
    "xp:max": "⚡",
    "xp:infinity": "🧿",
    "luck:tier1": "🌿",
    "luck:tier2": "🍃",
    "luck:tier3": "☘️",
    "luck:max": "🍀",
    // Discord rejects the multi-codepoint 👁️‍🗨️ sequence inside select-menu
    // option emoji fields. Keep the full Omega symbol in normal message text,
    // but use its Discord-safe eye variant in the !sell dropdown.
    "luck:omega": "👁️"
};


function getRowField(
    row,
    camelName,
    lowerName
){

    if(
        Object.prototype.hasOwnProperty.call(
            row,
            camelName
        )
    ){

        return row[camelName];

    }


    return row[lowerName];

}


function normalizeInventoryRow(row){

    const boostType =
        String(
            getRowField(
                row,
                "boostType",
                "boosttype"
            ) || ""
        ).toLowerCase();


    const tier =
        String(
            row.tier || ""
        ).toLowerCase();


    return {
        key:
            `${boostType}:${tier}`,
        boostType,
        tier,
        amount:
            Math.max(
                0,
                Number(row.amount) || 0
            )
    };

}


function getBoostProfile(
    boostType,
    tier
){

    if(boostType === "xp"){
        return boosts.BOOST_PROFILES[tier];
    }


    if(boostType === "luck"){
        return luck.LUCK_ROLES[tier];
    }


    return null;

}


function getBoostPresentation(row){

    const profile =
        getBoostProfile(
            row.boostType,
            row.tier
        );


    const name =
        profile?.name ||
        `${row.boostType.toUpperCase()} ${row.tier.toUpperCase()}`;


    return {
        name,
        emoji:
            BOOST_EMOJIS[row.key] ||
            "✨",
        mention:
            profile?.roleID
                ? `<@&${profile.roleID}>`
                : `**${name}**`
    };

}


async function getSellableBoosts(
    guildID,
    userID
){

    const [
        inventory,
        marketValues
    ] = await Promise.all([

        database.getBoostInventory(
            guildID,
            userID
        ),

        database.getBoostValues(
            guildID
        )

    ]);


    const valuesByKey =
        new Map(
            marketValues.map(
                state => [
                    state.key,
                    state
                ]
            )
        );


    return inventory
        .map(
            normalizeInventoryRow
        )
        .filter(
            row =>
                row.amount > 0
                &&
                valuesByKey.has(
                    row.key
                )
        )
        .map(row => {

            const state =
                valuesByKey.get(
                    row.key
                );


            return {
                ...row,
                state,
                quote:
                    boostSell
                        .calculateBoostSellQuote(
                            state,
                            1
                        ),
                presentation:
                    getBoostPresentation(
                        row
                    )
            };

        })
        .filter(
            row => row.quote
        )
        .sort(
            (first, second) =>
                Number(first.state.order) -
                Number(second.state.order)
        );

}


function buildSellComponents(
    rows,
    userID
){

    if(rows.length === 0){
        return [];
    }


    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `${SELL_CUSTOM_ID_PREFIX}:select:${userID}`
            )
            .setPlaceholder(
                "Choose a boost to sell"
            )
            .addOptions(
                rows.map(row => ({
                    label:
                        row.presentation.name,
                    value:
                        row.key,
                    description:
                        `Own x${row.amount.toLocaleString()} • ` +
                        `${row.quote.unitPayout.toLocaleString()} XP each`,
                    emoji:
                        row.presentation.emoji
                }))
            );


    return [
        new ActionRowBuilder()
            .addComponents(
                menu
            )
    ];

}


function buildSellMenuPayload(
    rows,
    userID
){

    const hasInventory =
        rows.length > 0;


    const embed =
        new EmbedBuilder()
            .setColor(
                hasInventory
                    ? "#2ECC71"
                    : "#7F8C8D"
            )
            .setTitle(
                "💱 Sell Boosts"
            )
            .setDescription(
                hasInventory
                    ? (
                        "Choose a boost below, then enter how many you want to sell.\n\n" +
                        "You receive **50% of its live `!values` midpoint**. " +
                        "The final price and your inventory are checked again when you confirm."
                    )
                    : "You do not currently own any boosts that can be sold."
            )
            .setFooter({
                text:
                    "Selling to Mizuki does not change the community market value."
            });


    return {
        embeds: [
            embed
        ],
        components:
            buildSellComponents(
                rows,
                userID
            ),
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    };

}


function buildQuantityModal(
    userID,
    boostKey
){

    const [
        boostType,
        tier
    ] = boostKey.split(":");


    const modal =
        new ModalBuilder()
            .setCustomId(
                `${SELL_CUSTOM_ID_PREFIX}:quantity:${userID}:${boostType}:${tier}`
            )
            .setTitle(
                "Sell Boosts"
            );


    const quantityInput =
        new TextInputBuilder()
            .setCustomId(
                "quantity"
            )
            .setLabel(
                "How many do you want to sell?"
            )
            .setPlaceholder(
                `1-${boostSell.MAX_BOOST_SELL_QUANTITY.toLocaleString()}`
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setMinLength(1)
            .setMaxLength(9)
            .setRequired(true);


    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                quantityInput
            )
    );


    return modal;

}


async function replyEphemeral(
    interaction,
    content
){

    const payload =
        typeof content === "string"
            ? {
                content,
                components: []
            }
            : content;


    if(
        interaction.replied
        ||
        interaction.deferred
    ){

        return interaction.editReply(
            payload
        );

    }


    return interaction.reply({
        ...payload,
        flags:
            MessageFlags.Ephemeral
    });

}


async function execute(message){

    if(!message.guild){
        return;
    }


    const rows =
        await getSellableBoosts(
            message.guild.id,
            message.author.id
        );


    return message.reply(
        buildSellMenuPayload(
            rows,
            message.author.id
        )
    );

}


async function handleInteraction(
    interaction
){

    const customID =
        String(
            interaction.customId || ""
        );


    if(
        !customID.startsWith(
            `${SELL_CUSTOM_ID_PREFIX}:`
        )
    ){

        return false;

    }


    try{

        const parts =
            customID.split(":");


        const action =
            parts[1];


        const ownerID =
            parts[2];


        if(
            String(interaction.user.id) !==
                String(ownerID)
        ){

            await replyEphemeral(
                interaction,
                "🚫 This sell menu belongs to someone else. Use **!sell** to open your own."
            );


            return true;

        }


        if(
            action === "select"
            &&
            interaction.isStringSelectMenu()
        ){

            const boostKey =
                String(
                    interaction.values?.[0] ||
                    ""
                ).toLowerCase();


            if(
                !database.BOOST_VALUE_BASES[
                    boostKey
                ]
            ){

                await replyEphemeral(
                    interaction,
                    "❌ That boost cannot be sold."
                );


                return true;

            }


            await interaction.showModal(
                buildQuantityModal(
                    ownerID,
                    boostKey
                )
            );


            return true;

        }


        if(
            action === "quantity"
            &&
            interaction.isModalSubmit()
        ){

            const boostType =
                String(
                    parts[3] || ""
                ).toLowerCase();


            const tier =
                String(
                    parts[4] || ""
                ).toLowerCase();


            const quantity =
                boostSell.parseSellQuantity(
                    interaction.fields
                        .getTextInputValue(
                            "quantity"
                        )
                );


            if(!quantity){

                await replyEphemeral(
                    interaction,
                    `❌ Enter a whole number from **1** to **${boostSell.MAX_BOOST_SELL_QUANTITY.toLocaleString()}**.`
                );


                return true;

            }


            await interaction.deferReply({
                flags:
                    MessageFlags.Ephemeral
            });


            const result =
                await database.sellBoostInventory(
                    interaction.guildId,
                    interaction.user.id,
                    boostType,
                    tier,
                    quantity
                );


            if(
                result.status ===
                    "insufficient-inventory"
            ){

                await replyEphemeral(
                    interaction,
                    `❌ You only own **x${Number(result.available).toLocaleString()}** of that boost.`
                );


                return true;

            }


            if(!result.success){

                await replyEphemeral(
                    interaction,
                    "❌ That sale could not be completed. Your inventory and XP were not changed."
                );


                return true;

            }


            const row = {
                key:
                    result.key,
                boostType:
                    result.boostType,
                tier:
                    result.tier
            };


            const presentation =
                getBoostPresentation(
                    row
                );


            // A sale changes the real XP balance, so immediately refresh the
            // stored level and exclusive level role just like trades do. A
            // Discord role/announcement failure must never misreport the
            // already-committed database sale as rolled back.
            await leveling.syncLevelAndAnnounce(
                interaction.client,
                interaction.guildId,
                interaction.user.id
            ).catch(error => {

                console.error(
                    "Could not sync level after boost sale:",
                    error
                );

            });


            const remainingRows =
                await getSellableBoosts(
                    interaction.guildId,
                    interaction.user.id
                );


            const embed =
                new EmbedBuilder()
                    .setColor("#2ECC71")
                    .setTitle("✅ Boosts Sold")
                    .setDescription(
                        `Sold **x${result.quantity.toLocaleString()}** ${presentation.mention}.`
                    )
                    .addFields(
                        {
                            name: "📊 Live Market Range",
                            value:
                                `\`${result.currentMin.toLocaleString()}-${result.currentMax.toLocaleString()} XP\``,
                            inline: false
                        },
                        {
                            name: "💵 Your 50% Sell Price",
                            value:
                                `**${result.unitPayout.toLocaleString()} XP each**\n` +
                                `Total received: **${result.totalPayout.toLocaleString()} XP**`,
                            inline: false
                        },
                        {
                            name: "🎒 Remaining",
                            value:
                                `**x${result.remaining.toLocaleString()}** • ` +
                                `XP balance: **${result.balance.toLocaleString()}**`,
                            inline: false
                        }
                    )
                    .setFooter({
                        text:
                            remainingRows.length > 0
                                ? "Choose another boost below to keep selling."
                                : "You have no more sellable boosts."
                    });


            await interaction.editReply({
                embeds: [
                    embed
                ],
                components:
                    buildSellComponents(
                        remainingRows,
                        interaction.user.id
                    ),
                allowedMentions: {
                    parse: []
                }
            });


            return true;

        }


        await replyEphemeral(
            interaction,
            "❌ This sell menu is no longer valid. Use **!sell** again."
        );


        return true;

    }
    catch(error){

        console.error(
            "Boost sell interaction failed:",
            error
        );


        await replyEphemeral(
            interaction,
            "❌ The sale failed safely. Your boost and XP were not changed."
        ).catch(
            () => null
        );


        return true;

    }

}


module.exports = {
    execute,
    handleInteraction,
    getSellableBoosts,
    buildSellMenuPayload,
    buildQuantityModal,
    normalizeInventoryRow,
    getBoostPresentation,
    SELL_CUSTOM_ID_PREFIX
};
