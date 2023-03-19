const Telegraf = require("telegraf");
const telegrafMediaGroup = require("telegraf-media-group");
const session = require("telegraf/session");
const Stage = require("telegraf/stage");
const WizardScene = require("telegraf/scenes/wizard");
const Markup = require("telegraf/markup");
const Composer = require("telegraf/composer");
const { GoogleSpreadsheet } = require("google-spreadsheet");
require("dotenv").config();

const stepHandler = new Composer();

stepHandler.action("yes", (ctx) => {
  ctx.answerCbQuery();
  ctx.telegram.sendMessage(
    ctx.chat.id,
    "Avvalambor bizga sizning telefon raqamingiz kerak.",
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: "📲 Telefon raqamni berish",
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    },
  );
  return ctx.wizard.next();
});

stepHandler.action("no", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply("Unday bo'lsa sizga omad tilaymiz 🙂");
  return ctx.scene.leave();
});

stepHandler.on("contact", (ctx) => {
  ctx.wizard.state.data.user = ctx.message.contact;
  ctx.wizard.state.data.sharedContact = true;
  ctx.reply(
    "Kattakon rahmat! Endi tanlovimizda bir shartni tanlang.\n\nA. Hech qanday vazifalarsiz kitob yutib oling.  (Random orqali g’olib aniqlanadi)\n\nB. Aytilgan vazifani bajarish orqali kitob sohibiga aylaning. (Vazifani bajarilishiga qarab g’olib aniqlanadi)",
    Markup.inlineKeyboard([
      Markup.callbackButton("A", "a"),
      Markup.callbackButton("B", "b"),
    ]).extra(),
  );
  return ctx.wizard.next();
});

stepHandler.action("a", (ctx) => {
  ctx.wizard.state.data.choice = "a";
  ctx.answerCbQuery();
  ctx.replyWithHTML(
    "Unday bo'lsa, quyidagi link ortidagi postni <b>3 guruhga 👥</b> jo’nating va har biridan screenshotlarni shu botga bitta qilib (Media Group) jo'nating\nhttps://t.me/MuallimSaid_Blog/1325",
  );
  return ctx.wizard.next();
});

stepHandler.action("b", (ctx) => {
  ctx.wizard.state.data.choice = "b";
  ctx.answerCbQuery();
  ctx.replyWithHTML(
    "Unday bo'lsa, quyidagi link ortidagi postni <b>3 guruhga 👥</b> jo’nating va har biridan screenshotlarni,  hamda o’zingizga yoqqan biror kitob to’g’risidagi taassurotlaringizni yozing, rasmlarni botga bitta qilib (Media Group) jo'nating, so’ngra taassurotlaringizni kiriting\nhttps://t.me/MuallimSaid_Blog/1325",
  );
  return ctx.wizard.next();
});

stepHandler.on("media_group", async (ctx) => {
  if (ctx.wizard.state.data.choice === "a") {
    ctx.wizard.state.data.media = [];
    for (const message of ctx.mediaGroup) {
      ctx.wizard.state.data.media.push({
        type: "photo",
        id: message.photo[0].file_id,
      });
    }
  } else {
    ctx.wizard.state.data.media = [];
    for (const message of ctx.mediaGroup) {
      ctx.wizard.state.data.media.push(
        message.photo
          ? { type: "photo", id: message?.photo[0]?.file_id }
          : { type: "video", id: message?.video?.file_id },
      );
    }
  }

  if (ctx.wizard.state.data.choice === "a") {
    ctx.telegram.sendMediaGroup(-1001568913880, [
      ...ctx.wizard.state.data.media.map((med, i) => {
        return i === 0
          ? {
              media: med.id,
              type: med.type,
              caption: `${ctx.wizard.state.data.user.first_name} ${ctx.wizard.state.data.user.last_name}\n${ctx.wizard.state.data.user.phone_number}`,
            }
          : {
              media: med.id,
              type: med.type,
            };
      }),
    ]);
    const doc = new GoogleSpreadsheet(process.env.DOC_ID);
    const auth = await doc.useServiceAccountAuth({
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    await doc.loadInfo(); // loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      id: ctx.wizard.state.data.user.user_id,
      "First Name": ctx.wizard.state.data.user.first_name,
      "Last Name": ctx.wizard.state.data.user.last_name,
      "Phone Number": ctx.wizard.state.data.user.phone_number,
      Choice: ctx.wizard.state.data.choice,
    });
    ctx.replyWithHTML(
      "🥳 Tanlovga ro'yxatga olindingiz! Tanlov natijalarini tez kunda yuqorida siz ulashgan postda sanalgan barcha kanallarda bilib olasiz.",
    );
    return ctx.scene.leave();
  } else {
    ctx.telegram.sendMediaGroup(-1001886724882, [
      ...ctx.wizard.state.data.media.map((med, i) => {
        return i === 0
          ? {
              media: med.id,
              type: med.type,
              caption: `${ctx.wizard.state.data.user.first_name} ${ctx.wizard.state.data.user.last_name}\n${ctx.wizard.state.data.user.phone_number}`,
            }
          : {
              media: med.id,
              type: med.type,
            };
      }),
    ]);
    ctx.replyWithHTML(
      "Endi o'zingizga yoqqan kitobdan olgan taassurotlaringizni kiriting! Tanlov natijalarini tez kunda yuqorida siz ulashgan postda sanalgan barcha kanallarda bilib olasiz.",
    );
    return ctx.wizard.next();
  }
});

const superWizard = new WizardScene(
  "super-wizard",
  (ctx) => {
    ctx.reply(
      `Assalamu alaykum ${ctx.from.first_name} ${ctx.from.last_name}! Tanlovga xush kelibsiz! Tanlovimiz juda ham oddiy, sizda 2ta variant bor, ikkalasidan biri orqali ajoyib kitobga ega bo'lishingiz mumkin.🤩`,
    );
    ctx.reply(
      "Tayyormisiz? 🤔",
      Markup.inlineKeyboard([
        Markup.callbackButton("Ha 😎", "yes"),
        Markup.callbackButton("Yo'q 😔", "no"),
      ]).extra(),
    );
    ctx.wizard.state.data = {};
    return ctx.wizard.next();
  },
  stepHandler,
  stepHandler,
  stepHandler,
  stepHandler,
  async (ctx) => {
    const doc = new GoogleSpreadsheet(process.env.DOC_ID);
    const auth = await doc.useServiceAccountAuth({
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    await doc.loadInfo(); // loads document properties and worksheets
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      id: ctx.wizard.state.data.user.user_id,
      "First Name": ctx.wizard.state.data.user.first_name,
      "Last Name": ctx.wizard.state.data.user.last_name,
      "Phone Number": ctx.wizard.state.data.user.phone_number,
      Choice: ctx.wizard.state.data.choice,
      Summary: ctx.message.text,
    });
    ctx.replyWithHTML(
      "🥳 Tanlovga ro'yxatga olindingiz! Tanlov natijalarini tez kunda yuqorida siz ulashgan postda sanalgan barcha kanallarda bilib olasiz.",
    );
    return ctx.scene.leave();
  },
);
const stage = new Stage([superWizard]);

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(telegrafMediaGroup());
bot.use(session());
bot.use(stage.middleware());

// Main commands

bot.start((ctx, next) => {
  ctx.scene.enter("super-wizard");

  return next(ctx);
});

bot.launch();
