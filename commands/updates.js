const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");


const UPDATE_PANEL_DURATION_MS =
    10 * 60 * 1000;


const UPDATE_PAGES = Object.freeze([
    {
        version: "1.0",
        description: `# ✦★ Better Leveling System ★✦

*Made by @god_kape_16807 (aka me)*

*(why do you ask? cuz arcane bot sucks and i decided to make my own yipeee)*

||@everyone||

━━━━━━━━━━━━━━━━━━━━━━

# :robot::girl: Goth Mommy Bot :girl::robot:
               *(my gyat bot)*

## :question: How does it work?

### ✦ **XP System**
Every 20 seconds you can earn XP by chatting. Gain specific amount of XP to level up.

### :watch: **XP Boosts**
**There are 4 boost tiers:**

### @XP Boost I → 2x-3x XP
### @XP Boost II → 3x-6x XP
### <@&1526995123420922047> → 6x-10x XP
### @XP Boost MAX → 10x-15x XP

## Boost roles are obtained by grinding specific amount of XP within **1 hour**.

*(Higher tiers require more XP but gives better rewards.)*

## Boost timers last 1 hour and automatically refresh if you gain a specific amount of XP within 1 hour.

[For further details type \`!boost\`]

## :boom: **Critical XP**
### • Theres a small chance of receiving Critical XP.

### • The bot will react with the emoji :boom: when it happens.

### • Higher boost tiers = higher critical chances and bigger rewards.

━━━━━━━━━━━━━━━━━━━━━━

## :wrench: Features

### • Level system
### • XP tracking
### • XP boosts
### • Critical XP
### • Leaderboards
### • Fun commands

*[type \`!commands\` to see all available commands to this bot]*

━━━━━━━━━━━━━━━━━━━━━━

**:warning: Purposely breaking or abusing the bot may result in an instant ban.**`
    },
    {
        version: "1.2",
        description: `So i did some changes to the bot. This may be the last changes for the bot because i dont want it to have more than 50k lines of code which is already very close to that.

# • Luck System

I added a luck system to make commands feel easier and to make chatting less op. This obviously doesnt mean that the commands are really OP now, for people below lvl 100 yes, for people above lvl 100 chatting is still the best source on getting XP.

There are 4 luck boosts: @🌿 Luck Boost I , @🍃 Luck Boost II , @☘️ Luck Boost III and @🍀 Luck Boost MAX

These luck boosts have their own multiplier:

@🌿 Luck Boost I == 2x multiplier

@🍃 Luck Boost II == 10x multiplier

@☘️ Luck Boost III == 20x multiplier

@🍀 Luck Boost MAX == 50x multiplier

These luck boosts affect rolling, hugging, kissing and stealing...

# • Boost System

I reworked the whole boost system. From now on you need to activate the boost manually, boosts no longer activate automatically. You do that by doing !boost.

I added a whole inventory system for the boosts ect...

# • New command

Added a new command "!shop". Basically its a global merchant where you can buy boosts. (In the future i plan to add there more things to buy obviously). By globally i mean theres a specific amount of boosts and it can stock out. The shop refreshes every 2 hours.

@everyone`
    },
    {
        version: "1.2.2",
        description: `## [Small Changes]

### • Quest System

Added a new command "!quests". Now you can do Daily Quests and Weekly Quests, each giving big rewards.

*(needed to rewrite every command to make this work :sob:)*

### • QOL

Buffed @☘️ Luck Boost III and @🍀 Luck Boost MAX.

Added a cooldown on the roll text message to let you know when to roll again.

Made @🍀 Luck Boost MAX cost 999,999 XP instead of 1,999,999 XP on the shop.

*tommorow i plan to add !trade and !donate commands...*`
    },
    {
        version: "1.3",
        description: `## [Small Changes #2]

### • Trading System

Added trades where you can trade XP & Boosts for now. [!trade @user]

*A quick reminder, if at any point you get scammed or a bug happens, create a ticket in #support*

### • Boost Values

*each boost has its own trading value, these values can change in the future*

**XP Boosts:**

@XP Boost I == has a estimated value of \`2,000-15,000 XP\`

@XP Boost II == has a estimated value of \`15,000-25,000 XP\` :chart_with_downwards_trend: (changed from 15,000-50,000 to 15,000-25,000 XP)

<@&1526995123420922047> == has a estimated value of \`25,000-50,000 XP\`:chart_with_downwards_trend: (changed from 50,000-100,000 to 25,000-50,000 XP)

@XP Boost MAX == has a estimated value of \`50,000-75,000 XP\`:chart_with_downwards_trend: (changed from 100,000-500,000 to 50,000-75,000 XP)

**Luck Boosts:**

@🌿 Luck Boost I == has a estimated value of \`15,000-50,000 XP\`

@🍃 Luck Boost II == has a estimated value of \`50,000-150,000 XP\`

@☘️ Luck Boost III == has a estimated value of \`1,000,000-3,500,000 XP\`

@🍀 Luck Boost MAX == has a estimated value of \`3,500,000-10,000,000 XP\`

### • QOL / Patches

Nerfed the timer on @☘️ Luck Boost III to 20 minutes.

Luck Boosts now count to the critical system, can go up to 85% chance on getting a critical with the @🍀 Luck Boost MAX.

Buffed the prices for every boost in the shop. Shop now restocks with random estimated prices. (Making it fair for trading)`
    },
    {
        version: "1.3.1",
        description: `## [Small Changes #3]

### • @👁️‍🗨️ Luck Boost Ω

Added a new secret Luck Boost that gives a \`????\` multiplier.

You cannot buy this luck boost, you can get it through commands but its rare.

*created this because of fairness to the upcoming higher & harder levels [like levels 200+]*

Boost Value:

@👁️‍🗨️ Luck Boost Ω == has a estimated value of \`?????????\`

*user who trades off this luck boost for the first time sets the estimated value for the boost)*

### • QOL / Patches

Buffed every command [hug, kiss, ezwin ect.].

Luck boost's luck affects every command now.

!kiss now gives both users XP.

Buffed ezwin's cooldown up to 24 hours.`
    },
    {
        version: "1.8.2",
        description: `@everyone

## [Big Update]

### • Enhanced Critical System
Reaching 20+ consecutive criticals gives 5x more xp & +3 percentage chance on getting a critical.

Rewrited the entire critical system, making it more compatible with quests.

### • Quests
Buffed daily/weekly quest rewards for users above level 150.

There's a small chance on getting @👁️‍🗨️ Luck Boost Ω on weekly quest rewards.

Added new quest rewards for level 150+.

*[check your quests by doing !quests]*

### • Rolling
Every 100th roll will be a guaranteed 500,000+ XP (or even more).

Theres now a small chance on rolling 10,000,000-50,000,000 XP for levels 150+.

### • New Leaderboards
There are now 3 types of leaderboards: "OVERALL leaderboard", "Monthly leaderboard", "Weekly leaderboard".

Be ready for future events about this.

*[check your leaderboard by doing !leaderboard or !rank]*

### • Travelling Merchant
When the shop restocks, theres a 15% chance of a travelling merchant happening.

They have multiple really good deals/trades.

Travelling merchant has a 30 minute cooldown before going away.

You can even get 3 rolls per 1 roll or 2x more xp by chatting PERMANENTLY.

*[check the shop to see if the travelling merchant arrived by doing !shop]*

### • QOL / Patches
Buffed Luck Boosts for levels 150+ (only for rolling).

Typing !leaderboard is the same as typing !rank.

Buffed !hug.

Buffed !kiss timer to 20 minutes instead of 15 minutes.

You can now reset daily/weekly quests & rewards by spending a specific amount of XP.

Buffed @👁️‍🗨️ Luck Boost Ω timer to 5 minutes instead of 3 minutes.`
    },
    {
        version: "1.8.3",
        description: `## [Patches #1]

*Nerfed daily/weekly quests rewards.*

*You can't no longer reset quests when they're completed.*

*Nerfed daily & weekly quests resets to \`1\`.*

*Nerfed @🍀 Luck Boost MAX chances from \`0.75%\` to \`0.5%\`. (in rolling)*

*Nerfed @☘️ Luck Boost III chances from \`2%\` to \`1%\`. (in rolling)*

*Nerfed @👁️‍🗨️ Luck Boost Ω timer from \`5 minutes\` to \`3 minutes\`*

*Nerfed all luck boosts chances in every command.*

*Nerfed @👁️‍🗨️ Luck Boost Ω chances from appearing in the weekly rewards, changed from \`15%\` to \`5%\`.*

*Buffed the travelling's merchant arrival chances from \`15%\` to \`30%\`.*

*Buffed the travelling's merchant timer from \`30 minutes\` to \`1 hour\`.*

*Buffed the quests in daily/weekly for all levels.*

*Buffed the daily/weekly quests reset, it now costs \`25,000,000 XP\` (for daily) and \`100,000,000 XP\` (for weekly).*

*Added a new quest about chatting to make it more alive.*

*Added a x/100 counter in rolling to visibly show when the 100th guaranteed roll of 500,000+ XP is happening.*`
    },
    {
        version: "1.8.4",
        description: `## [QOL / Patches #2]

*Fixed & Remaked the roll's cooldown, so the cooldown doesnt have a delay anymore.*

*Made the gui in travelling merchant better & generally appear more simple.*

*Made roll's messages have less delay than before.*

*Fixed that nobody can arrange/remove the @banned role except using the mod commands AND except me*

*Fully remaked the xp boosts.*

*@🧿 XP Boost ထ is a new xp boost thats rarer & better than @XP Boost MAX (smthing like @👁️‍🗨️ Luck Boost Ω).*

*Deleted XP Boost III because there never was a big difference in XP boost II and XP boost III (plus i didnt want to buff the xp boosts too much).*

*Buffed all xp boosts for all levels.*

*Buffed chatting*

*Buffed the prices in !shop for all xp boosts.*

*After reaching 50 or more consecutive criticals, it will multiply your 49 consecutive criticals by 20x*

*@👁️‍🗨️ Luck Boost Ω with @XP Boost MAX have a higher capped critical chance at \`98%\`, @👁️‍🗨️ Luck Boost Ω with @🧿 XP Boost ထ have a even higher capped critical chance at \`99%\`*

*Every XP Boost now has a 60 minute cooldown until it runs out*

*Added new deals to the travelling merchant.*

*Removed tier progress, instead of that, you now obtain XP boosts by chatting or through commands.*

*Added a new command "!mute" where you can mute the bot's replies for YOUR criticals and xp boosts replies.*

*Made !boost look better and more simple.*

*XP Boosts now have their own multiplier making it easier for the system.*

*Added another new command "!values" where it shows the exact base trading values of the boosts (trading a specific boost can nerf/buff the base-value obviously).*

*Nerfed weekly rewards significantly for levels 100+ & 150+*`
    },
    {
        version: "1.9",
        description: `## [Important Change]

### • [Upgrades]
Added a new command "!upgrades" where you can basically upgrade chatting, rolling, luck boosts, ect. by paying XP & even boosts.

This replaces the big downside of the bot and that was "inflation".
Every upgrade has a specific amount of upgrades you can do so no you can't upgrade forever.

### • [Sell]
Added another new command "!sell" where you can sell boosts for 50% of the boosts XP trading value.

*[I do not recommend selling rare boosts instead of selling it, i personally would trade it for a profitable exchange.]*

### • [QOL / Patches #3]

*Removed any kind of buffs on certain levels. (you buff it with !upgrades now)*

*Weekly quests are no longer level locked.*

*In trading you no longer cannot give XP for free.*

*Buffed the max xp trading cap for levels 50-99, instead of \`50,000 XP\`, you're now able to trade a lvl 50+ user \`100,000 XP\`.*

*In trading there now needs to be a minimum of \`1,000 XP\` offered in the trade.*

*Buffed/Fixed \`!kiss bot\`.*

*From now on quest resets unlock at quest upgrade 2.*`
    },
    {
        version: "2.0.0",
        description: `# Update 2.0.0

*Update logs coming soon...*`
    }
]);


function buildUpdateButtons(
    selectedIndex,
    disabled = false
){

    const rows = [];


    for(
        let rowStart = 0;
        rowStart < UPDATE_PAGES.length;
        rowStart += 5
    ){

        const row =
            new ActionRowBuilder();


        const buttons =
            UPDATE_PAGES
                .slice(
                    rowStart,
                    rowStart + 5
                )
                .map((page, offset) => {

                    const pageIndex =
                        rowStart + offset;


                    return new ButtonBuilder()
                        .setCustomId(
                            `updates:${pageIndex}`
                        )
                        .setLabel(
                            `Update ${page.version}`
                        )
                        .setStyle(
                            pageIndex === selectedIndex
                                ? ButtonStyle.Primary
                                : ButtonStyle.Secondary
                        )
                        .setDisabled(
                            disabled
                            || pageIndex === selectedIndex
                        );

                });


        row.addComponents(
            ...buttons
        );


        rows.push(row);

    }


    return rows;

}


function buildUpdatesPanel(
    selectedIndex = 0,
    disabled = false
){

    const safeIndex =
        Number.isInteger(selectedIndex)
        && selectedIndex >= 0
        && selectedIndex < UPDATE_PAGES.length
            ? selectedIndex
            : 0;


    const page =
        UPDATE_PAGES[safeIndex];


    const footerText =
        `Update ${page.version} • Page ${safeIndex + 1}/${UPDATE_PAGES.length}`
        + (
            disabled
                ? " • Buttons expired — run !updates again"
                : ""
        );


    const embed =
        new EmbedBuilder()
            .setColor(0xB56BFF)
            .setTitle("📜 Mizuki Update History")
            .setDescription(
                page.description
            )
            .setFooter({
                text: footerText
            });


    return {
        embeds: [embed],
        components:
            buildUpdateButtons(
                safeIndex,
                disabled
            ),
        allowedMentions: {
            parse: []
        }
    };

}


async function execute(message){

    if(!message.guild){
        return;
    }


    let selectedIndex = 0;


    const panel =
        await message.reply(
            buildUpdatesPanel(
                selectedIndex
            )
        );


    const collector =
        panel.createMessageComponentCollector({
            componentType:
                ComponentType.Button,
            time:
                UPDATE_PANEL_DURATION_MS
        });


    collector.on(
        "collect",
        async interaction => {

            try{

                if(
                    interaction.user.id
                    !== message.author.id
                ){

                    await interaction.reply({
                        content:
                            "These update buttons belong to someone else's panel. Run `!updates` to open yours.",
                        flags:
                            MessageFlags.Ephemeral
                    }).catch(() => {});

                    return;

                }


                const match =
                    /^updates:(\d+)$/.exec(
                        interaction.customId
                    );


                if(!match){
                    return;
                }


                const requestedIndex =
                    Number(match[1]);


                if(
                    !Number.isInteger(
                        requestedIndex
                    )
                    || requestedIndex < 0
                    || requestedIndex >=
                        UPDATE_PAGES.length
                ){
                    return;
                }


                selectedIndex =
                    requestedIndex;


                await interaction.update(
                    buildUpdatesPanel(
                        selectedIndex
                    )
                );

            }
            catch(error){

                console.error(
                    "Updates interaction failed:",
                    error
                );


                const errorReply = {
                    content:
                        "I couldn't switch update pages right now. Please press the button again or rerun `!updates`.",
                    flags:
                        MessageFlags.Ephemeral
                };


                if(
                    interaction.replied
                    || interaction.deferred
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

        }
    );


    collector.once(
        "end",
        async() => {

            await panel.edit(
                buildUpdatesPanel(
                    selectedIndex,
                    true
                )
            ).catch(() => {});

        }
    );


    return panel;

}


module.exports = {
    execute,
    buildUpdateButtons,
    buildUpdatesPanel,
    UPDATE_PAGES,
    UPDATE_PANEL_DURATION_MS
};
