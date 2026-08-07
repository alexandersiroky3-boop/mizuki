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


const leveling =
    require("../systems/leveling");

const quests =
    require("../systems/quests");


const SHOP_OPEN_TIME =
    10 * 60 * 1000;


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


    return [
        xpRow,
        luckRow
    ];

}


async function buildShopPanel(
    disableAll = false
){

    const shop =
        await database.getGlobalShop();


    // The database stores the price selected for this exact
    // two-hour shop cycle. Apply it before building the embed/buttons.
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


    const embed =
        new EmbedBuilder()

            .setColor(
                "#5865F2"
            )

            .setTitle(
                "Global Boost Shop"
            )

            .setDescription(
                "Stock is shared across the entire server. A purchased boost is added to your `!boost` inventory."
            )

            .addFields(

                {
                    name:
                        "XP Boosts",

                    value:
                        xpLines,

                    inline:
                        true
                },

                {
                    name:
                        "Luck Boosts",

                    value:
                        luckLines,

                    inline:
                        true
                },

                {
                    name:
                        "Restock",

                    value:
                        `Next restock: <t:${refreshTimestamp}:R>\n` +
                        `Exact time: <t:${refreshTimestamp}:T>`,

                    inline:
                        false
                }

            )

            .setFooter({

                text:
                    disableAll
                        ? "This shop panel is unavailable."
                        : "Click a button to purchase that boost with your XP. This panel stays active until the bot restarts."

            })

            .setTimestamp();


    return {

        embeds: [
            embed
        ],

        components:
            createShopButtons(
                stock,
                disableAll
            )

    };

}


function getPurchaseMessage(
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


    if(
        result.status ===
        "sold-out"
    ){

        const refreshTimestamp =
            Math.floor(
                result.nextRefreshAt / 1000
            );


        return (
            `<@&${profile.roleID}> is sold out.\n` +
            `The shop restocks <t:${refreshTimestamp}:R>.`
        );

    }


    if(
        result.status ===
        "not-enough-xp"
    ){

        return (
            `You need **${result.price.toLocaleString()} XP** to buy <@&${profile.roleID}>.\n` +
            `Current balance: **${result.balance.toLocaleString()} XP**\n` +
            `Missing: **${result.missing.toLocaleString()} XP**`
        );

    }


    if(!result.success){

        return (
            "The purchase could not be completed."
        );

    }


    return (
        `${interaction.user} purchased <@&${profile.roleID}>.\n` +
        `Price paid: **${result.price.toLocaleString()} XP**\n` +
        `Inventory amount: **${result.inventoryAmount}**\n` +
        `Global stock remaining: **${result.remainingStock}**\n` +
        `XP balance: **${result.balance.toLocaleString()} XP**`
    );

}


async function execute(message){

    if(!message.guild)
        return;


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
                boostType,
                tier
            ] = interaction.customId.split(":");


            if(action !== "shop_buy")
                return;


            try{

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
                        boostType === "luck" &&
                        tier === "max"
                    ){

                        await quests.recordEvent(
                            interaction,
                            "buy_luck_max",
                            1
                        );

                    }

                }


                await shopMessage.edit(
                    await buildShopPanel()
                ).catch(() => {});


                await interaction.editReply({

                    content:
                        getPurchaseMessage(
                            interaction,
                            result,
                            boostType,
                            tier
                        )

                });

            }
            catch(error){

                console.error(
                    "Shop purchase failed:",
                    error
                );


                const errorMessage =
                    "The shop ran into an error. Your XP was not intentionally charged.";


                if(
                    interaction.deferred
                    ||
                    interaction.replied
                ){

                    await interaction.editReply({

                        content:
                            errorMessage

                    }).catch(() => {});

                }
                else{

                    await interaction.reply({

                        content:
                            errorMessage,

                        flags:
                            MessageFlags.Ephemeral

                    }).catch(() => {});

                }

            }

        }
    );


}


module.exports = {
    execute
};
