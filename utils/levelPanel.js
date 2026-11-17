'use strict';
const DEFAULTS = {
    hideXP: false,
    hideLevel: false,
    hideRank: false,
    hideRole: false,
    hideStreak: false,
    color: '#7A5CFF',
    bar: 'blocks',
    nickname: ''
};

// Cool progress bar variants. golden uses the custom server emojis.
// Text-style bars use Unicode blocks for a polished look.
const STYLES = {
    blocks:   ['🟪', '⬛'],
    mint:     ['🟩', '⬛'],
    ice:      ['🟦', '⬛'],
    hearts:   ['💜', '🖤'],
    classic:  ['▰', '▱'],
    dots:     ['●', '○'],
    golden:   [':golden_square:', ':empty_golden_square:'],
    fire:     ['🟧', '⬛'],
    pink:     ['🩷', '⬛'],
    solid:    ['█', '░'],
    shade:    ['▓', '░'],
    bars:     ['▮', '▯'],
    diamonds: ['◆', '◇'],
    stars:    ['★', '☆'],
    // Fancy multi-char styles (rendered as full string patterns)
    gradient: null, // special handled in bar()
    wave:     null
};

function settings(value = {}) {
    const s = { ...DEFAULTS };
    for (const key of ['hideXP', 'hideLevel', 'hideRank', 'hideRole', 'hideStreak']) {
        s[key] = value[key] === true;
    }
    if (/^#[0-9a-f]{6}$/i.test(value.color || '')) s.color = value.color;
    if (STYLES[value.bar] !== undefined || value.bar === 'gradient' || value.bar === 'wave') {
        s.bar = value.bar;
    }
    s.nickname = String(value.nickname || '')
        .replace(/[\r\n\t\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
        .trim()
        .slice(0, 32);
    return s;
}

function bar(percent, style) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const count = Math.round(p / 10); // 0-10 filled segments

    if (style === 'gradient') {
        // ░░░▒▒▒▓▓▓▓ # pattern inspired
        const filled = '▓'.repeat(count);
        const empty = '░'.repeat(10 - count);
        return filled + empty + ` ${p}%`;
    }

    if (style === 'wave') {
        // Alternate wave look
        const segs = [];
        for (let i = 0; i < 10; i++) {
            segs.push(i < count ? '▰' : '▱');
        }
        return segs.join('') + ` ${p}%`;
    }

    const pair = STYLES[style] || STYLES.blocks;
    if (!pair) return STYLES.blocks[0].repeat(count) + STYLES.blocks[1].repeat(10 - count);

    const [full, empty] = pair;
    return full.repeat(count) + empty.repeat(10 - count);
}

module.exports = { DEFAULTS, STYLES, settings, bar };
