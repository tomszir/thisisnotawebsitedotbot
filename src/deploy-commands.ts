import "dotenv/config";

import { REST, Routes } from "discord.js";

import { ClientCommand } from "./types";
import fs from "node:fs";
import path from "node:path";

const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

(async () => {
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
        console.log(`Loading command: ${clientCommand.data.name}`);
        commands.push(clientCommand.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_APPLICATION_ID!,
        process.env.DISCORD_GUILD_ID!
      ),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${(data as any).length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();
