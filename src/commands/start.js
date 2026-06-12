const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");

const commandName = "start";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
    if (ctx.chatId !== ctx.from.id)
        return;

    return (await ctx.reply(`<b>
السَّلَامُ عَلَيكُم وَرَحمَةُ اللهِ وبَرَكَاتُه
ChillBot here 😌🤖!
مساعد لطلبة الإعلام الآلي (مختص في جامعة سعد دحلب البليدة)
هذه الأوامر المتوفرة في الوقت الحالي (مابين [..] اختياري):</b>
<code>/edt [&lt;L1/L1A/L1B/L2&gt;]</code> لعرض جدول التوقيت الحالي
<code>/drive</code> للبحث في درايف الدفعة من ملفات وصور أو المساهمة فيه
        `, {parse_mode: "HTML"})).message_id;
}

// <code>/contribute</code> لمشاركة مصادر خارجية أو حلول أو محاضرات على شكل صور

module.exports = { commandName, command };
