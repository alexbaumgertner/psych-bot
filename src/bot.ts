import { Bot, Context } from "grammy";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

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

  // Логика для групп: отвечаем только если тегнули бота или это реплай на сообщение бота
  const isMentioned = messageText.includes(`@${botInfo.username}`);
  const isReplyToBot = ctx.message.reply_to_message?.from?.id === botInfo.id;

  if (chatType === "group" || chatType === "supergroup") {
    if (!isMentioned && !isReplyToBot) return; // Игнорируем обычные сообщения в чате
  }

  // Показываем статус "печатает..."
  await ctx.replyWithChatAction("typing");

  // Очищаем текст от юзернейма бота, если он есть
  const cleanText = messageText.replace(`@${botInfo.username}`, "").trim();

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

// Запуск
bot.start({
  onStart: (botInfo) => {
    console.log(`Бот @${botInfo.username} запущен и готов помогать!`);
  },
});
