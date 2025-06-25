const { Client, Intents, MessageEmbed, Permissions } = require("discord.js");
const db = require("pro.db");
const config = require("./config.json");

const token = process.env.TOKEN;

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS
  ]
});

client.once("ready", () => {
  console.log("✅ BOT ready!");
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  if (msg.content.startsWith(config.prefix)) {
    const [cmd] = msg.content.slice(config.prefix.length).trim().split(/\s+/);

    if (cmd === "dev") {
      return msg.reply("by nxahmed");
    }
  }
});

client.login(token);
