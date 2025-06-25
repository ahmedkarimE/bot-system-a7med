const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require("discord.js");
const db = require("quick.db");
const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

let cmdChannels = db.get("cmdChannels") || {
  suggestions: null,
  tax: null,
  daily: null,
  ticketsCategory: null
};

const spamLogs = {};

client.once("ready", () => {
  console.log("✅ BOT ready!");
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  const { guild } = msg;
  const isAdmin = msg.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

  // أوامر
  if (msg.content.startsWith(config.prefix)) {
    const [cmd, ...args] = msg.content.slice(config.prefix.length).trim().split(/\s+/);

    if (cmd === "dev") return msg.channel.send("by nxahmed");

    if (cmd === "ربط-اقتراحات" && isAdmin && msg.mentions.channels.first()) {
      cmdChannels.suggestions = msg.mentions.channels.first().id;
      db.set("cmdChannels", cmdChannels);
      return msg.reply("✅ تم ربط روم الاقتراحات!");
    }

    if (cmd === "ربط-ضريبة" && isAdmin && msg.mentions.channels.first()) {
      cmdChannels.tax = msg.mentions.channels.first().id;
      db.set("cmdChannels", cmdChannels);
      return msg.reply("✅ تم ربط روم الضريبة!");
    }

    if (cmd === "ربط-استلام" && isAdmin && msg.mentions.channels.first()) {
      cmdChannels.daily = msg.mentions.channels.first().id;
      db.set("cmdChannels", cmdChannels);
      return msg.reply("✅ تم ربط روم الاستلام!");
    }

    if (cmd === "ربط-تذاكر" && isAdmin && args[0]) {
      const cat = guild.channels.cache.get(args[0]) ||
        guild.channels.cache.find(c => c.name === args[0] && c.type === 4); // 4 = category
      if (!cat) return msg.reply("❌ لم يتم العثور على الكاتيجوري!");
      cmdChannels.ticketsCategory = cat.id;
      db.set("cmdChannels", cmdChannels);
      return msg.reply("✅ تم ربط كاتيجوري التذاكر!");
    }

    if (cmd === "نقاط") {
      const user = msg.mentions.users.first();
      const id = user ? user.id : msg.author.id;
      const pts = db.get(`points.${id}`) || 0;
      return msg.reply(`📊 نقاطه: ${pts}`);
    }

    if (cmd === "اضف" && isAdmin) {
      const user = msg.mentions.users.first();
      const amt = parseInt(args[1]);
      if (user && !isNaN(amt)) {
        const current = db.get(`points.${user.id}`) || 0;
        db.set(`points.${user.id}`, current + amt);
        return msg.reply(`✅ تم إضافة ${amt} نقاط.`);
      }
    }

    if (cmd === "خصم" && isAdmin) {
      const user = msg.mentions.users.first();
      const amt = parseInt(args[1]);
      if (user && !isNaN(amt)) {
        const current = db.get(`points.${user.id}`) || 0;
        db.set(`points.${user.id}`, Math.max(0, current - amt));
        return msg.reply(`✅ تم خصم ${amt} نقاط.`);
      }
    }

    if (cmd === "تصفير" && isAdmin && msg.mentions.users.first()) {
      db.set(`points.${msg.mentions.users.first().id}`, 0);
      return msg.reply("✅ تم تصفير النقاط.");
    }

    return;
  }

  // الاقتراحات
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

  // الضريبة
  if (msg.channel.id === cmdChannels.tax) {
    const num = parseFloat(msg.content);
    if (!isNaN(num)) {
      const tax = Math.floor(num * 0.05);
      const total = Math.floor(num + tax);
      return msg.reply(`💸 المبلغ بعد الضريبة: ${total} (الضريبة: ${tax})`);
    }
  }

  // الاستلام اليومي
  if (msg.channel.id === cmdChannels.daily) {
    const key = `${msg.author.id}_daily`;
    const last = db.get(key) || 0;
    const now = Date.now();
    if (now - last < 86400000) return msg.reply("⏳ جرب بكرة!");
    db.set(key, now);
    const pts = (db.get(`points.${msg.author.id}`) || 0) + 1;
    db.set(`points.${msg.author.id}`, pts);

    const userSpam = spamLogs[msg.author.id] || [];
    spamLogs[msg.author.id] = userSpam.filter(t => now - t < 3 * 60000);
    spamLogs[msg.author.id].push(now);

    if (spamLogs[msg.author.id].length > 3) {
      msg.member.timeout(10 * 60 * 1000, "Spam points");
      return msg.reply("⛔ تم إعطاؤك تايم آوت بسبب سبام النقاط.");
    }

    return msg.reply("✅ تم إعطاؤك نقطة!");
  }

  // التذاكر
  const isTicket = msg.channel.parentId === cmdChannels.ticketsCategory;
  if (isTicket && msg.content.toLowerCase() === "استلام") {
    const overwrites = msg.channel.permissionOverwrites.cache.filter(o => o.type === 1);
    const ownerId = overwrites.find(o => o.id !== msg.guild.roles.everyone.id)?.id;
    if (!ownerId) return;

    const pts = (db.get(`points.${ownerId}`) || 0) + 5;
    db.set(`points.${ownerId}`, pts);

    await msg.channel.permissionOverwrites.edit(ownerId, { SendMessages: false });
    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });

    return msg.reply("✅ تم استلام التذكرة واحتساب النقاط.");
  }
});

client.login(config.token);
