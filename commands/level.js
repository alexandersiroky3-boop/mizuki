'use strict';
const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
const db=require('../database');
const xp=require('../utils/xp');
const roles=require('../systems/levelRoles');
const features=require('../systems/playerFeatures');
const panel=require('../utils/levelPanel');
const fields={hideXP:'Total XP',hideLevel:'Level',hideRank:'All-time rank',hideRole:'Level role',hideStreak:'Best critical streak'};
function button(id,label,style=ButtonStyle.Secondary){return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);}
async function render(guild,member){
    const user=member.user, data=await db.getUser(guild.id,user.id);
    const s=panel.settings((await features.get(guild.id,user.id)).levelPanel);
    const total=Number(data.xp)||0,level=xp.getLevel(total);
    if(level!==Number(data.level))await db.setLevel(guild.id,user.id,level);
    const role=await roles.syncMemberLevelRole(member,level);
    const needed=xp.getNextLevelXP(level)-xp.getLevelXP(level),progress=Math.max(0,total-xp.getLevelXP(level));
    const percentage=needed>0?Math.max(0,Math.min(100,Math.floor(progress/needed*100))):100;
    const embed=new EmbedBuilder().setColor(s.color).setAuthor({name:s.nickname||member.displayName||user.username,iconURL:user.displayAvatarURL()})
        .setThumbnail(user.displayAvatarURL({size:256})).setDescription([
            s.hideLevel?'### Your journey':`### Level ${level.toLocaleString()}`,
            panel.bar(percentage,s.bar),
            s.hideXP||s.hideLevel?`${percentage}% to the next level`:`**${progress.toLocaleString()} / ${needed.toLocaleString()} XP** · ${percentage}%`
        ].join('\n')).setFooter({text:'GothMommy • Level profile'});
    const values=[];
    if(!s.hideXP)values.push({name:'Total XP',value:total.toLocaleString(),inline:true});
    if(!s.hideRank)values.push({name:'All-time rank',value:`#${await db.getUserLeaderboardRank(guild.id,user.id)}`,inline:true});
    if(!s.hideStreak)values.push({name:'Best streak',value:`${Number(data.bestcriticalstreak)||0} criticals`,inline:true});
    if(!s.hideRole)values.push({name:'Level role',value:role?.role?.roleID?`<@&${role.role.roleID}>`:'None',inline:true});
    values.push({name:'XP messages',value:Number(data.messages||0).toLocaleString(),inline:true});
    embed.addFields(values);
    return {embeds:[embed],components:[new ActionRowBuilder().addComponents(button(`level_customize:${user.id}`,'Customize'))],allowedMentions:{parse:[]}};
}
function editor(owner,s){
    return {content:'Choose what appears on your !level panel. These settings do not hide your public leaderboard entry. Empty nickname restores your Discord name.',
        embeds:[],components:[
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`level_visibility:${owner}`).setPlaceholder('Select fields to hide').setMinValues(0).setMaxValues(5).addOptions(Object.entries(fields).map(([value,label])=>({label,value,default:s[value]})))),
            new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`level_bar:${owner}`).setPlaceholder('Progress bar style').addOptions(Object.keys(panel.STYLES).map(value=>({label:value[0].toUpperCase()+value.slice(1),value,default:s.bar===value})))),
            new ActionRowBuilder().addComponents(button(`level_appearance:${owner}`,'Nickname & color'),button(`level_preview:${owner}`,'Preview',ButtonStyle.Primary),button(`level_reset:${owner}`,'Reset'))
        ],allowedMentions:{parse:[]}};
}
async function execute(message){await message.reply(await render(message.guild,message.member));}
async function handleInteraction(i){
    if(!/^level_(customize|visibility|bar|appearance|save|preview|reset):/.test(i.customId||''))return false;
    const [action,owner]=i.customId.split(':');
    if(i.user.id!==owner){await i.reply({content:'Only the profile owner can customize this panel.',flags:64});return true;}
    if(action==='level_appearance'){
        const s=panel.settings((await features.get(i.guildId,owner)).levelPanel);
        const modal=new ModalBuilder().setCustomId(`level_save:${owner}`).setTitle('Profile appearance').addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nickname').setLabel('Custom nickname (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(32).setValue(s.nickname)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color: #RRGGBB').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(s.color)));
        await i.showModal(modal);return true;
    }
    await i.deferReply({flags:64});
    let s=panel.settings((await features.get(i.guildId,owner)).levelPanel);
    if(action==='level_visibility')for(const key of Object.keys(fields))s[key]=i.values.includes(key);
    if(action==='level_bar')s.bar=i.values[0];
    if(action==='level_reset')s=panel.settings();
    if(action==='level_save'){
        const color=i.fields.getTextInputValue('color').trim();
        if(!/^#[0-9a-f]{6}$/i.test(color)){await i.editReply('Use a six-digit hex color, such as #7A5CFF. Nothing was changed.');return true;}
        s.color=color;s.nickname=i.fields.getTextInputValue('nickname');
    }
    s=panel.settings(s);
    if(!['level_customize','level_preview'].includes(action))await features.merge(i.guildId,owner,{levelPanel:s});
    if(action==='level_preview')await i.editReply(await render(i.guild,await i.guild.members.fetch(owner)));
    else await i.editReply(editor(owner,s));
    return true;
}
module.exports={execute,handleInteraction,render};
