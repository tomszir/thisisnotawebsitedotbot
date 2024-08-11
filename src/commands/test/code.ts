import {
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { ClientCommand } from "../../types";
import { JSDOM } from "jsdom";
import axios from "axios";
import fs from "node:fs";

async function sendCodeRequest(
  code: string
): Promise<{ type: string; data: string } | null> {
  const form = new FormData();

  form.append("code", code);

  try {
    const response = await axios.post(
      "https://codes.thisisnotawebsitedotcom.com/",
      form
    );
    const contentType = response.headers["content-type"];

    if (contentType != "text/html") {
      return new Promise(async (resolve, reject) => {
        const type = response.headers["content-type"].split("/")[1];
        const fileName = `${code}.${type}`;

        if (fs.existsSync(fileName)) {
          return resolve({ type: contentType, data: fileName });
        }

        const videoResponse = await axios.post(
          "https://codes.thisisnotawebsitedotcom.com/",
          form,
          {
            responseType: "arraybuffer",
          }
        );
        const blob = new Blob([videoResponse.data], {
          type: contentType,
        });

        fs.writeFile(fileName, Buffer.from(await blob.arrayBuffer()), reject);

        resolve({ type: contentType, data: fileName });
      });
    }

    if (response.status != 200) {
      return null;
    }

    return { type: "text/html", data: response.data };
  } catch (error) {
    console.error(error);
    return null;
  }
}

const command = {
  data: new SlashCommandBuilder()
    .setName("code")
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("The code to test")
        .setRequired(true)
    )
    .setDescription("Tests a code"),
  async execute(interaction: ChatInputCommandInteraction<CacheType>) {
    await interaction.deferReply();
    const code = interaction.options.getString("code");
    const embed = new EmbedBuilder();

    if (!code) {
      embed.setDescription("No code provided");
      return await interaction.editReply({ embeds: [embed] });
    }

    const response = await sendCodeRequest(code);
    embed.setTitle(code.toUpperCase());

    if (response == null) {
      embed.setDescription("Code does not exist...");
      return await interaction.editReply({ embeds: [embed] });
    }

    if (response.type == "video/mp4") {
      return await interaction.editReply({
        content: `**${code.toUpperCase()}**\n\n---`,
        files: [response.data],
      });
    }

    const dom = new JSDOM(response.data);

    const getValueAttributes = (selector: string, attribute?: string) =>
      [...dom.window.document.querySelectorAll(selector)].map((x) =>
        attribute ? x.getAttribute(attribute)! : x.textContent!
      );

    const images = [...new Set(getValueAttributes("img", "src"))];
    const paragraphs = getValueAttributes("p");
    const videos = [...new Set(getValueAttributes("source", "src"))];

    const text = getValueAttributes("[data-text]", "data-text");
    const links = getValueAttributes("[data-links]", "data-links")?.[0]?.split(
      ";"
    );
    const content: { name: string; value: string[]; byComma?: boolean }[] = [];

    /*
          ...videos,
      ...images.map((x) => {
        if (x.startsWith("data")) {
          return "Showing Data URL images not yet implemented";
        }

        return encodeURI(x);
      }),
    */

    const handleLink = (link: string) => {
      var splitLink = link.split("/");
      return `[${splitLink[splitLink.length - 1]}](${encodeURI(link)})`;
    };

    if (paragraphs.length > 0) {
      content.push({ name: "Paragraphs", value: paragraphs });
    }

    if (text.length > 0) {
      content.push({
        name: "Monitor Text",
        value: text.map((x, i) => `${x.replace("<br/>", "\n")}`),
      });
    }

    if (links?.length > 0) {
      content.push({
        name: "Redirect Links",
        value: links.map(handleLink),
        byComma: true,
      });
    }

    if (videos.length > 0) {
      content.push({
        name: "Videos",
        value: videos.map(handleLink),
        byComma: true,
      });
    }

    if (images.length > 0) {
      content.push({
        name: "Images",
        value: images.map((x) => {
          if (x.startsWith("data")) {
            return "[TODO] Showing Data URL images not yet implemented";
          }
          return handleLink(x);
        }),
        byComma: true,
      });
    }

    await interaction.editReply({
      content:
        `**${code.toUpperCase()}**\n--\n\n` +
        content
          .map((x) => {
            return `**${x.name}**\n${x.value.join(x.byComma ? ", " : "\n")}`;
          })
          .join("\n\n"),
    });
  },
} as ClientCommand;

export default command;
