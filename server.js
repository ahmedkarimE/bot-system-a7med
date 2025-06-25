// ✅ server.js - باستخدام quick.db بدلاً من pro.db
const fs = require("fs");
const { Client, IntentsBitField, EmbedBuilder, PermissionsBitField } = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const config = require("./config.json");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers
  ]
});

let cmdChannels = {
  suggestions: null,
  tax: null,
  daily: null,
  ticketsCategory: null
};

client.once("ready", () => {
  console.log("✅ BOT ready!");
});

const spamLogs = {};

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const { guild } = msg;

  const prefix = config.prefix;
  if (msg.content.startsWith(prefix)) {
    const [cmd, ...args] = msg.content.slice(prefix.length).trim().split(/\s+/);
    const isAdmin = msg.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    if (cmd === "dev") return msg.channel.send("by nxahmed");

    if (cmd === "ربط-اقتراحات" && isAdmin && msg.mentions.channels.first()) {
      cmdChannels.suggestions = msg.mentions.channels.first().id;
      return msg.reply("🔗 تم ربط روم الاقتراحات!");
    }
    if (cmd === "ربط-ضريبة" && isAdmin && msg.mentions.channels.first()) {
      cmdChannels.tax = msg.mentions.channels.first().id;
      return msg.reply("🔗 تم ربط روم الضريبة!");
    }
    if (cmd === "ربط-استلام" && isAdmin && msg.mentions.channels.first()) {
      cmdChannels.daily = msg.mentions.channels.first().id;
      return msg.reply("🔗 تم ربط روم الاستلام!");
    }
    if (cmd === "ربط-تذاكر" && isAdmin && args[0]) {
      const cat = guild.channels.cache.get(args[0]) ||
        guild.channels.cache.find(c => c.name === args[0] && c.type === 4); // GUILD_CATEGORY = 4
      if (!cat) return msg.reply("❌ لم يتم العثور على الكاتيجوري!");
      cmdChannels.ticketsCategory = cat.id;
      return msg.reply("🔗 تم ربط كاتيجوري التذاكر!");
    }

    if (cmd === "نقاط") {
      const user = msg.mentions.users.first();
      const id = args[0] && user ? user.id : msg.author.id;
      const pts = await db.get(`points.${id}`) || 0;
      return msg.reply(`📊 نقاطه: ${pts}`);
    }

    if (cmd === "اضف" && isAdmin) {
      const user = msg.mentions.users.first();
      const amt = parseInt(args[1]);
      if (user && !isNaN(amt)) {
        const current = await db.get(`points.${user.id}`) || 0;
        await db.set(`points.${user.id}`, current + amt);
        return msg.reply(`✅ تم إضافة ${amt} نقاط.`);
      }
    }

    if (cmd === "خصم" && isAdmin) {
      const user = msg.mentions.users.first();
      const amt = parseInt(args[1]);
      if (user && !isNaN(amt)) {
        const current = await db.get(`points.${user.id}`) || 0;
        await db.set(`points.${user.id}`, Math.max(0, current - amt));
        return msg.reply(`✅ تم خصم ${amt} نقاط.`);
      }
    }

    if (cmd === "تصفير" && isAdmin && msg.mentions.users.first()) {
      await db.set(`points.${msg.mentions.users.first().id}`, 0);
      return msg.reply("✅ تم تصفير النقاط.");
    }
    return;
  }

  if (msg.channel.id === cmdChannels.suggestions) {
    const embed = new EmbedBuilder()
      .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
      .setDescription(msg.content)
      .setColor("Blue");
    msg.channel.send({ embeds: [embed] }).then(m => {
      m.react("✅");
      m.react("❌");
    });
    return msg.delete();
  }

  if (msg.channel.id === cmdChannels.tax) {
    const num = parseFloat(msg.content);
    if (!isNaN(num)) {
      const tax = Math.floor(num * 0.05);
      const total = Math.floor(num + tax);
      return msg.reply(`💸 المبلغ بعد الضريبة: ${total} (الضريبة: ${tax})`);
    }
  }

  if (msg.channel.id === cmdChannels.daily) {
    const key = `${msg.author.id}_daily`;
    const last = await db.get(key) || 0;
    const now = Date.now();
    if (now - last < 86400000) return msg.reply("⏳ جرب بكرة!");
    await db.set(key, now);
    const pts = (await db.get(`points.${msg.author.id}`) || 0) + 1;
    await db.set(`points.${msg.author.id}`, pts);

    const userSpam = spamLogs[msg.author.id] || [];
    spamLogs[msg.author.id] = userSpam.filter(t => now - t < (config.spamDurationMin || 3) * 60000);
    spamLogs[msg.author.id].push(now);

    if (spamLogs[msg.author.id].length > (config.spamLimit || 3)) {
      msg.member.timeout((config.timeoutDurationMin || 10) * 60 * 1000, "Spam points");
      return msg.reply("⛔ تم إعطاؤك تايم آوت بسبب سبام النقاط.");
    }

    return msg.reply("✅ تم إعطاؤك نقطة!");
  }

  const isTicket = msg.channel.parentId === cmdChannels.ticketsCategory;
  if (isTicket && msg.content.toLowerCase() === "استلام") {
    const overwrites = msg.channel.permissionOverwrites.cache.filter(o => o.type === 1); // member = 1
    const ownerId = overwrites.find(o => o.id !== msg.guild.roles.everyone.id)?.id;
    if (!ownerId) return;

    const pts = (await db.get(`points.${ownerId}`) || 0) + 5;
    await db.set(`points.${ownerId}`, pts);

    await msg.channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });

    return msg.reply("✅ تم استلام التذكرة واحتساب النقاط.");
  }
});

client.on("guildMemberUpdate", async (oldM, newM) => {
  const nameHasTag = newM.user.username.includes(config.requiredTag || "• 𝐏𝐋 ┃");
  const memberRoles = newM.roles.cache.sort((a, b) => b.position - a.position);
  const bypassRoles = memberRoles.first(config.rolesExceptionCount || 14).map(r => r.id);
  const hasBypass = newM.roles.cache.some(r => bypassRoles.includes(r.id));
  const hold = newM.guild.roles.cache.find(r => r.name === config.holdRole || "Member");
  if (!nameHasTag && !hasBypass && hold) newM.roles.remove(hold);
});

client.login(config.token);
