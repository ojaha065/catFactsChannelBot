"use strict";

// Jani Haiko, 2019

if(true){
    require("dotenv").config();
}

const request = require("request-promise");
const Telegraf = require("telegraf");

const catFactsAPIUrl = "https://catfact.ninja/";

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
if(!process.env.NO_WEBHOOK_NEEDED){
    bot.telegram.setWebhook(`${HEROKU_URL}/bot${API_TOKEN}`);
    bot.startWebhook(`/bot${API_TOKEN}`,null,port);
}

let running = false;

bot.start((ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        if(!running){
            ctx.reply("Starting...");
            running = true;
            ctx.telegram.sendMessage(channelId,"Bot started. Hello World!");

            const loop = setInterval(async () => {
                if(running){
                    const fact = await getCatFact();
                    ctx.telegram.sendMessage(channelId,fact);
                }
                else{
                    clearInterval(loop);
                }
            },17280000);
        }
        else{
            ctx.reply("Already running!");
        }
    }
    else{
        ctx.reply("Access denied");
    }
});
bot.command("/stop",(ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        ctx.reply("Stopping...");
        running = false;
    }
    else{
        ctx.reply("Access denied");
    }
});

bot.command("/post",async (ctx) => {
    if(authUser(ctx.update.message.from.id,ctx.update.message.from.username)){
        ctx.reply("Sending a new cat fact now...");
        const fact = await getCatFact();
        ctx.telegram.sendMessage(channelId,fact);
    }
    else{
        ctx.reply("Access denied");
    }
});

bot.command("/ping",(ctx) => {
    ctx.reply("pong!");
});
bot.command("/fact",async (ctx) => {
    const fact = await getCatFact();
    if(fact){
        ctx.reply(fact);
    }
    else{
        ctx.reply("Failed! Please check console");
    }
});

bot.launch().then(() => {
    console.info("Bot started");
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
            JSON.parse(response.body);
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