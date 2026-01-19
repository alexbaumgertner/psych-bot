import { Bot } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

if (!process.env.BOT_TOKEN || !process.env.AI_API_KEY) {
  console.error("No required environment variables");
  process.exit(1);
}

// Initialization
const bot = new Bot(process.env.BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.MODEL || "gemini-3-pro-preview" });

// System prompt for setting the personality and limitations
const SYSTEM_PROMPT = `
Ты — эмпатичный и профессиональный помощник-психолог, а также интересный собеседник. 
Твоя цель — оказывать поддержку, валидировать чувства и давать научно обоснованные рекомендации.
Твой стиль (Tone of Voice): Теплый, принимающий, но не "слащавый". Ты умеешь читать между строк и замечать скрытые эмоции.

Правила:
Лаконичность: Ответ строго 5–7 предложений. Избегай "воды" и долгих вступлений. Бей точно в суть.
Экспертность: Опирайся на КПТ (когнитивно-поведенческую терапию) и научные данные. Избегай эзотерики.
Гибкость: Если тема обычная (не психология) — общайся живо, с юмором и метафорами, как умный друг.
Безопасность: Если предлагают деструктивное поведение (алкоголь, хулиганство) — не читай морали. 
Присоединись к эмоции ("понимаю желание разрядиться"), 
но предложи более здоровую альтернативу или переведи в шутку, мягко уводя от риска.`;

// Function to get the response from AI
async function getAIResponse(userMessage: string): Promise<string> {
  try {
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [{ text: "Понял. Я готов отвечать, соблюдая ограничения по длине." }],
        },
      ],
    });

    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("AI error:", error);
    return "Sorry, I'm currently unable to think of an answer. Please try again later.";
  }
}

// Handling text messages
bot.on("message:text", async (ctx) => {
  const chatType = ctx.chat.type;
  const messageText = ctx.message.text;
  const botInfo = await ctx.api.getMe();

  // Checking if the bot is mentioned through entities (correct way for Telegram)
  const entities = ctx.message.entities || [];
  const isMentioned =
    entities.some(
      (entity) =>
        entity.type === "mention" &&
        messageText.substring(entity.offset, entity.offset + entity.length) ===
          `@${botInfo.username}`
    ) ||
    entities.some((entity) => entity.type === "text_mention" && entity.user?.id === botInfo.id) ||
    messageText.includes(`@${botInfo.username}`); // Fallback for compatibility

  // Checking if this is a reply to the bot's message
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === botInfo.id;

  // In groups, we only answer if the bot is mentioned or this is a reply to its message
  if (chatType === "group" || chatType === "supergroup") {
    if (!isMentioned && !isReplyToBot) {
      return; // Ignoring normal messages in the chat
    }
  }

  // Showing the status "typing..."
  await ctx.replyWithChatAction("typing");

  // Cleaning the text from the bot's username, if it exists
  let cleanText = messageText;
  if (isMentioned) {
    // Removing the mention of the bot from the text
    cleanText = messageText.replace(new RegExp(`@${botInfo.username}\\s*`, "gi"), "").trim();
  }

  if (!cleanText) {
    await ctx.reply("Привет! Я готов отвечать.");
    return;
  }

  const aiAnswer = await getAIResponse(cleanText);

  // Sending the answer (can reply, to save the context of the conversation thread)
  await ctx.reply(aiAnswer, {
    reply_parameters: { message_id: ctx.msg.message_id },
  });
});

const server = createServer((req, res) => {
  if (req.url === "/webhook") {
    // Here we can add webhooks in the future, if you want
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else if (req.url === "/healthcheck") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

// Render itself gives the port through the environment variable PORT
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
// ==========================

// Starting the bot (Long Polling)
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started!`);
  },
});
