// Resolve custom guild emoji IDs into renderable Discord markup. The caller
// supplies the guild so the same tier works in reactions, replies and logs.
function getCriticalEmojis(guild, streak){
    const count = Math.max(0, Math.floor(Number(streak) || 0));
    const criticalExplosion =
        guild?.emojis?.cache?.find?.(
            entry => entry.name === "critical_explosion"
        );

    const reaction =
        criticalExplosion?.id || "💥";

    if(count < 1){
        return {
            text: "",
            reaction,
            reactions: []
        };
    }

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
        // A critical message always gets exactly this one reaction. The
        // streak-tier emojis above are display-only for the announcement.
        reaction,
        reactions: [reaction]
    };
}

module.exports = {getCriticalEmojis};
