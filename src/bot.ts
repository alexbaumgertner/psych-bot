import { Bot, webhookCallback } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

// Проверка наличия ключей
if (!process.env.BOT_TOKEN || !process.env.AI_API_KEY) {
  console.error("ОШИБКА: Не заданы BOT_TOKEN или AI_API_KEY в переменных окружения Lambda");
  throw new Error("Missing required environment variables");
}

// Инициализация
const bot = new Bot(process.env.BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Системный промпт для настройки личности и ограничений
const SYSTEM_PROMPT = `
Ты — эмпатичный и профессиональный помощник-психолог. 
Твоя задача — отвечать на вопросы пользователей, оказывая поддержку и давая базовые рекомендации.
Правила:
1. Твои ответы должны быть не длиннее 10 предложений.
2. Отвечай мягко, но объективно.
3. Если вопрос не касается психологии или ментального здоровья, вежливо откажись отвечать.
4. Если ситуация критическая (суицид, насилие), порекомендуй обратиться к специалисту немедленно.
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
          parts: [{ text: "Понял. Я готов отвечать как психолог, соблюдая ограничения по длине." }],
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
    await ctx.reply("Слушаю вас. Задайте свой вопрос по психологии.");
    return;
  }

  const aiAnswer = await getAIResponse(cleanText);

  // Отправляем ответ (можно reply, чтобы сохранить контекст нити разговора)
  await ctx.reply(aiAnswer, {
    reply_parameters: { message_id: ctx.msg.message_id },
  });
});

// Создаем webhook handler для AWS Lambda
// webhookCallback для "aws-lambda" возвращает функцию с правильной сигнатурой Lambda handler
export const telegramWebhook = webhookCallback(bot, "aws-lambda");
