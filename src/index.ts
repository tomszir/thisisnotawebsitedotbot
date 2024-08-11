import "dotenv/config";

import { Client, Collection, Events, GatewayIntentBits } from "discord.js";

import { ClientCommand } from "./types";
import fs from "node:fs";
import path from "node:path";

type CustomClient = {
  commands: Collection<string, ClientCommand>;
} & Client;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
}) as CustomClient;

client.commands = new Collection();

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! test Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = (interaction.client as CustomClient).commands.get(
    interaction.commandName
  );

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

(async () => {
  const foldersPath = path.join(__dirname, "commands");
  const commandFolders = fs.readdirSync(foldersPath);

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = (await import(filePath)).default;

      if ("data" in command && "execute" in command) {
        const clientCommand = command as ClientCommand;
        client.commands.set(clientCommand.data.name, clientCommand);
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }

  client.login(process.env.DISCORD_BOT_TOKEN);
})();
