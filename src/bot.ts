import { Bot } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

// Проверка наличия ключей
if (!process.env.BOT_TOKEN || !process.env.AI_API_KEY) {
  console.error("ОШИБКА: Не заданы BOT_TOKEN или AI_API_KEY в .env файле");
  process.exit(1);
}

// Инициализация
const bot = new Bot(process.env.BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Системный промпт для настройки личности и ограничений
const SYSTEM_PROMPT = `
Ты — эмпатичный и профессиональный помощник-психолог. А еще всесторонний и увлекательный собеседник.
Твоя задача — отвечать на вопросы пользователей, оказывая поддержку и давая базовые рекомендации.
Правила:
1. Твои ответы должны быть не длиннее 10 предложений. Лучше в районе 5-7 предложений.
2. Отвечай объективно с опорой на научные факты и статистику. Можешь использовать неформальный язык.
3. Если вопрос не касается психологии или ментального здоровья, продолжай разговор как обычный собеседник.
4. Если предлагают выпить/хулиганить, не отказывался, но окажи поддержку по-дружески: пробуй экологичный выход из ситуации.
`;

// Функция получения ответа от AI
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
    console.error("Ошибка AI:", error);
    return "Извините, сейчас я не могу обдумать ответ. Попробуйте позже.";
  }
}

// Обработка текстовых сообщений
bot.on("message:text", async (ctx) => {
  const chatType = ctx.chat.type;
  const messageText = ctx.message.text;
  const botInfo = await ctx.api.getMe();

  // Проверяем, упомянут ли бот через entities (правильный способ для Telegram)
  const entities = ctx.message.entities || [];
  const isMentioned =
    entities.some(
      (entity) =>
        entity.type === "mention" &&
        messageText.substring(entity.offset, entity.offset + entity.length) ===
          `@${botInfo.username}`
    ) ||
    entities.some((entity) => entity.type === "text_mention" && entity.user?.id === botInfo.id) ||
    messageText.includes(`@${botInfo.username}`); // Fallback для совместимости

  // Проверяем, является ли это ответом на сообщение бота
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === botInfo.id;

  // В группах отвечаем только если бот упомянут или это ответ на его сообщение
  if (chatType === "group" || chatType === "supergroup") {
    if (!isMentioned && !isReplyToBot) {
      return; // Игнорируем обычные сообщения в чате
    }
  }

  // Показываем статус "печатает..."
  await ctx.replyWithChatAction("typing");

  // Очищаем текст от юзернейма бота, если он есть
  let cleanText = messageText;
  if (isMentioned) {
    // Удаляем упоминание бота из текста
    cleanText = messageText.replace(new RegExp(`@${botInfo.username}\\s*`, "gi"), "").trim();
  }

  if (!cleanText) {
    await ctx.reply("Привет! Я готов отвечать.");
    return;
  }

  const aiAnswer = await getAIResponse(cleanText);

  // Отправляем ответ (можно reply, чтобы сохранить контекст нити разговора)
  await ctx.reply(aiAnswer, {
    reply_parameters: { message_id: ctx.msg.message_id },
  });
});

const server = createServer((req, res) => {
  if (req.url === "/webhook") {
    // Сюда можно будет прикрутить вебхуки в будущем, если захотите
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

// Render сам выдает порт через переменную окружения PORT
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Fake server listening on port ${PORT}`);
});
// ==========================

// Запуск бота (Long Polling)
bot.start({
  onStart: (botInfo) => {
    console.log(`Бот @${botInfo.username} запущен!`);
  },
});
