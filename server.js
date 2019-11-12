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

const API_TOKEN = process.env.API_TOKEN;
if(!API_TOKEN){
    throw "Missing API_TOKEN";
}
const HEROKU_URL = process.env.HEROKU_URL;
if(!HEROKU_URL){
    throw "Missing HEROKU_URL";
}
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

setInterval(() => {
    console.info("Just keeping myself alive");
    try{
        request.get(HEROKU_URL);
    }
    catch(error){
        console.error(error);
    }
},600000);

const bot = new Telegraf(API_TOKEN);
const telegram = new Telegram(API_TOKEN);

let running = true;
let currentBreed;
let loop;
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
        ctx.reply("I'm meow sorry, but you are not my master.");
    }
});

bot.command("/post",async (ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        try{
            await ctx.reply("Sending a new cat fact now...");
            const fact = await getCatFact();
            const imageFileName = await getRandomCatPicture();
            if(imageFileName){
                await telegram.sendPhoto(channelId,{
                    source: fs.readFileSync(`./${imageFileName}`)
                });
                telegram.sendMessage(channelId,fact);
            }
            else{
                console.warn("It seems that getting the image failed");
                telegram.sendMessage(PRIVATE_CHAT_ID,"Getting image from CATAAS failed! Please check the server console for more information.");
                telegram.sendMessage(channelId,fact);
            }
        }
        catch(error){
            console.error(error);
            ctx.reply("Failed! Please check the server console for more information.");
        }
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
                currentBreed = breeds[Math.floor(Math.random() * breeds.length - 1)];
                await telegram.sendMessage(channelId,`Meow there! I hereby declare today as a day of the *${currentBreed.breed}*. ${currentBreed.breed} is a ${Math.random() < 0.5 ? "beautiful" : "lovely"} breed from ${currentBreed.country}. ${currentBreed.breed} cats usually have a ${currentBreed.coat.toLowerCase()} coat${currentBreed.pattern ? " and a " + currentBreed.pattern.toLowerCase() + " pattern." : "."}`,{
                    parse_mode: "Markdown"
                });
                ctx.reply("Posted!");
            }
            else{
                console.warn(`Cat Facts API HTTP response code was ${response.statusCode}`);
                telegram.sendMessage(PRIVATE_CHAT_ID,`Cat Facts API HTTP response code was ${response.statusCode}`);
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

bot.command("/ping",(ctx) => {
    //console.log(ctx.update);
    getRandomCatPicture()
    ctx.reply("pong!");
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
            return null;
        }
    }
    catch(error){
        console.error(error);
        return null;
    }
}
async function getRandomCatPicture(){
    try{
        const image = await request.get(`${CATAAS_APIUrl}/cat`,{
            encoding: "binary"
        });
        const filename = `CATAAS_${new Date().getTime()}`;
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
        return null;
    }
}

function startLoop(){
    loop = setInterval(async () => {
        if(running){
            try{
                const fact = await getCatFact();
                const imageFileName = await getRandomCatPicture();
                if(imageFileName){
                    await telegram.sendPhoto(channelId,{
                        source: fs.readFileSync(`./${imageFileName}`)
                    });
                    telegram.sendMessage(channelId,fact);
                }
                else{
                    console.warn("It seems that getting the image failed");
                    telegram.sendMessage(PRIVATE_CHAT_ID,"Getting image from CATAAS failed! Please check the server console for more information.");
                    telegram.sendMessage(channelId,fact);
                }
            }
            catch(error){
                console.error(error);
                ctx.reply("Interval failed! Please check the server console for more information.");
            }
        }
        else{
            clearInterval(loop);
        }
    },17280000);
}