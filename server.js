"use strict";

// Jani Haiko, 2019

if(process.env.NODE_ENV !== "production"){
    require("dotenv").config();
}

const fs = require("fs");
const http = require("http");
const request = require("request-promise");
const Telegraf = require("telegraf");
const Telegram = require("telegraf/telegram");

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

const port = process.env.PORT || 8000;
const channelId = "@CatFactsChannel";

const stickerSetNames = ["PussyCat","cat_Persik","avesta_us52","nekoatsumeofficialstickers","Cat_fullmoon","nekoatsumepack"];

if(HEROKU_URL){
    setInterval(() => {
        console.info("Just keeping myself alive");
        try{
            request.get(HEROKU_URL);
        }
        catch(error){
            console.error(error);
        }
    },600000);
}

const bot = new Telegraf(API_TOKEN);
const telegram = new Telegram(API_TOKEN);

let running = true;
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
})

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
        if(stickerSets.length){
            telegram.sendSticker(channelId,stickerSets[Math.floor(Math.random() * stickerSets.length)].file_id,{
                disable_notification: true
            }).catch((error) => {
                console.error(error);
            });
        }

        setTimeout(async () => {
            try{
                const fact = await getCatFact();
                const imageFileName = await getRandomCatPicture();
                if(imageFileName){
                    await telegram.sendPhoto(channelId,{
                        source: fs.readFileSync(`./${imageFileName}`)
                    });
                    telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                        parse_mode: "Markdown"
                    });
                }
                else{
                    console.warn("It seems that getting the image failed");
                    telegram.sendMessage(PRIVATE_CHAT_ID,"Getting image from both CATAAS and TCDNE failed! Please check the server console for more information.");
                    telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                        parse_mode: "Markdown"
                    });
                }
            }
            catch(error){
                console.error(error);
                ctx.reply("Failed! Please check the server console for more information.");
            }
        },300000);
    }
    else{
        ctx.reply("Sorry, you are not allowed to use that command right now.");
    }
});
bot.command("/breed",async (ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        try{
            const response = await request.get({
                uri: `${catFactsAPIUrl}/breeds?page=${Math.floor(Math.random() * 4) + 1}`,
                resolveWithFullResponse: true
            });
            if(response.statusCode === 200){
                const breeds = JSON.parse(response.body).data;
                currentBreed = breeds[Math.floor(Math.random() * breeds.length)];

                const breedShortName = currentBreed.breed.split("(")[0];
                const patternText = currentBreed.pattern.toLowerCase() !== "all" ? " and a " + currentBreed.pattern.toLowerCase() + " pattern." : ` ${Math.random() < 0.5 ? "and they rock all kinds of different patterns" : "with a unique pattern"}.`;
                const caption = `*${Math.random() < 0.5 ? "😼 Meow there!" : "😸 How it's going?"}*\n\n${Math.random() < 0.5 ? "I hereby declare today as the" : "Did you know that today is the"} day of the *${currentBreed.breed}*. ${breedShortName} is a ${Math.random() < 0.5 ? "beautiful" : "lovely"} breed ${currentBreed.country.includes("developed in") ? "" : "from "}${currentBreed.country || "unknown origin"}. ${breedShortName} cats ${Math.random() < 0.5 ? "usually" : "often"} have a ${currentBreed.coat.toLowerCase() || "very short"} ${Math.random() < 0.5 ? "coat" : "fur"}${currentBreed.pattern ? patternText : "."}`;

                const imageUrl = await getPictureOfBreed();
                if(imageUrl){
                    await telegram.sendPhoto(channelId,imageUrl,{
                        caption: caption,
                        parse_mode: "Markdown"
                    });
                }
                else{
                    console.warn("It seems that getting the image failed");
                    await telegram.sendMessage(channelId,caption,{
                        parse_mode: "Markdown"
                    });
                }

                ctx.reply("Posted!");
            }
            else{
                console.warn(`Cat Facts API HTTP response code was ${response.statusCode}`);
                ctx.reply(`Cat Facts API HTTP response code was ${response.statusCode}`);
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

// Debug
bot.command("/ping",(ctx) => {
    //console.log(ctx.update);
    ctx.reply("😸 pong!");
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
    telegram.sendMessage(PRIVATE_CHAT_ID,"Bot started");

    stickerSetNames.forEach((stickerSetName) => {
        telegram.getStickerSet(stickerSetName).then((stickerSet) => {
            // OK
            stickerSets.push.apply(stickerSets,stickerSet.stickers);
        }).catch(error => console.error(error));
    });
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

async function getCatFact(){
    if(offlineFacts && Math.random < 0.25){
        return getOfflineFact();
    }
    else{
        try{
            const response = await request.get({
                uri: `${catFactsAPIUrl}/fact`,
                resolveWithFullResponse: true
            });
            if(response.statusCode === 200){
                return JSON.parse(response.body).fact;
            }
            else{
                console.warn(`Cat Facts API HTTP response code was ${response.statusCode}`);
                return getOfflineFact();
            }
        }
        catch(error){
            console.error(error);
            return getOfflineFact();
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

async function getRandomCatPicture(APIUrl){
    if(!APIUrl){
        APIUrl = `${CATAAS_APIUrl}/cat`;
    }

    try{
        const image = await request.get(APIUrl,{
            encoding: "binary"
        });
        const filename = `picture_${new Date().getTime()}`;
        fs.writeFileSync(filename,image,"binary");
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
    catch(error){
        console.error(error);
        if(APIUrl.includes(CATAAS_APIUrl)){
            console.info(`CATAAS is down! Trying to get image from ${TCDNE_APIUrl}`);
            return getRandomCatPicture(TCDNE_APIUrl);
        }
        else{
            return null;
        }
    }
}
async function getPictureOfBreed(){
    try{
        const response = await request.get({
            uri: `${googleCustomSearchAPIUrl}?q=${currentBreed.breed} cat&num=5&searchType=image&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}`,
            resolveWithFullResponse: true
        });

        if(response.statusCode === 200){
            const items = JSON.parse(response.body).items;
            return items[Math.floor(Math.random() * items.length)].link;
        }
        else{
            console.warn(`Google custom search response code was ${response.statusCode}`);
            return null;
        }
    }
    catch(error){
        console.error(error);
        return null;
    }
}

function startLoop(){
    setTimeout(loop,3600000);

    async function loop(){
        if(running){
            if(stickerSets.length){
                telegram.sendSticker(channelId,stickerSets[Math.floor(Math.random() * stickerSets.length)].file_id,{
                    disable_notification: true
                }).catch((error) => {
                    console.error(error);
                });
            }

            setTimeout(async () => {
                try{
                    const fact = await getCatFact();
                    const imageFileName = await getRandomCatPicture();
                    if(imageFileName){
                        await telegram.sendPhoto(channelId,{
                            source: fs.readFileSync(`./${imageFileName}`)
                        });
                        telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                            parse_mode: "Markdown"
                        });
                    }
                    else{
                        console.warn("It seems that getting the image failed");
                        telegram.sendMessage(PRIVATE_CHAT_ID,"Getting image from both CATAAS and TCDNE failed! Please check the server console for more information.");
                        telegram.sendMessage(channelId,`*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`,{
                            parse_mode: "Markdown"
                        });
                    }
                }
                catch(error){
                    console.error(error);
                    telegram.sendMessage(PRIVATE_CHAT_ID,"Interval failed! Please check the server console for more information.");
                }
            },300000);

            setTimeout(loop,Math.floor(Math.random() * 30800000) + 3600000);
        }
    }
}