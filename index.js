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
  ctx.replyWithHTML(
    "Kattakon rahmat! Endi tanlovimizda qatnashish uchun sizdan talab qilinadigan narsa:\nQuyidagi link ortidagi postni <b>3 guruhga 👥</b> jo’nating va har biridan screenshotlarni shu botga bitta qilib (Media Group) jo'nating\nhttps://t.me/MuallimSaid_Blog/1934",
    {
      reply_markup: Markup.removeKeyboard(),
    },
  );
  return ctx.wizard.next();
});

stepHandler.on("media_group", async (ctx) => {
  ctx.wizard.state.data.media = [];
  for (const message of ctx.mediaGroup) {
    ctx.wizard.state.data.media.push({
      type: "photo",
      id: message.photo[0].file_id,
    });
  }

  ctx.telegram.sendMediaGroup(-1001886724882, [
    ...ctx.wizard.state.data.media.map((med, i) => {
      return i === 0
        ? {
            media: med.id,
            type: med.type,
            caption: `${
              ctx.wizard.state.data.user?.first_name
                ? ctx.wizard.state.data.user?.first_name
                : ctx.wizard.state.data.user?.phone_number
            } ${
              ctx.wizard.state.data.user.last_name
                ? ctx.wizard.state.data.user.last_name
                : ""
            }\n${ctx.wizard.state.data.user.phone_number}`,
          }
        : {
            media: med.id,
            type: med.type,
          };
    }),
  ]);
  ctx.replyWithHTML(
    "Endi o'zingizga yoqqan kitobdan olgan taassurotlaringizni kiriting!",
  );
  return ctx.wizard.next();
});

const superWizard = new WizardScene(
  "super-wizard",
  (ctx) => {
    ctx.reply(
      `Assalamu alaykum! Tanlovga xush kelibsiz! Tanlovimiz juda ham oddiy, aytilgan shartni bajaring va qimmatbaho sovg'alarga ega bo'ling! 🤩`,
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
  async (ctx) => {
    const doc = new GoogleSpreadsheet(process.env.DOC_ID);
    const auth = await doc.useServiceAccountAuth({
      client_email: process.env.CLIENT_EMAIL,
      private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    });

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      id: ctx.wizard.state.data.user.user_id,
      "First Name": ctx.wizard.state.data.user.first_name
        ? ctx.wizard.state.data.user.first_name
        : "",
      "Last Name": ctx.wizard.state.data.user.last_name
        ? ctx.wizard.state.data.user.last_name
        : "",
      "Phone Number": ctx.wizard.state.data.user.phone_number,
      Summary: ctx.message.text,
    });
    ctx.replyWithHTML(
      "🥳 Tanlovga ro'yxatga olindingiz!\nTanlov natijalarini 25-Iyul sanasida ma'lum qilinadi.\nBizni kuzatib boring: @muallimsaid_blog",
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
