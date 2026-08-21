const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const database = require("../database");
const boosts = require("../systems/boosts");
const luck = require("../utils/luck");
const leveling = require("../systems/leveling");
const quests = require("../systems/quests");
const merchantCommand = require("./merchant");

const TIERS = [
    "tier1",
    "tier2",
    "tier3",
    "max"
];

const TIER_LABELS = {
    tier1: "I",
    tier2: "II",
    tier3: "III",
    max: "MAX"
};


function formatNumber(value){

    return Number(
        value || 0
    ).toLocaleString();

}


function applyStoredShopPrices(rows){

    for(const row of rows){

        const key =
            `${String(row.boosttype).toLowerCase()}:` +
            `${String(row.tier).toLowerCase()}`;


        const item =
            database.SHOP_CATALOG[key];


        const storedPrice =
            Number(row.price);


        if(
            item
            &&
            Number.isFinite(storedPrice)
            &&
            storedPrice > 0
        ){

            item.price =
                storedPrice;

        }

    }

}


function getProfile(
    boostType,
    tier
){

    if(boostType === "xp"){

        return boosts.BOOST_PROFILES[tier];

    }


    return luck.LUCK_ROLES[tier];

}


function mapStock(rows){

    const stock = {
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


    for(const row of rows){

        const boostType =
            String(
                row.boosttype
            ).toLowerCase();


        const tier =
            String(
                row.tier
            ).toLowerCase();


        if(
            stock[boostType]
            &&
            Object.prototype.hasOwnProperty.call(
                stock[boostType],
                tier
            )
        ){

            stock[boostType][tier] =
                Number(
                    row.amount
                ) || 0;

        }

    }


    return stock;

}


function getCatalogItem(
    boostType,
    tier
){

    return database.SHOP_CATALOG[
        `${boostType}:${tier}`
    ];

}


function formatShopLine(
    boostType,
    tier,
    stock
){

    const item =
        getCatalogItem(
            boostType,
            tier
        );


    const profile =
        getProfile(
            boostType,
            tier
        );


    const amount =
        stock[boostType][tier];


    const stockText =
        amount > 0
            ? `${amount}/${item.maxStock} available`
            : "Sold out";


    return (
        `<@&${profile.roleID}>\n` +
        `Price: **${item.price.toLocaleString()} XP**\n` +
        `Stock: **${stockText}**`
    );

}


function createShopButtons(
    stock,
    merchant,
    disableAll = false
){

    const xpRow =
        new ActionRowBuilder();


    const luckRow =
        new ActionRowBuilder();


    for(const tier of TIERS){

        const xpItem =
            getCatalogItem(
                "xp",
                tier
            );


        const luckItem =
            getCatalogItem(
                "luck",
                tier
            );


        xpRow.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `shop_buy:xp:${tier}`
                )
                .setLabel(
                    `Buy XP ${TIER_LABELS[tier]} - ${xpItem.price.toLocaleString()}`
                )
                .setStyle(
                    tier === "max"
                        ? ButtonStyle.Danger
                        : ButtonStyle.Primary
                )
                .setDisabled(
                    disableAll
                    ||
                    stock.xp[tier] <= 0
                )
        );


        luckRow.addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `shop_buy:luck:${tier}`
                )
                .setLabel(
                    `Buy Luck ${TIER_LABELS[tier]} - ${luckItem.price.toLocaleString()}`
                )
                .setStyle(
                    tier === "max"
                        ? ButtonStyle.Danger
                        : ButtonStyle.Secondary
                )
                .setDisabled(
                    disableAll
                    ||
                    stock.luck[tier] <= 0
                )
        );

    }


    const navigationRow =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "shop_page:merchant"
                    )
                    .setLabel(
                        merchant.active
                            ? `Traveling Merchant - ${merchant.deals.length} deals`
                            : "Traveling Merchant - Away"
                    )
                    .setEmoji("🧳")
                    .setStyle(
                        merchant.active
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
                    .setDisabled(
                        disableAll
                    )
            );


    return [
        xpRow,
        luckRow,
        navigationRow
    ];

}


function createMerchantButtons(
    merchant,
    disableAll = false
){

    const rows = [];


    if(merchant.active){

        for(
            let index = 0;
            index < merchant.deals.length;
            index += 5
        ){

            const row =
                new ActionRowBuilder();


            for(
                const deal of
                merchant.deals.slice(
                    index,
                    index + 5
                )
            ){

                const soldOut =
                    Number(deal.amount) <= 0;


                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `merchant_buy:${merchant.cycleID}:${deal.id}`
                        )
                        .setLabel(
                            `#${deal.displayOrder} • ${deal.name} • ` +
                            (
                                soldOut
                                    ? "SOLD OUT"
                                    : `${deal.amount}/${deal.maxAmount}`
                            )
                        )
                        .setStyle(
                            soldOut
                                ? ButtonStyle.Secondary
                                : ButtonStyle.Success
                        )
                        .setDisabled(
                            disableAll
                            ||
                            soldOut
                        )
                );

            }


            rows.push(row);

        }

    }


    rows.push(
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        "shop_page:shop"
                    )
                    .setLabel(
                        "Back to Boost Shop"
                    )
                    .setEmoji("↩️")
                    .setStyle(
                        ButtonStyle.Primary
                    )
                    .setDisabled(
                        disableAll
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        "shop_page:merchant"
                    )
                    .setLabel(
                        "Refresh Merchant"
                    )
                    .setEmoji("🔄")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        disableAll
                    )
            )
    );


    return rows;

}


async function buildShopPanel(
    disableAll = false
){

    const shop =
        await database.getGlobalShop();


    const merchant =
        await database.getTravelingMerchant();


    applyStoredShopPrices(
        shop.stock
    );


    const stock =
        mapStock(
            shop.stock
        );


    const refreshTimestamp =
        Math.floor(
            shop.nextRefreshAt / 1000
        );


    const xpLines =
        TIERS.map(
            tier =>
                formatShopLine(
                    "xp",
                    tier,
                    stock
                )
        ).join("\n\n");


    const luckLines =
        TIERS.map(
            tier =>
                formatShopLine(
                    "luck",
                    tier,
                    stock
                )
        ).join("\n\n");


    let merchantStatus;


    if(merchant.active){

        const restockTimestamp =
            Math.floor(
                merchant.nextRestockAt / 1000
            );


        const leavesTimestamp =
            Math.floor(
                merchant.endsAt / 1000
            );


        merchantStatus =
            `🧳 **Here now with ${merchant.deals.length} deals.**\n` +
            `Deals restock <t:${restockTimestamp}:R>. ` +
            `He leaves <t:${leavesTimestamp}:R>.`;

    }
    else{

        const arrivalTimestamp =
            Math.floor(
                merchant.nextRefreshAt / 1000
            );


        merchantStatus =
            "🛤️ Away this shop cycle. " +
            `The next **30% arrival roll** is <t:${arrivalTimestamp}:R>.`;

    }


    const embed =
        new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("Global Boost Shop")
            .setDescription(
                "Stock is shared across the entire server. A purchased boost is added to your `!boost` inventory. Active quest discounts are applied automatically at checkout."
            )
            .addFields(
                {
                    name: "XP Boosts",
                    value: xpLines,
                    inline: true
                },
                {
                    name: "Luck Boosts",
                    value: luckLines,
                    inline: true
                },
                {
                    name: "Traveling Merchant",
                    value: merchantStatus,
                    inline: false
                },
                {
                    name: "Main Shop Restock",
                    value:
                        `Next restock: <t:${refreshTimestamp}:R>\n` +
                        `Exact time: <t:${refreshTimestamp}:T>`,
                    inline: false
                }
            )
            .setFooter({
                text:
                    disableAll
                        ? "This shop panel is unavailable."
                        : "Use the merchant button to replace this message with his current deals."
            })
            .setTimestamp();


    return {
        embeds: [
            embed
        ],
        components:
            createShopButtons(
                stock,
                merchant,
                disableAll
            ),
        allowedMentions: {
            parse: []
        }
    };

}


async function buildMerchantShopPanel(
    disableAll = false
){

    const merchant =
        await database.getTravelingMerchant();


    const embed =
        new EmbedBuilder()
            .setColor(
                merchant.active
                    ? "#F1C40F"
                    : "#747F8D"
            )
            .setTitle(
                merchant.active
                    ? "🧳 Traveling Merchant"
                    : "🛤️ Traveling Merchant - Away"
            );


    if(merchant.active){

        const restockTimestamp =
            Math.floor(
                merchant.nextRestockAt / 1000
            );


        const leavesTimestamp =
            Math.floor(
                merchant.endsAt / 1000
            );


        embed
            .setDescription(
                "💡 **Left = you pay • Right = you receive**\n" +
                "Select a numbered deal below. Stock is global, and each successful purchase uses one stock. Each visit lasts **1 hour**; his offers and stock rotate every **30 minutes**."
            )
            .addFields(
                ...merchant.deals.map(deal => ({
                    name:
                        merchantCommand.formatDealTitle(
                            deal
                        ),
                    value:
                        merchantCommand.formatDealTrade(
                            deal
                        ) +
                        "\n" +
                        merchantCommand.formatDealStock(
                            deal
                        ),
                    inline: false
                })),
                {
                    name: "Timing",
                    value:
                        `Deals restock: <t:${restockTimestamp}:R> • <t:${restockTimestamp}:T>\n` +
                        `Merchant leaves: <t:${leavesTimestamp}:R>`,
                    inline: false
                }
            )
            .setFooter({
                text:
                    disableAll
                        ? "This merchant panel is unavailable."
                        : "Deal buttons are protected against stale 30-minute restocks."
            });

    }
    else{

        const arrivalTimestamp =
            Math.floor(
                merchant.nextRefreshAt / 1000
            );


        embed
            .setDescription(
                "The merchant is not visiting during this main shop cycle. The next 30% arrival roll happens with the normal shop restock. Once he appears, he stays for **1 hour**, and his deals and stock rotate every **30 minutes**."
            )
            .addFields({
                name: "Next arrival roll",
                value:
                    `<t:${arrivalTimestamp}:R> • <t:${arrivalTimestamp}:T>`,
                inline: false
            })
            .setFooter({
                text: "Use Refresh Merchant after the next arrival roll, or return to the boost shop."
            });

    }


    embed.setTimestamp();


    return {
        embeds: [
            embed
        ],
        components:
            createMerchantButtons(
                merchant,
                disableAll
            ),
        allowedMentions: {
            parse: []
        }
    };

}


function getShopPurchaseMessage(
    interaction,
    result,
    boostType,
    tier
){

    const profile =
        getProfile(
            boostType,
            tier
        );


    if(result.status === "sold-out"){

        const refreshTimestamp =
            Math.floor(
                result.nextRefreshAt / 1000
            );


        return (
            `<@&${profile.roleID}> is sold out.\n` +
            `The shop restocks <t:${refreshTimestamp}:R>.`
        );

    }


    if(result.status === "not-enough-xp"){

        const discountText =
            Number(result.discountPercent) > 0
                ? `\nQuest discount applied: **${result.discountPercent}% off** ` +
                    `(normal price: ${Number(result.basePrice).toLocaleString()} XP)`
                : "";


        return (
            `You need **${result.price.toLocaleString()} XP** to buy <@&${profile.roleID}>.\n` +
            `Current balance: **${result.balance.toLocaleString()} XP**\n` +
            `Missing: **${result.missing.toLocaleString()} XP**` +
            discountText
        );

    }


    if(!result.success){

        return "The purchase could not be completed.";

    }


    const discountText =
        Number(result.discountPercent) > 0
            ? `\nQuest discount: **${result.discountPercent}% off** ` +
                `(normal price: ${Number(result.basePrice).toLocaleString()} XP)`
            : "";


    return (
        `${interaction.user} purchased <@&${profile.roleID}>.\n` +
        `Price paid: **${result.price.toLocaleString()} XP**\n` +
        `Inventory amount: **${result.inventoryAmount}**\n` +
        `Global stock remaining: **${result.remainingStock}**\n` +
        `XP balance: **${result.balance.toLocaleString()} XP**` +
        discountText
    );

}


function getMerchantPurchaseMessage(result){

    if(result.status === "sold-out"){
        return "❌ That merchant deal is **sold out**.";
    }


    if(result.status === "not-enough-xp"){

        return (
            "❌ You do not have enough XP. You are missing **" +
            formatNumber(
                result.missing
            ) +
            " XP**."
        );

    }


    if(result.status === "not-enough-boosts"){

        return (
            "❌ You do not have enough stored boosts. You are missing " +
            merchantCommand.formatSide({
                xp: 0,
                boosts: [
                    {
                        ...result.boost,
                        amount:
                            result.missing
                    }
                ],
                perk: null
            }) +
            "."
        );

    }


    if(result.status === "already-owned"){
        return "❌ You already permanently own that merchant perk.";
    }


    if(result.status === "merchant-refreshed"){
        return "🔄 The merchant's 30-minute deals restocked while you were buying. The panel has been refreshed.";
    }


    if(result.status === "merchant-away"){
        return "🛤️ The Traveling Merchant has already left.";
    }


    if(!result.success){
        return "❌ That Traveling Merchant deal is not available.";
    }


    return (
        "✅ **Purchased: " +
        result.deal.name +
        "!**\n" +
        "You received: " +
        merchantCommand.formatSide(
            result.deal.reward
        ) +
        "\nYou paid: " +
        merchantCommand.formatSide(
            result.deal.cost
        ) +
        "\nGlobal stock remaining: **" +
        formatNumber(
            result.remainingStock
        ) +
        "**\nYour XP balance: **" +
        formatNumber(
            result.balance
        ) +
        " XP**" +
        (
            result.entireMerchantSoldOut
                ? "\n\n🏜️ **Every current merchant deal is now sold out.**"
                : ""
        )
    );

}


async function syncShopPurchase(
    interaction,
    result,
    boostType,
    tier
){

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


    await quests.recordEvent(
        interaction,
        "shop_purchase",
        1
    );


    if(
        boostType === "luck"
        &&
        tier === "max"
    ){

        await quests.recordEvent(
            interaction,
            "buy_luck_max",
            1
        );

    }


    if(result.entireStoreSoldOut){

        await quests.recordEvent(
            interaction,
            "sold_out_store",
            1
        );

    }

}


async function syncMerchantPurchase(
    interaction,
    result
){

    if(result.rewardXP > 0){

        await database.addBoostActivity(
            interaction.guild.id,
            interaction.user.id,
            result.rewardXP
        );


        await quests.recordEvent(
            interaction,
            "earn_xp",
            result.rewardXP
        );

    }


    await quests.recordEvent(
        interaction,
        "shop_purchase",
        1
    );


    await boosts.updateBoost(
        interaction.member
    );


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


async function showPage(
    shopMessage,
    interaction,
    page
){

    await interaction.deferUpdate();


    const panel =
        page === "merchant"
            ? await buildMerchantShopPanel()
            : await buildShopPanel();


    await shopMessage.edit(
        panel
    );

}


async function handleShopPurchase(
    shopMessage,
    interaction,
    boostType,
    tier
){

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });


    const result =
        await database.purchaseGlobalShopItem(
            interaction.guild.id,
            interaction.user.id,
            `${boostType}:${tier}`
        );


    if(result.success){

        try{

            await syncShopPurchase(
                interaction,
                result,
                boostType,
                tier
            );

        }
        catch(error){

            console.error(
                "Shop post-purchase sync failed:",
                error
            );

        }

    }


    try{

        const panel =
            await buildShopPanel();


        await shopMessage.edit(
            panel
        );

    }
    catch(error){

        console.error(
            "Could not refresh the boost shop panel:",
            error
        );

    }


    await interaction.editReply({
        content:
            getShopPurchaseMessage(
                interaction,
                result,
                boostType,
                tier
            ),
        allowedMentions: {
            parse: []
        }
    });

}


async function handleMerchantPurchase(
    shopMessage,
    interaction,
    expectedCycleID,
    dealID
){

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });


    const result =
        await database.purchaseTravelingMerchantDeal(
            interaction.guild.id,
            interaction.user.id,
            dealID,
            expectedCycleID
        );


    if(result.success){

        try{

            await syncMerchantPurchase(
                interaction,
                result
            );

        }
        catch(error){

            console.error(
                "Traveling Merchant post-purchase sync failed:",
                error
            );

        }

    }


    try{

        const panel =
            await buildMerchantShopPanel();


        await shopMessage.edit(
            panel
        );

    }
    catch(error){

        console.error(
            "Could not refresh the merchant panel:",
            error
        );

    }


    await interaction.editReply({
        content:
            getMerchantPurchaseMessage(
                result
            ),
        allowedMentions: {
            parse: []
        }
    });

}


async function execute(message){

    if(!message.guild){
        return;
    }


    const shopMessage =
        await message.reply(
            await buildShopPanel()
        );


    const collector =
        shopMessage.createMessageComponentCollector({
            componentType:
                ComponentType.Button
        });


    collector.on(
        "collect",
        async interaction => {

            const [
                action,
                firstValue,
                secondValue
            ] = interaction.customId.split(":");


            try{

                if(action === "shop_page"){

                    return await showPage(
                        shopMessage,
                        interaction,
                        firstValue
                    );

                }


                if(action === "shop_buy"){

                    return await handleShopPurchase(
                        shopMessage,
                        interaction,
                        firstValue,
                        secondValue
                    );

                }


                if(action === "merchant_buy"){

                    return await handleMerchantPurchase(
                        shopMessage,
                        interaction,
                        firstValue,
                        secondValue
                    );

                }

            }
            catch(error){

                console.error(
                    "Shop interaction failed:",
                    error
                );


                const errorMessage =
                    "The shop ran into an error. If this happened after a purchase confirmation, your completed purchase is still saved.";


                if(
                    interaction.deferred
                    ||
                    interaction.replied
                ){

                    if(action === "shop_page"){

                        await interaction.followUp({
                            content: errorMessage,
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});

                    }
                    else{

                        await interaction.editReply({
                            content: errorMessage
                        }).catch(() => {});

                    }

                }
                else{

                    await interaction.reply({
                        content: errorMessage,
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});

                }

            }

        }
    );

}


module.exports = {
    execute,
    buildShopPanel,
    buildMerchantShopPanel,
    createShopButtons,
    createMerchantButtons,
    getMerchantPurchaseMessage
};
