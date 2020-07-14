"use strict";

// Jani Haiko, 2019 - 2020

if(process.env.NODE_ENV !== "production"){
    require("dotenv").config();
}

const fs = require("fs");
const http = require("http");
const fetch = require("node-fetch");
const Telegraf = require("telegraf");
const Telegram = Telegraf.Telegram;

const catFactsAPIUrl = "https://catfact.ninja";
const CATAAS_APIUrl = "https://cataas.com";
const googleCustomSearchAPIUrl = "https://www.googleapis.com/customsearch/v1";
const TCDNE_APIUrl = "https://thiscatdoesnotexist.com/";

const API_TOKEN = process.env.API_TOKEN;
if(!API_TOKEN){
    throw "Missing API_TOKEN";
}
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if(!GOOGLE_API_KEY){
    throw "Missing GOOGLE_API_KEY";
}
const GOOGLE_CX = process.env.GOOGLE_CX;
if(!GOOGLE_CX){
    throw "Missing GOOGLE_CX";
}
const HEROKU_URL = process.env.HEROKU_URL;
let ALLOWED_USER_ID = process.env.ALLOWED_USER_ID;
if(!ALLOWED_USER_ID){
    throw "Missing ALLOWED_USER_ID";
}
else{
    ALLOWED_USER_ID = Number(ALLOWED_USER_ID);
}
const ALLOWED_USERNAME = process.env.ALLOWED_USERNAME;
if(!ALLOWED_USERNAME){
    throw "Missing ALLOWED_USER_NAME";
}
const PRIVATE_CHAT_ID = process.env.PRIVATE_CHAT_ID;
if(!PRIVATE_CHAT_ID){
    throw "Missing PRIVATE_CHAT_ID";
}
if(!process.env.MONGO_URL || !process.env.DB_USERNAME || !process.env.DB_PASSWORD){
    throw "Missing Mongo url/username/password";
}

const port = process.env.PORT || 8000;
const channelId = "@CatFactsChannel";

const stickerSetNames = [
    "PussyCat",
    "cat_Persik",
    "avesta_us52",
    "nekoatsumeofficialstickers",
    "Cat_fullmoon",
    "nekoatsumepack",
    "BlueCat",
    "MemeCat",
    "simonscatt",
    "cat_collection",
    "SuperSadCats",
    "MoarKittyMeme",
    "PopTartCat",
    "catcapoo",
    "Blicepack",
    "stpcts",
    "real_cats",
    "MarseyCat",
    "UsamaruUsamaru"
];

if(HEROKU_URL){
    setInterval(() => {
        console.info("Just keeping myself alive");
        try{
            fetch(HEROKU_URL);
        }
        catch(error){
            console.error(error);
        }
    },600000);
}

let maxFakeUpvotes = 10;

const bot = new Telegraf(API_TOKEN);
const telegram = new Telegram(API_TOKEN);

const dbHelper = require("./dbHelper.js");

let running = true;
let theLoop;
let currentBreed;
const stickerSets = [];

// Offline facts
let offlineFacts;
fs.readFile("./offlineFacts.json","UTF-8",(error,data) => {
    if(!error){
        offlineFacts = JSON.parse(data);
    }
    else{
        console.error(error);
    }
});

startLoop();

bot.start((ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        if(!running){
            ctx.reply("Starting...");
            running = true;

            startLoop();
        }
        else{
            ctx.reply("Already running!");
        }
    }
    else{
        ctx.reply("Meow there! I don't have time to chat with a mere human. Please go to @CatFactsChannel");
    }
});
bot.command("/stop",(ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        ctx.reply("Stopping...");
        running = false;
    }
    else{
        ctx.reply("No, you stop that");
    }
});

bot.command("/post",(ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        ctx.reply("OK! Posting...");
        /*if(stickerSets.length){
            telegram.sendSticker(channelId,stickerSets[Math.floor(Math.random() * stickerSets.length)].file_id,{
                disable_notification: true
            }).catch((error) => {
                console.error(error);
            });
        }*/

        setTimeout(async () => {
            let savedFact;
            let sentMessage;

            try{
                const fact = await getCatFact();
                if(fact){
                    savedFact = await dbHelper.saveFact(fact,maxFakeUpvotes);
                    const imageFileName = await getRandomCatPicture();
                    if(imageFileName){
                        await telegram.sendPhoto(channelId,{
                            source: fs.readFileSync(`${imageFileName}`)
                        });
                        const emoji = Math.random() < 0.5 ? `${Math.random() < 0.5 ? "😸" : "😺"}` : `${Math.random() < 0.5 ? "🐱" : "🐈"}`;
                        sentMessage = await telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? emoji + " Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                            parse_mode: "Markdown",
                            reply_markup: getLikeButton(savedFact.id)
                        });
                    }
                    else{
                        console.warn("It seems that getting the image failed");
                        telegram.sendMessage(PRIVATE_CHAT_ID,"Getting image from both CATAAS and TCDNE failed! Please check the server console for more information.");
                        sentMessage = await telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                            parse_mode: "Markdown",
                            reply_markup: getLikeButton(savedFact.id)
                        });
                    }

                    startLoop(); // Let's reset the timer
                }
            }
            catch(error){
                console.error(error);
                ctx.reply("Failed! Please check the server console for more information.");
            }

            if(sentMessage && savedFact){
                setTimeout(() => {
                    updateLikeButtonWithFakeUpvotes(savedFact.id,sentMessage.message_id);
                },5000);
            }
        },3000);
    }
    else{
        ctx.reply("Sorry, you are not allowed to use that command right now.");
    }
});
bot.command("/breed",async (ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        try{
            const response = await fetch(`${catFactsAPIUrl}/breeds?page=${Math.floor(Math.random() * 4) + 1}`);
            if(response.ok){
                const breeds = await response.json();
                currentBreed = breeds.data[Math.floor(Math.random() * breeds.data.length)];
                currentBreed.breedShortName = currentBreed.breed.split(/[(|,]/)[0];

                const patternText = currentBreed.pattern.toLowerCase() !== "all" ? " and a " + currentBreed.pattern.toLowerCase() + " pattern." : ` ${Math.random() < 0.5 ? "and they rock all kinds of different patterns" : "with a unique pattern"}.`;
                const caption = `*${Math.random() < 0.5 ? "😼 Meow there!" : "😸 How it's going?"}*\n\n${Math.random() < 0.5 ? "I hereby declare today as the" : "Did you know that today is the"} day of the *${currentBreed.breed}*. ${currentBreed.breedShortName} is a ${Math.random() < 0.5 ? "beautiful" : "lovely"} breed ${currentBreed.country.includes("developed in") ? "" : "from "}${currentBreed.country || "unknown origin"}. ${currentBreed.breedShortName} cats ${Math.random() < 0.5 ? "usually" : "often"} have a ${currentBreed.coat.toLowerCase() || "very short"} ${Math.random() < 0.5 ? "coat" : "fur"}${currentBreed.pattern ? patternText : "."}`;

                const imageUrl = await getPictureOfBreed();
                if(imageUrl){
                    await telegram.sendPhoto(channelId,imageUrl,{
                        caption: caption,
                        parse_mode: "Markdown",
                        reply_markup: moreLikeThisButton(false).reply_markup
                    });
                }
                else{
                    console.warn("It seems that getting the image failed");
                    await telegram.sendMessage(channelId,caption,{
                        parse_mode: "Markdown",
                        reply_markup: moreLikeThisButton(true).reply_markup
                    });
                }
                startLoop();

                ctx.reply("Posted!");
            }
            else{
                console.warn(`Cat Facts API HTTP response code was ${response.status}`);
                ctx.reply(`Cat Facts API HTTP response code was ${response.status}`);
            }
        }
        catch(error){
            console.error(error);
            ctx.reply("Failed! Please check the server console for more information.");
        }
    }
    else{
        ctx.reply("I'm meow sorry, but you are not my master.");
    }
});

bot.command("/add",(ctx) => {
    ctx.reply(`You tried to add the following fact: __${ctx.update.message.text.replace(/\/add/i,"")}__\n\nThis feature is still under development.`,{
        parse_mode: "Markdown"
    });
});

// Inline keyboard actions
bot.action(/^[voting]+(-[a-z]+)+(-[a-z0-9]+)?$/,async (ctx) => {
    const splitted = ctx.match[0].split("-");
    //console.log(splitted);
    const result = await dbHelper.addVote(splitted[2],ctx.update.callback_query.from.id,splitted[1]);
    switch(result.status){
        case "ok":
            try{
                const isUpvote = splitted[1] === "like";
                if(isUpvote){
                    await ctx.editMessageReplyMarkup(getLikeButton(splitted[2],result.upvotes));
                }
                ctx.answerCbQuery(`Thank you for your feedback! ${isUpvote ? "Glad you liked it 😻" : "I try to do better next time 😿"}`);
                if(ctx.update.callback_query.from.id !== ALLOWED_USER_ID){
                    telegram.sendMessage(PRIVATE_CHAT_ID,(`${ctx.update.callback_query.from.first_name || ""} ${ctx.update.callback_query.from.last_name || ""} ${ctx.update.callback_query.from.username ? "(@" + ctx.update.callback_query.from.username + ")" : ""} just ${isUpvote ? "upvoted" : "downvoted"}`).replace("  "," "));
                }
            }
            catch(error){
                ctx.answerCbQuery("Error while registering your vote. Please try again later.");
                console.error(error);
            }
            break;
        case "alreadyVoted":
            ctx.answerCbQuery("Sorry, you have already given your vote for this post.");
            break;
        case "error":
            ctx.answerCbQuery("Error while registering your vote. Please try again later.");
            break;
        case "notFound":
                ctx.answerCbQuery("Error while registering your vote.");
                break;
        default:
            console.error(`Unknown result ${result} from dbHelper`);
            ctx.answerCbQuery("System error while registering your vote. Please contact administrator.");
    }
});

// Debug
bot.command("/ping",async (ctx) => {
    //console.log(ctx.update);
    //const result = await telegram.sendMessage(PRIVATE_CHAT_ID,"Hello World!");
    //console.log(result);
    const chatMembers = await telegram.getChatMembersCount(channelId);
    ctx.reply(`😸 ${chatMembers}\nOffline facts: ${offlineFacts.length}`);
});
bot.command("/fact",async (ctx) => {
    const fact = await getCatFact();
    if(fact){
        ctx.reply(fact);
    }
    else{
        ctx.reply("Failed! Please check the server console for more information.");
    }
});

bot.launch().then(() => {
    http.createServer((req,res) => {
        res.write("Nothing to see here!");
        res.end();
    }).listen(port);

    console.info("Bot started");
    //telegram.sendMessage(PRIVATE_CHAT_ID,"Bot started");

    stickerSetNames.forEach((stickerSetName) => {
        telegram.getStickerSet(stickerSetName).then((stickerSet) => {
            // OK
            stickerSets.push.apply(stickerSets,stickerSet.stickers);
        }).catch(error => console.error(error));
    });

    telegram.getChatMembersCount(channelId).then((count) => {
        maxFakeUpvotes = Math.ceil(count > 0 ? count / 2 : 0);
    }).catch(error => console.error(error));
}).catch((error) => {
    throw error;
});

// ### FUNCTIONS ###
function authUser(id,username){
    if(id === ALLOWED_USER_ID && username === ALLOWED_USERNAME){
        return true;
    }
    else{
        console.warn(`Unauthenticated user ${username} (${id}) tried to control the bot`);
        return false;
    }
}

async function getCatFact(loopIndex = 0,offlineOnly = false){
    if(offlineOnly || (offlineFacts && Math.random < 0.90)){
        const fact = getOfflineFact();
        if(await checkIfFactAlreadyPosted(fact)){
            if(loopIndex >= 20){
                return Math.random() < 0.75 ? fact : null;
            }
            else if(loopIndex >= 19){
                telegram.sendMessage(PRIVATE_CHAT_ID,`Fact already posted! Getting a new one. Try ${loopIndex + 1}/20`);
            }
            return await getCatFact(loopIndex + 1);
        }
        else{
            return fact;
        }
    }
    else{
        try{
            const response = await fetch(`${catFactsAPIUrl}/fact`);
            if(response.ok){
                const fact = await response.json();
                if(await checkIfFactAlreadyPosted(fact.fact)){
                    if(loopIndex >= 20){
                        return Math.random() < 0.75 ? fact.fact : null;
                    }
                    else if(loopIndex >= 19){
                        telegram.sendMessage(PRIVATE_CHAT_ID,`Fact already posted! Getting a new one. Try ${loopIndex + 1}/20`);
                    }
                    return await getCatFact(loopIndex + 1);
                }
                else{
                    return fact.fact;
                }
            }
            else{
                console.warn(`Cat Facts API HTTP response code was ${response.status}`);
                return getCatFact(loopIndex + 1,true);
            }
        }
        catch(error){
            console.error(error);
            return getCatFact(loopIndex + 1,true);
        }
    }
}
function getOfflineFact(){
    if(offlineFacts){
        return `${offlineFacts[Math.floor(Math.random() * offlineFacts.length)]}`;
    }
    else{
        return null;
    }
}
async function checkIfFactAlreadyPosted(text){
    const result = await dbHelper.findByText(text);
    if(Array.isArray(result)){
        return result.length;
    }
    else{
        telegram.sendMessage(PRIVATE_CHAT_ID,`Error while checking if the fact is already posted`);
        return 0;
    }
}

async function getRandomCatPicture(APIUrl){
    if(!APIUrl){
        APIUrl = `${CATAAS_APIUrl}/cat`;
    }

    try{
        const response = await fetch(APIUrl);
        if(response.ok){
            const binary = await response.buffer();
            const filename = `picture_${new Date().getTime()}`;
            fs.writeFileSync(filename,binary,"binary");
                setTimeout(() => {
                    try{
                        fs.unlinkSync(`./${filename}`);
                    }
                    catch(error){
                        console.warn(error);
                    }
                },60000);
            return filename;
        }
        else{
            console.error(`${APIUrl} returned status code ${response.status}`);
            if(APIUrl.includes(CATAAS_APIUrl)){
                console.info(`CATAAS is down! Trying to get image from ${TCDNE_APIUrl}`);
                return await getRandomCatPicture(TCDNE_APIUrl);
            }
            else{
                return null;
            }
        }
    }
    catch(error){
        console.error(error);
        if(APIUrl.includes(CATAAS_APIUrl)){
            console.info(`CATAAS is down! Trying to get image from ${TCDNE_APIUrl}`);
            return await getRandomCatPicture(TCDNE_APIUrl);
        }
        else{
            return null;
        }
    }
}
async function getPictureOfBreed(){
    try{
        const response = await fetch(`${googleCustomSearchAPIUrl}?q=${currentBreed.breedShortName} cat&num=5&searchType=image&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}`);

        if(response.ok){
            const items = await response.json();
            return items.items[Math.floor(Math.random() * items.items.length)].link;
        }
        else{
            console.warn(`Google custom search response code was ${response.status}`);
            return null;
        }
    }
    catch(error){
        console.error(error);
        return null;
    }
}

function moreLikeThisButton(noImage){
    return Telegraf.Markup.inlineKeyboard([
        Telegraf.Markup.urlButton(`See${noImage ? "" : " more"} pictures of ${currentBreed.breedShortName}`,`https://www.google.com/search?tbm=isch&q=${currentBreed.breedShortName} cat`)
    ]).extra();
}

function getLikeButton(factId,upvotes){
    if(factId === null){
        factId = "noId"
    }

    return Telegraf.Markup.inlineKeyboard([
        Telegraf.Markup.callbackButton(`👍 ${upvotes || ""}`,`voting-like-${factId}`),
        Telegraf.Markup.callbackButton(`👎`,`voting-dislike-${factId}`)
    ]);
}

async function updateLikeButtonWithFakeUpvotes(factId, messageId){
    const result = await dbHelper.getVotes(factId);
    if(result.status === "ok"){
        telegram.editMessageReplyMarkup(channelId,messageId,null,getLikeButton(factId,result.upvotes));
    }
}

function startLoop(){
    clearTimeout(theLoop);
    theLoop = setTimeout(loop,Math.floor(Math.random() * 32000000) + 9000000);

    async function loop(){
        if(running){
            if(stickerSets.length && Math.random() < 0.5){
                telegram.sendSticker(channelId,stickerSets[Math.floor(Math.random() * stickerSets.length)].file_id,{
                    disable_notification: true
                }).catch((error) => {
                    console.error(error);
                });
            }

            theLoop = setTimeout(async () => {
                let savedFact;
                let sentMessage;

                try{
                    const fact = await getCatFact();
                    if(fact){
                        savedFact = await dbHelper.saveFact(fact,maxFakeUpvotes);
                        const imageFileName = await getRandomCatPicture();
                        if(imageFileName){
                            await telegram.sendPhoto(channelId,{
                                source: fs.readFileSync(`./${imageFileName}`)
                            });
                            const emoji = Math.random() < 0.5 ? `${Math.random() < 0.5 ? "😸" : "😺"}` : `${Math.random() < 0.5 ? "🐱" : "🐈"}`;
                            sentMessage = await telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? emoji + " Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                                parse_mode: "Markdown",
                                reply_markup: getLikeButton(savedFact.id)
                            });
                        }
                        else{
                            console.warn("It seems that getting the image failed");
                            telegram.sendMessage(PRIVATE_CHAT_ID,"Getting image from both CATAAS and TCDNE failed! Please check the server console for more information.");
                            sentMessage = await telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                                parse_mode: "Markdown",
                                reply_markup: getLikeButton(savedFact.id)
                            });
                        }
                    }
                }
                catch(error){
                    console.error(error);
                    telegram.sendMessage(PRIVATE_CHAT_ID,"Interval failed! Please check the server console for more information.");
                }

                if(sentMessage && savedFact){
                    setTimeout(() => {
                        updateLikeButtonWithFakeUpvotes(savedFact.id,sentMessage.message_id);
                    },900000);
                }
            },300000);

            setTimeout(loop,Math.floor(Math.random() * 32000000) + 9000000);
        }
    }
}