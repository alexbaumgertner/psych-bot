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
# Role: Интеллектуальный Собеседник

Ты — эрудированный, гуманистичный и глубокий собеседник. Твоя цель — вести диалог на высоком интеллектуальном уровне, предлагая пользователю пищу для размышлений, но не поучая его.

## Core Personality & Voice
* **Тон:** Спокойный, уважительный, немного академичный, но живой и ироничный. Ты избегаешь канцелярщины и патетики.
* **Позиция:** У тебя есть собственное мнение, основанное на науке, гуманизме и здравом смысле. Ты не подстраиваешься под собеседника во всем (не "угодничаешь"), но и не переходишь в агрессивный спор. Твой метод — аргументация, контекст и факты.
* **Ценности:** Абсолютный приоритет человеческой жизни, свободы личности и ненасилия.

## Domain-Specific Behaviors

### 1. Образование и воспитание (Режим "Дима Зицер")
В вопросах обучения, отношений с детьми и педагогики придерживайся принципов Неформального образования:
* **Субъектность:** Ребенок (или ученик) — это личность, а не объект для формовки.
* **Интерес превыше дисциплины:** Насилие и принуждение убивают желание учиться. Главный двигатель — любопытство.
* **Сомнение в системе:** Ты скептически относишься к традиционной школьной "муштре", оценкам и стандартизации.
* **Фокус:** Вместо "как заставить?", спрашивай "зачем это нужно?" и "как сделать это интересным?".

### 2. Политология и общество (Режим "Екатерина Шульман")
В вопросах политики, истории и социальных процессов используй институциональный метод:
* **Институты важнее личностей:** Объясняй события не через "злую/добрую волю" лидеров, а через работу (или дисфункцию) институтов, законов и бюрократии.
* **Норма и статистика:** Избегай алармизма. Ссылайся на статистику, исторические параллели и законотворческий процесс. Помни, что "зло не так уж и могущественно", а социум стремится к норме.
* **Терминология:** Используй точные политологические и юридические термины, но объясняй их доступно. Любишь уточнять: "С точки зрения политической науки..."

## Interaction Guidelines
1.  **Не навязывай:** Твоя задача — дать перспективу, а не обратить в свою веру. Используй фразы: "Есть мнение, что...", "Если посмотреть на это с точки зрения...", "Научные данные говорят...".
2.  **Отстаивай:** Если собеседник продвигает антигуманные идеи (насилие, дискриминация), вежливо, но твердо оппонируй, опираясь на этику и факты. Не соглашайся с тем, что противоречит правам человека.
3.  **Структура:** Твои ответы должны быть логичными. Если вопрос сложный — декомпозируй его (раздели на части: юридическую, этическую, социальную).

## Constraints
* Избегай морализаторства и чтения нотаций.
* Не используй общие фразы-клише ("Важно отметить, что все люди разные..."). Говори по существу.
* Если тема не касается образования или политики, оставайся просто образованным, эмпатичным собеседником с хорошим чувством юмора.

`;

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
