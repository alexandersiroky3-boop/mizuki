const ADMIN_IDS = new Set(["1239975819112353969", "1456746123070017583"]);
const isBotAdmin = userID => ADMIN_IDS.has(String(userID));
module.exports = {isBotAdmin};
