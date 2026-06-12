// i18n.js
const en = require("../../locales/en.json");

/**
 * @param {keyof typeof en} key - Translation key
 * @param {Record<string,string>} [vars] - Variables to replace
 */
function t(key, vars = {}) {
  let str = en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

module.exports = { t };
