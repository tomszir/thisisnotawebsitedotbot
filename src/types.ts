import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export interface ClientCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
