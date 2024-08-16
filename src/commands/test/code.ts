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
import { imageHash } from "image-hash";

function base64ImageToBlob(str: string) {
  // extract content type and base64 payload from original string
  var pos = str.indexOf(";base64,");
  var type = str.substring(5, pos);
  var b64 = str.substring(pos + 8);

  // decode base64
  var imageContent = atob(b64);

  // create an ArrayBuffer and a view (as unsigned 8-bit)
  var buffer = new ArrayBuffer(imageContent.length);
  var view = new Uint8Array(buffer);

  // fill the view, using the decoded base64
  for (var n = 0; n < imageContent.length; n++) {
    view[n] = imageContent.charCodeAt(n);
  }

  // convert ArrayBuffer to Blob
  var blob = new Blob([buffer], { type: type });

  return blob;
}

function getFileName(
  buffer: Buffer,
  contentType: string,
  code: string
): Promise<string> {
  return new Promise((resolve, _) => {
    const hash = btoa(`${contentType}+${buffer.toString("base64")}`).substring(
      0,
      16
    );

    resolve(`assets/${code}.${hash}.${contentType.split("/")[1]}`);
  });
}

function saveFile(
  blob: Blob,
  contentType: string,
  code: string
): Promise<{ type: string; data: string }> {
  return new Promise(async (resolve, reject) => {
    var buffer = Buffer.from(await blob.arrayBuffer());
    const fileName = await getFileName(buffer, contentType, code);

    if (fs.existsSync(fileName)) {
      return resolve({ type: contentType, data: fileName });
    }

    fs.writeFile(fileName, buffer, reject);

    resolve({ type: contentType, data: fileName });
  });
}

async function sendCodeRequest(
  code: string
): Promise<{ type: string; data: string } | null> {
  const form = new FormData();

  form.append("code", code);

  const baseUrl = "https://codes.thisisnotawebsitedotcom.com/";

  try {
    const response = await axios.post(baseUrl, form);
    const contentType = response.headers["content-type"];

    if (contentType != "text/html") {
      const arrayBufferResponse = await axios.post(baseUrl, form, {
        responseType: "arraybuffer",
      });
      return saveFile(
        new Blob([arrayBufferResponse.data], {
          type: contentType,
        }),
        contentType,
        code
      );
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

    if (response.type != "text/html") {
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

    const images = await Promise.all([
      ...new Set(getValueAttributes("img", "src")),
    ]);
    const paragraphs = getValueAttributes("p");
    const videos = [...new Set(getValueAttributes("source", "src"))];

    const text = getValueAttributes("[data-text]", "data-text");
    const links = getValueAttributes("[data-links]", "data-links")?.[0]?.split(
      ";"
    );
    const content: { name: string; value: string[]; byComma?: boolean }[] = [];
    const files = await Promise.all(
      images.map(async (x) => {
        if (x.startsWith("data")) {
          return await saveFile(base64ImageToBlob(x), "image/png", code);
        }
      })
    );

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
        value: images
          .map((x) => {
            if (x.startsWith("data")) {
              return "";
            }
            return handleLink(x);
          })
          .filter((x) => x !== ""),
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
      files: files.map((x) => x?.data).filter((x) => x != null),
    });
  },
} as ClientCommand;

export default command;
