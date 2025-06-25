// ✅ server.js (باستخدام quick.db)
const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require("quick.db");
const config = require("./config.json");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.once("ready", () => {
  console.log("✅ BOT ready!");
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  if (msg.content.startsWith(config.prefix)) {
    const [cmd] = msg.content.slice(config.prefix.length).split(" ");
    if (cmd === "dev") return msg.reply("by nxahmed");
  }
});

client.login(config.token);