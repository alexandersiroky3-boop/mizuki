const database = require("../database");
const bosses = require("../systems/bosses");
const bossCommand = require("./boss");
const {isBotAdmin} = require("../utils/adminAccess");
const {RARITY_BANDS} = require("../utils/adminRolls");

const BOOST_CHOICES = [
    ["Luck I", "luck:tier1"], ["Luck II", "luck:tier2"], ["Luck III", "luck:tier3"],
    ["Luck MAX", "luck:max"], ["Luck Omega", "luck:omega"],
    ["XP I", "xp:tier1"], ["XP II", "xp:tier2"], ["XP MAX", "xp:max"], ["XP Infinity", "xp:infinity"],
    ["Power Rune I", "rune:tier1"], ["Power Rune II", "rune:tier2"], ["Power Rune III", "rune:tier3"],
    ["Bronze Chest", "chest:bronze"], ["Gilded Chest", "chest:gilded"], ["Boss Chest", "chest:boss"]
];
const COMMANDS = {fight: {unlockFight: true}, bless: {unlockBless: true}, coinflip: {unlockCoinflip: true}, spawnboss: {spawnBossUses: 1}};
const COOLDOWN_COMMANDS = ["all", "roll", "hug", "kiss", "steal", "ezwin", "troll", "fight", "trade", "bless", "coinflip", "spawnboss"];
const userOption = {type: 6, name: "user", description: "Target server member", required: true};
const choiceOption = (name, description, choices) => ({type: 3, name, description, required: true, choices: choices.map(([name,value])=>({name,value}))});
const slashCommands = [
    {name: "givecommand", description: "Owner/test account: grant an obtainable command", options: [userOption, choiceOption("command", "Command to grant", Object.keys(COMMANDS).map(k=>["!"+k,k]))]},
    {name: "giveboost", description: "Owner/test account: grant inventory items", options: [userOption, choiceOption("boost", "Boost or item type", BOOST_CHOICES), {type: 4, name: "amount", description: "Number of items", required: true, min_value: 1, max_value: 1000000}]},
    {name: "removeeffects", description: "Owner/test account: remove effects or command cooldowns", options: [
        choiceOption("effect", "Effect to remove", [["Blessing", "bless"], ["Current raid boss (no rewards)", "raidboss"], ["Command cooldowns", "cooldowns"]]),
        {...userOption, required: false, description: "Cooldown target (defaults to you; cooldowns option only)"},
        {...choiceOption("command", "Cooldown to reset (defaults to all; cooldowns option only)", COOLDOWN_COMMANDS.map(k=>[k === "all" ? "All commands" : "!"+k,k])), required: false}
    ]},
    {name: "guaranteeroll", description: "Owner/test account: set one next-roll rarity", options: [userOption, choiceOption("rarity", "Exact rarity for one roll", Object.keys(RARITY_BANDS).map(k=>[k,k]))]}
].map(command => ({...command, dm_permission: false}));

async function executeInteraction(interaction){
    if(!isBotAdmin(interaction.user.id)) return interaction.reply({content: "❌ Only the two authorized bot accounts can use this command.", flags: 64});
    if(!interaction.guild) return interaction.reply({content: "Use this command in the server.", flags: 64});
    await interaction.deferReply({flags: 64});
    const guildID = interaction.guild.id;
    const target = interaction.options.getUser("user");
    if(target){
        const member = await interaction.guild.members.fetch(target.id).catch(()=>null);
        if(!member || target.bot) return interaction.editReply("Choose a human member of this server.");
    }
    let content;
    if(interaction.commandName === "givecommand"){
        const key = interaction.options.getString("command", true);
        if(!Object.hasOwn(COMMANDS,key)) throw new Error("Invalid command");
        await database.grantBossRewardBundle(guildID,target.id,COMMANDS[key]);
        content = `Granted !${key} to <@${target.id}>.${key === "spawnboss" ? " Maximum one use held; existing cooldown is unchanged." : " This is a permanent unlock."}`;
    }else if(interaction.commandName === "giveboost"){
        const value = interaction.options.getString("boost", true), amount = interaction.options.getInteger("amount", true);
        if(!BOOST_CHOICES.some(([,v])=>v===value) || !Number.isSafeInteger(amount) || amount<1 || amount>1000000) throw new Error("Invalid boost or amount");
        const [type,tier] = value.split(":");
        await database.adminGiveBoost(guildID,target.id,type,tier,amount);
        content = `Added ${amount.toLocaleString()} × ${BOOST_CHOICES.find(([,v])=>v===value)[0]} to <@${target.id}>'s inventory.`;
    }else if(interaction.commandName === "guaranteeroll"){
        const rarity = interaction.options.getString("rarity", true);
        await database.setAdminRollGuarantee(guildID,target.id,rarity);
        content = `<@${target.id}>'s next individual roll will be ${rarity.toUpperCase()}. This replaces any previous admin guarantee; it does not stack.`;
    }else if(interaction.commandName === "removeeffects"){
        const effect = interaction.options.getString("effect", true);
        if(effect !== "cooldowns" && (target || interaction.options.getString("command"))){
            return interaction.editReply("The user and command options apply only to Command cooldowns.");
        }
        if(effect === "bless"){
            await database.clearGuildBlessing(guildID);
            content = "Removed the server's active blessing. Personal !bless cooldowns are unchanged.";
        }else if(effect === "raidboss"){
            const removed = await bosses.removeActiveRaidBoss(guildID);
            content = removed ? "Removed the active raid boss without defeat rewards. Natural spawn cooldown is unchanged." : "No raid boss is active.";
            try{await bossCommand.ensureRaidStatusMessage(interaction.client,guildID,{guild:interaction.guild,boss:null});}
            catch(error){console.error("Admin raid panel refresh failed:",error);content += " The live panel could not refresh; use !boss to refresh it.";}
        }else if(effect === "cooldowns"){
            const command = interaction.options.getString("command") || "all";
            if(!COOLDOWN_COMMANDS.includes(command)) throw new Error("Invalid cooldown command");
            const targetID = target?.id || interaction.user.id;
            await database.adminClearCommandCooldowns(guildID, targetID, command);
            content = `Reset ${command === "all" ? "all command cooldowns" : "the !" + command + " cooldown"} for <@${targetID}>. This is a one-time reset, not permanent cooldown removal. Active command runs remain protected and may start a new cooldown when they finish. Unlocks, item uses, active effects and the natural raid-spawn timer are unchanged.`;
        }else throw new Error("Invalid effect");
    }else throw new Error("Unknown admin command");
    return interaction.editReply({content,allowedMentions:{parse:[]}});
}
module.exports = {slashCommands, executeInteraction};
