const database =
    require("../database");

const boosts =
    require("../systems/boosts");

const luck =
    require("../utils/luck");

const xp =
    require("../utils/xp");

const levelRoles =
    require("../systems/levelRoles");

const quests =
    require("../systems/quests");


const BOOST_ROLE_MENTIONS = {

    "xp:max":
        "<@&" +
        boosts.BOOST_ROLES.max +
        ">",

    "luck:tier1":
        "<@&" +
        luck.LUCK_ROLES.tier1.roleID +
        ">",

    "luck:tier3":
        "<@&" +
        luck.LUCK_ROLES.tier3.roleID +
        ">",

    "luck:max":
        "<@&" +
        luck.LUCK_ROLES.max.roleID +
        ">",

    "luck:omega":
        "<@&" +
        luck.LUCK_ROLES.omega.roleID +
        ">"

};


const BOOST_FALLBACK_NAMES = {

    "xp:max":
        "💎 XP Boost MAX",

    "luck:tier1":
        "🌿 Luck Boost I",

    "luck:tier3":
        "☘️ Luck Boost III",

    "luck:max":
        "🍀 Luck Boost MAX",

    "luck:omega":
        "👁️‍🗨️ Luck Boost Ω"

};


function formatNumber(value){

    return Number(
        value || 0
    ).toLocaleString();

}


function getBoostKey(boost){

    return (
        String(
            boost?.boostType || ""
        ).toLowerCase() +
        ":" +
        String(
            boost?.tier || ""
        ).toLowerCase()
    );

}


function formatBoost(boost){

    const key =
        getBoostKey(
            boost
        );


    const label =
        BOOST_ROLE_MENTIONS[key]
        ||
        BOOST_FALLBACK_NAMES[key]
        ||
        (
            boost.boostType +
            " " +
            boost.tier
        );


    return (
        "**" +
        formatNumber(
            boost.amount
        ) +
        "×** " +
        label
    );

}


function formatDuration(durationMs){

    const hours =
        Math.max(
            1,
            Math.round(
                Number(durationMs) /
                (60 * 60 * 1000)
            )
        );


    return (
        "**" +
        formatNumber(hours) +
        " hour" +
        (
            hours === 1
                ? ""
                : "s"
        ) +
        "**"
    );

}


function formatPerk(perk){

    if(
        perk?.type ===
        "chat_xp_permanent"
    ){

        return (
            "permanent **" +
            formatNumber(
                perk.multiplier
            ) +
            "× chat XP**"
        );

    }


    if(
        perk?.type ===
        "multi_roll_permanent"
    ){

        return (
            "permanent **" +
            formatNumber(
                perk.rollCount
            ) +
            " rolls per 1 !roll**"
        );

    }


    if(
        perk?.type ===
        "multi_roll_timed"
    ){

        return (
            "**" +
            formatNumber(
                perk.rollCount
            ) +
            " rolls per 1 !roll** for " +
            formatDuration(
                perk.durationMs
            )
        );

    }


    return null;

}


function formatSide(side){

    const parts = [];


    if(
        Number(
            side?.xp || 0
        ) > 0
    ){

        parts.push(
            "**" +
            formatNumber(
                side.xp
            ) +
            " XP**"
        );

    }


    for(
        const boost of
        Array.isArray(side?.boosts)
            ? side.boosts
            : []
    ){

        parts.push(
            formatBoost(
                boost
            )
        );

    }


    const perkText =
        formatPerk(
            side?.perk
        );


    if(perkText){

        parts.push(
            perkText
        );

    }


    return (
        parts.join(" + ")
        ||
        "Nothing"
    );

}


function buildMerchantPanel(merchant){

    const leavesAt =
        Math.floor(
            Number(
                merchant.endsAt
            ) / 1000
        );


    const restocksAt =
        Math.floor(
            Number(
                merchant.nextRestockAt
            ) / 1000
        );


    const dealLines =
        merchant.deals.map(deal => {

            const soldOut =
                Number(deal.amount) <= 0;


            return (
                "**" +
                deal.displayOrder +
                " • " +
                deal.name +
                "**\n" +
                "You receive: " +
                formatSide(deal.reward) +
                "\nYou pay: " +
                formatSide(deal.cost) +
                "\n" +
                (
                    soldOut
                        ? "Stock: **SOLD OUT**"
                        : (
                            "Global stock: **" +
                            formatNumber(
                                deal.amount
                            ) +
                            "/" +
                            formatNumber(
                                deal.maxAmount
                            ) +
                            "**"
                        )
                )
            );

        });


    return (
        "🧳 **THE TRAVELING MERCHANT HAS ARRIVED!**\n" +
        "His visit lasts **1 hour**. He leaves <t:" +
        leavesAt +
        ":R> • his deals restock <t:" +
        restocksAt +
        ":R> (every 30 minutes).\n" +
        "Exact leave time: <t:" +
        leavesAt +
        ":T>.\n" +
        "Stock is shared by everyone, and one successful purchase uses one stock.\n\n" +
        dealLines.join("\n\n") +
        "\n\nOpen **!shop** to use the deal buttons, or buy with **!merchant buy <deal number>**."
    );

}


async function sendNoMerchantMessage(
    message,
    merchant
){

    const nextRefresh =
        Math.floor(
            Number(
                merchant.nextRefreshAt
            ) / 1000
        );


    return message.reply({
        content:
            "🛤️ **The Traveling Merchant is not visiting this shop cycle.**\n" +
            "The next **30% arrival roll** happens when the shop restocks <t:" +
            nextRefresh +
            ":R>.",
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

}


async function showMerchant(message){

    const merchant =
        await database
            .getTravelingMerchant();


    if(!merchant.active){

        return sendNoMerchantMessage(
            message,
            merchant
        );

    }


    return message.channel.send({
        content:
            buildMerchantPanel(
                merchant
            ),
        allowedMentions: {
            parse: []
        }
    });

}


async function sendShopNotice(message){

    const merchant =
        await database
            .getTravelingMerchant();


    if(!merchant.active){
        return null;
    }


    const leavesAt =
        Math.floor(
            Number(
                merchant.endsAt
            ) / 1000
        );


    return message.channel.send({
        content:
            "🧳 **A Traveling Merchant is here this cycle!** " +
            "He leaves <t:" +
            leavesAt +
            ":R> after a **1-hour visit**. Use **!shop** to view his **" +
            merchant.deals.length +
            " deals**; they restock every **30 minutes**.",
        allowedMentions: {
            parse: []
        }
    });

}


async function syncMemberAfterPurchase(
    message,
    result
){

    const guildID =
        message.guild.id;


    const userID =
        message.author.id;


    if(result.rewardXP > 0){

        await database.addBoostActivity(
            guildID,
            userID,
            result.rewardXP
        );


        await quests.recordEvent(
            message,
            "earn_xp",
            result.rewardXP
        );

    }


    await quests.recordEvent(
        message,
        "shop_purchase",
        1
    );


    await boosts.updateBoost(
        message.member
    );


    const user =
        await database.getUser(
            guildID,
            userID
        );


    const correctLevel =
        xp.getLevel(
            Number(user.xp) || 0
        );


    if(
        Number(user.level) !==
        correctLevel
    ){

        await database.setLevel(
            guildID,
            userID,
            correctLevel
        );

    }


    await levelRoles.syncMemberLevelRole(
        message.member,
        correctLevel
    );


    return {
        ...user,
        level:
            correctLevel
    };

}


async function replyPurchaseFailure(
    message,
    result
){

    let content;


    if(result.status === "sold-out"){

        content =
            "❌ That merchant deal is **sold out**.";

    }
    else if(
        result.status ===
        "not-enough-xp"
    ){

        content =
            "❌ You do not have enough XP. " +
            "You are missing **" +
            formatNumber(
                result.missing
            ) +
            " XP**.";

    }
    else if(
        result.status ===
        "not-enough-boosts"
    ){

        content =
            "❌ You do not have enough stored boosts. " +
            "You need **" +
            formatNumber(
                result.missing
            ) +
            " more** " +
            formatBoost({
                ...result.boost,
                amount: 1
            }).replace(
                "**1×** ",
                ""
            ) +
            ".";

    }
    else if(
        result.status ===
        "already-owned"
    ){

        content =
            "❌ You already permanently own that merchant perk.";

    }
    else if(
        result.status ===
        "merchant-refreshed"
    ){

        content =
            "🔄 The merchant's 30-minute deals restocked while you were buying. Open **!shop** and try again with the new buttons.";

    }
    else if(
        result.status ===
        "merchant-away"
    ){

        content =
            "🛤️ The Traveling Merchant has already left.";

    }
    else{

        content =
            "❌ That Traveling Merchant deal is not available.";

    }


    return message.reply({
        content,
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

}


async function buyMerchantDeal(
    message,
    dealNumber
){

    const merchant =
        await database
            .getTravelingMerchant();


    if(!merchant.active){

        return sendNoMerchantMessage(
            message,
            merchant
        );

    }


    const selectedDeal =
        merchant.deals.find(
            deal =>
                Number(
                    deal.displayOrder
                ) === dealNumber
        );


    if(!selectedDeal){

        return message.reply({
            content:
                "❌ Invalid deal number. Use **!merchant** to see the current offers.",
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        });

    }


    const result =
        await database
            .purchaseTravelingMerchantDeal(
                message.guild.id,
                message.author.id,
                selectedDeal.id,
                merchant.cycleID
            );


    if(!result.success){

        return replyPurchaseFailure(
            message,
            result
        );

    }


    let updatedUser = {
        xp:
            result.balance
    };


    try{

        updatedUser =
            await syncMemberAfterPurchase(
                message,
                result
            );

    }
    catch(error){

        console.error(
            "Traveling Merchant post-purchase sync failed:",
            error
        );

    }


    return message.reply({
        content:
            "✅ **Purchased: " +
            result.deal.name +
            "!**\n" +
            "You received: " +
            formatSide(
                result.deal.reward
            ) +
            "\nYou paid: " +
            formatSide(
                result.deal.cost
            ) +
            "\nGlobal stock remaining: **" +
            formatNumber(
                result.remainingStock
            ) +
            "**\nYour XP balance: **" +
            formatNumber(
                updatedUser.xp
            ) +
            " XP**" +
            (
                result.entireMerchantSoldOut
                    ? "\n\n🏜️ **Every deal is now sold out.**"
                    : ""
            ),
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

}


async function execute(message){

    if(!message.guild){
        return;
    }


    const content =
        message.content
            .trim();


    const buyMatch =
        content.match(
            /^!merchant\s+buy\s+(\d+)$/i
        );


    if(buyMatch){

        return buyMerchantDeal(
            message,
            Number(
                buyMatch[1]
            )
        );

    }


    if(
        /^!merchant$/i.test(
            content
        )
    ){

        return showMerchant(
            message
        );

    }


    return message.reply({
        content:
            "Use **!merchant** to view the current offers or **!merchant buy <deal number>** to purchase one.",
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

}


module.exports = {

    execute,

    sendShopNotice,

    buildMerchantPanel,

    formatSide,

    formatPerk

};
