// Resolve custom guild emoji IDs into renderable Discord markup. The caller
// supplies the guild so the same tier works in reactions, replies and logs.
function getCriticalEmojis(guild, streak){
    const count = Math.max(0, Math.floor(Number(streak) || 0));
    if(count < 1) return {text: "", reactions: []};

    let symbols;
    if(count >= 50){
        symbols = [
            ["big_critical_explosion", "💥"],
            ["big_critical_pheonix", "🐦‍🔥"]
        ];
    }
    else if(count >= 20){
        symbols = [[null, "🧊"], [null, "🥶"]];
    }
    else if(count >= 5){
        symbols = [
            ["critical_explosion", "💥"],
            ["critical_pheonix", "🐦‍🔥"]
        ];
    }
    else{
        symbols = [["critical_explosion", "💥"]];
    }

    const resolved = symbols.map(([name, fallback]) => {
        const emoji = name && guild?.emojis?.cache?.find?.(
            entry => entry.name === name
        );
        return {
            text: emoji?.toString?.() || fallback,
            reaction: emoji?.id || fallback
        };
    });

    return {
        text: resolved.map(emoji => emoji.text).join(" "),
        reactions: resolved.map(emoji => emoji.reaction)
    };
}

module.exports = {getCriticalEmojis};
