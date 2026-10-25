const running = new Map();
function begin(channelID){ running.set(channelID, (running.get(channelID) || 0) + 1); }
function end(channelID){ const count = (running.get(channelID) || 1) - 1; if(count) running.set(channelID,count); else running.delete(channelID); }
function deleteWhenIdle(channel, reason, delay = 30000){
    const check = () => {
        if(running.has(channel.id)){
            const timer = setTimeout(check, 5000); timer.unref?.(); return;
        }
        channel.delete(reason).catch(() => null);
    };
    const timer = setTimeout(check, delay); timer.unref?.();
}
module.exports = {begin,end,deleteWhenIdle};
