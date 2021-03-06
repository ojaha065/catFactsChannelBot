/* eslint-disable no-param-reassign */
/* eslint-disable camelcase */
/* eslint-disable no-use-before-define */

"use strict";

// Jani Haiko, 2019 - 2020

if (process.env.NODE_ENV !== "production") {
	// eslint-disable-next-line node/no-unpublished-require
	require("dotenv").config();
}

const fs = require("fs");
const http = require("http");
const fetch = require("node-fetch");
const Telegraf = require("telegraf");
const Telegram = Telegraf.Telegram;

const Utils = require("./utils");
const utils = new Utils();

const catFactsAPIUrl = "https://catfact.ninja";
const CATAAS_APIUrl = "https://cataas.com";
const googleCustomSearchAPIUrl = "https://www.googleapis.com/customsearch/v1";
const TCDNE_APIUrl = "https://thiscatdoesnotexist.com/";
const randomDotCat_APIUrl = "http://aws.random.cat/meow";
let triedAPIs = [];

const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
	throw new Error("Missing API_TOKEN");
}
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
	throw new Error("Missing GOOGLE_API_KEY");
}
const GOOGLE_CX = process.env.GOOGLE_CX;

if (!GOOGLE_CX) {
	throw new Error("Missing GOOGLE_CX");
}
const HEROKU_URL = process.env.HEROKU_URL;
let ALLOWED_USER_ID = process.env.ALLOWED_USER_ID;

if (!ALLOWED_USER_ID) {
	throw new Error("Missing ALLOWED_USER_ID");
} else {
	ALLOWED_USER_ID = Number(ALLOWED_USER_ID);
}
const ALLOWED_USERNAME = process.env.ALLOWED_USERNAME;

if (!ALLOWED_USERNAME) {
	throw new Error("Missing ALLOWED_USER_NAME");
}
const PRIVATE_CHAT_ID = process.env.PRIVATE_CHAT_ID;

if (!PRIVATE_CHAT_ID) {
	throw new Error("Missing PRIVATE_CHAT_ID");
}
if (!process.env.MONGO_URL || !process.env.DB_USERNAME || !process.env.DB_PASSWORD) {
	throw new Error("Missing Mongo url/username/password");
}

const port = process.env.PORT || 8000;
const channelId = "@CatFactsChannel";

const stickerSetNames = [
	"PussyCat", "cat_Persik",
	"avesta_us52", "nekoatsumeofficialstickers",
	"Cat_fullmoon", "nekoatsumepack",
	"BlueCat", "MemeCat",
	"simonscatt", "simons2",
	"cat_collection", "SuperSadCats",
	"MoarKittyMeme", "PopTartCat",
	"catcapoo", "Blicepack",
	"stpcts", "real_cats",
	"MarseyCat", "UsamaruUsamaru",
	"katyscats", "PinkPussyCat",
	"Caticker", "Octotickers",
	"BrokenCats"
];

if (HEROKU_URL) {
	setInterval(() => {
		console.info("Just keeping myself alive");
		try {
			fetch(HEROKU_URL);
		} catch (error) {
			console.error(error);
		}
	}, 600000);
}

let maxFakeUpvotes = 10;

const bot = new Telegraf(API_TOKEN);
const telegram = new Telegram(API_TOKEN);

const dbHelper = require("./dbHelper.js");

const breedTimer = 1000 * 60 * 60 * 24 * 7;

let running = true;
let currentBreed;
let stickerSets = [];

// Offline facts
let offlineFacts;

fs.readFile("./offlineFacts.json", "UTF-8", (error, data) => {
	if (!error) {
		offlineFacts = JSON.parse(data);
	} else {
		console.error(error);
	}
});

const loopTimer = new utils.Timer(loop).start();

bot.start(ctx => {
	if (authUser(ctx.update.message.from.id, ctx.update.message.from.username)) {
		if (!running) {
			ctx.reply("Starting...");
			running = true;

			loopTimer.start();
		} else {
			ctx.reply("Already running!");
		}
	} else {
		ctx.reply("Meow there! I don't have time to chat with a mere human. Please go to @CatFactsChannel");
	}
});
bot.command("/stop", ctx => {
	if (authUser(ctx.update.message.from.id, ctx.update.message.from.username)) {
		ctx.reply("Stopping...");
		loopTimer.stop();
		running = false;
	} else {
		ctx.reply("No, you stop that");
	}
});

bot.command("/post", ctx => {
	if (authUser(ctx.update.message.from.id, ctx.update.message.from.username)) {
		ctx.reply("OK! Posting...");

		setTimeout(async() => {
			let savedFact;
			let sentMessage;

			try {
				const fact = await getCatFact();

				if (fact) {
					savedFact = await dbHelper.saveFact(fact, maxFakeUpvotes);
					triedAPIs = [];
					const imageFileName = await getRandomCatPicture();

					if (imageFileName) {
						await telegram.sendPhoto(channelId, {
							source: fs.readFileSync(`${imageFileName}`)
						});
					} else {
						console.warn("It seems that getting the image failed");
						telegram.sendMessage(PRIVATE_CHAT_ID, "Getting image from both CATAAS and TCDNE failed! Please check the server console for more information.");
						sentMessage = await telegram.sendMessage(channelId, `*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`, {
							parse_mode: "Markdown"
						});
					}

					const emoji = Math.random() < 0.5 ? `${Math.random() < 0.5 ? "😸" : "😺"}` : `${Math.random() < 0.5 ? "🐱" : "🐈"}`;

					sentMessage = await telegram.sendMessage(channelId, `*${Math.random() < 0.5 ? `${emoji} Did you know that...` : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`, {
						parse_mode: "Markdown"
					});

					loopTimer.resetRandom();
				}
			} catch (error) {
				console.error(error);
				ctx.reply("Failed! Please check the server console for more information.");
			}

			if (sentMessage && savedFact) {
				addVoteButtons(savedFact.id, sentMessage.message_id, 5000);
			}
		}, 3000);
	} else {
		ctx.reply("Sorry, you are not allowed to use that command right now.");
	}
});

bot.command("/breed", async ctx => {
	if (authUser(ctx.update.message.from.id, ctx.update.message.from.username)) {
		if (await postDailyBreed(ctx)) {
			ctx.reply("Posted!");
		}
	} else {
		ctx.reply("I'm meow sorry, but you are not my master.");
	}
});

bot.command("/add", ctx => {
	ctx.reply(`You tried to add the following fact: __${ctx.update.message.text.replace(/\/add/iu, "")}__\n\nThis feature is still under development.`, {
		parse_mode: "Markdown"
	});
});

// Inline keyboard actions
bot.action(/^[voting]+(-[a-z]+)+(-[a-z0-9]+)?$/u, async ctx => {
	const splitted = ctx.match[0].split("-");

	// console.log(splitted);
	const result = await dbHelper.addVote(splitted[2], ctx.update.callback_query.from.id, splitted[1]);

	switch (result.status) {
	case "ok":
		try {
			const isUpvote = splitted[1] === "like";

			if (isUpvote) {
				await ctx.editMessageReplyMarkup(getLikeButton(splitted[2], result.upvotes));
			}
			ctx.answerCbQuery(`Thank you for your feedback! ${isUpvote ? "Glad you liked it 😻" : "I try to do better next time 😿"}`);
			if (ctx.update.callback_query.from.id !== ALLOWED_USER_ID) {
				telegram.sendMessage(PRIVATE_CHAT_ID, (`${ctx.update.callback_query.from.first_name || ""} ${ctx.update.callback_query.from.last_name || ""} ${ctx.update.callback_query.from.username ? `(@${ctx.update.callback_query.from.username})` : ""} just ${isUpvote ? "upvoted" : "downvoted"}`).replace("  ", " "));
			}
		} catch (error) {
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
bot.command("/ping", async ctx => {

	// console.log(ctx.update);
	// const result = await telegram.sendMessage(PRIVATE_CHAT_ID,"Hello World!");
	// console.log(result);
	const chatMembers = await telegram.getChatMembersCount(channelId);

	ctx.reply(`😸 ${chatMembers}\nOffline facts: ${offlineFacts.length}`);
	getCatFact();
});
bot.command("/fact", async ctx => {
	const fact = await getCatFact();

	if (fact) {
		ctx.reply(fact);
	} else {
		ctx.reply("Failed! Please check the server console for more information.");
	}
});

bot.launch().then(() => {
	http.createServer((req, res) => {
		res.write("Nothing to see here!");
		res.end();
	}).listen(port);

	console.info("Bot started");

	// telegram.sendMessage(PRIVATE_CHAT_ID,"Bot started");

	stickerSetNames.forEach(stickerSetName => {
		telegram.getStickerSet(stickerSetName).then(stickerSet => {

			// OK
			stickerSets = [...stickerSets, ...stickerSet.stickers];
		}).catch(error => console.error(error));
	});

	telegram.getChatMembersCount(channelId).then(count => {
		maxFakeUpvotes = Math.ceil(count > 0 ? count / 2 : 0);
	}).catch(error => console.error(error));
}).catch(error => {
	throw error;
});

// ### FUNCTIONS ###

/**
 * Checks is this user allowed the control the bot
 * @param {string} id user id
 * @param {string} username user's username
 * @returns {boolean} boolean
 */
function authUser(id, username) {
	if (id === ALLOWED_USER_ID && username === ALLOWED_USERNAME) {
		return true;
	}
	console.warn(`Unauthenticated user ${username} (${id}) tried to control the bot`);
	return false;

}

const facts = [];

/** Gets fact
 * @param {number} loopIndex
 * @param offlineOnly
 * @returns {string} fact
 */
async function getCatFact(loopIndex = 0, offlineOnly = false) {
	if (!loopIndex) {
		facts.splice(0, facts.length);
	}

	if (offlineOnly || (offlineFacts && Math.random < 0.65)) {
		const fact = getOfflineFact();
		const timesPosted = await checkIfFactAlreadyPosted(fact);
		const factObject = { fact, timesPosted };

		facts.push(factObject);

		if (timesPosted) {
			if (loopIndex >= 30) {
				return facts.length > 1 ? facts.sort((a, b) => a.timesPosted - b.timesPosted)[0].fact : facts[0].fact;
			}
			if (loopIndex >= 29) {
				telegram.sendMessage(PRIVATE_CHAT_ID, `Fact already posted! Getting a new one. Try ${loopIndex + 1}/30`);
			}
			return await getCatFact(loopIndex + 1);
		}
		return fact;

	}
	try {
		const response = await fetch(`${catFactsAPIUrl}/fact`);

		if (response.ok) {
			const fact = await response.json();
			const timesPosted = await checkIfFactAlreadyPosted(fact.fact);
			const factObject = {
				fact: fact.fact,
				timesPosted
			};

			facts.push(factObject);

			if (timesPosted) {
				if (loopIndex >= 30) {
					return facts.length > 1 ? facts.sort((a, b) => a.timesPosted - b.timesPosted)[0].fact : facts[0].fact;
				}
				if (loopIndex >= 29) {
					telegram.sendMessage(PRIVATE_CHAT_ID, `Fact already posted! Getting a new one. Try ${loopIndex + 1}/30`);
				}
				return await getCatFact(loopIndex + 1);
			}
			return fact.fact;

		}
		console.warn(`Cat Facts API HTTP response code was ${response.status}`);
		return getCatFact(loopIndex, true);

	} catch (error) {
		console.error(error);
		return getCatFact(loopIndex + 1, true);
	}

}

function getOfflineFact() {
	if (offlineFacts) {
		return `${offlineFacts[Math.floor(Math.random() * offlineFacts.length)]}`;
	}
	return null;

}

/**
 * @param text
 */
async function checkIfFactAlreadyPosted(text) {
	const result = await dbHelper.findByText(text);

	if (Array.isArray(result)) {
		return result.length;
	}
	telegram.sendMessage(PRIVATE_CHAT_ID, "Error while checking if the fact is already posted");
	return 0;

}

/**
 * @param APIUrl
 */
async function getRandomCatPicture(APIUrl) {
	if (!APIUrl) {
		const randomNumber = Math.random();

		if (randomNumber <= 0.5) {
			APIUrl = `${CATAAS_APIUrl}/cat`;
		} else if (randomNumber <= 0.95) {
			APIUrl = randomDotCat_APIUrl;
		} else {
			APIUrl = TCDNE_APIUrl;
		}
	}

	console.debug(`Using API ${APIUrl}`);
	triedAPIs.push(APIUrl);

	try {
		let response = await fetch(APIUrl);

		if (response.ok) {
			if (APIUrl === randomDotCat_APIUrl) {
				const json = await response.json();

				response = await fetch(json.file);
			}

			const binary = await response.buffer();
			const filename = `picture_${new Date().getTime()}`;

			fs.writeFileSync(filename, binary, "binary");
			setTimeout(() => {
				try {
					fs.unlinkSync(`./${filename}`);
				} catch (error) {
					console.warn(error);
				}
			}, 60000);
			return filename;
		}
		console.error(`${APIUrl} returned status code ${response.status}`);

		if (!triedAPIs.includes(`${CATAAS_APIUrl}/cat`)) {
			console.info(`${APIUrl} is down! Trying to get image from ${CATAAS_APIUrl}`);
			return await getRandomCatPicture(`${CATAAS_APIUrl}/cat`);
		}
		if (!triedAPIs.includes(randomDotCat_APIUrl)) {
			console.info(`${APIUrl} is down! Trying to get image from ${randomDotCat_APIUrl}`);
			return await getRandomCatPicture(randomDotCat_APIUrl);
		}
		if (!triedAPIs.includes(TCDNE_APIUrl)) {
			console.info(`${APIUrl} is down! Trying to get image from ${TCDNE_APIUrl}`);
			return await getRandomCatPicture(TCDNE_APIUrl);
		}
		return null;


	} catch (error) {
		console.error(error);
		if (!triedAPIs.includes(`${CATAAS_APIUrl}/cat`)) {
			console.info(`${APIUrl} is down! Trying to get image from ${CATAAS_APIUrl}`);
			return await getRandomCatPicture(`${CATAAS_APIUrl}/cat`);
		}
		if (!triedAPIs.includes(randomDotCat_APIUrl)) {
			console.info(`${APIUrl} is down! Trying to get image from ${randomDotCat_APIUrl}`);
			return await getRandomCatPicture(randomDotCat_APIUrl);
		}
		if (!triedAPIs.includes(TCDNE_APIUrl)) {
			console.info(`${APIUrl} is down! Trying to get image from ${TCDNE_APIUrl}`);
			return await getRandomCatPicture(TCDNE_APIUrl);
		}
		return null;

	}
}

async function postDailyBreed() {
	try {
		const response = await fetch(`${catFactsAPIUrl}/breeds?page=${Math.floor(Math.random() * 4) + 1}`);

		if (response.ok) {
			const breeds = await response.json();

			currentBreed = breeds.data[Math.floor(Math.random() * breeds.data.length)];
			currentBreed.breedShortName = currentBreed.breed.split(/[(|,]/u)[0];

			const patternText = currentBreed.pattern.toLowerCase() !== "all" ? ` and a ${currentBreed.pattern.toLowerCase()} pattern.` : ` ${Math.random() < 0.5 ? "and they rock all kinds of different patterns" : "with a unique pattern"}.`;
			const caption = `*${Math.random() < 0.5 ? "😼 Meow there!" : "😸 How it's going?"}*\n\n${Math.random() < 0.5 ? "I hereby declare today as the" : "Did you know that today is the"} day of the *${currentBreed.breed}*. ${currentBreed.breedShortName} is a ${Math.random() < 0.5 ? "beautiful" : "lovely"} breed ${currentBreed.country.includes("developed in") ? "" : "from "}${currentBreed.country || "unknown origin"}. ${currentBreed.breedShortName} cats ${Math.random() < 0.5 ? "usually" : "often"} have a ${currentBreed.coat.toLowerCase() || "very short"} ${Math.random() < 0.5 ? "coat" : "fur"}${currentBreed.pattern ? patternText : "."}`;

			const imageUrl = await getPictureOfBreed();

			if (imageUrl) {
				await telegram.sendPhoto(channelId, imageUrl, {
					caption,
					parse_mode: "Markdown",
					reply_markup: moreLikeThisButton(false).reply_markup
				});
			} else {
				console.warn("It seems that getting the image failed");
				await telegram.sendMessage(channelId, caption, {
					parse_mode: "Markdown",
					reply_markup: moreLikeThisButton(true).reply_markup
				});
			}
			loopTimer.resetRandom();

			dbHelper.updateLastBreedDate(new Date());
			return true;
		}
		console.warn(`Cat Facts API HTTP response code was ${response.status}`);
		telegram.sendMessage(PRIVATE_CHAT_ID, `Cat Facts API HTTP response code was ${response.status}`);

	} catch (error) {
		console.error(error);
		telegram.sendMessage(PRIVATE_CHAT_ID, "Daily Breed failed! Please check the server console for more information.");
	}

	return false;
}

async function getPictureOfBreed() {
	try {
		const response = await fetch(`${googleCustomSearchAPIUrl}?q=${currentBreed.breedShortName} cat&num=5&searchType=image&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}`);

		if (response.ok) {
			const items = await response.json();

			return items.items[Math.floor(Math.random() * items.items.length)].link;
		}
		console.warn(`Google custom search response code was ${response.status}`);
		return null;

	} catch (error) {
		console.error(error);
		return null;
	}
}

/**
 * @param noImage
 */
function moreLikeThisButton(noImage) {
	return Telegraf.Markup.inlineKeyboard([
		Telegraf.Markup.urlButton(`See${noImage ? "" : " more"} pictures of ${currentBreed.breedShortName}`, `https://www.google.com/search?tbm=isch&q=${currentBreed.breedShortName} cat`)
	]).extra();
}

/**
 * @param factId
 * @param upvotes
 */
function getLikeButton(factId, upvotes) {
	if (factId === null) {
		factId = "noId";
	}

	return Telegraf.Markup.inlineKeyboard([
		Telegraf.Markup.callbackButton(`👍 ${upvotes || ""}`, `voting-like-${factId}`),
		Telegraf.Markup.callbackButton("👎", `voting-dislike-${factId}`)
	]);
}

/**
 * @param factId
 * @param messageId
 */
async function updateLikeButtonWithFakeUpvotes(factId, messageId) {
	const result = await dbHelper.getVotes(factId);

	if (result.status === "ok") {
		telegram.editMessageReplyMarkup(channelId, messageId, null, getLikeButton(factId, result.upvotes));
	}
}

/**
 * @param factId
 * @param messageId
 * @param updateTimeout
 */
async function addVoteButtons(factId, messageId, updateTimeout) {
	telegram.editMessageReplyMarkup(channelId, messageId, null, getLikeButton(factId)).then(() => {
		setTimeout(() => {
			updateLikeButtonWithFakeUpvotes(factId, messageId);
		}, updateTimeout);
	}).catch(error => console.error(error));
}

async function loop() {
	const lastBreedTime = await dbHelper.getLastBreedDate();

	if (Math.random() > 0.5 && new Date().getTime() - lastBreedTime.getTime() > breedTimer) {
		if (await postDailyBreed()) {
			return;
		}
	}

	if (stickerSets.length && Math.random() < 0.5) {
		telegram.sendSticker(channelId, stickerSets[Math.floor(Math.random() * stickerSets.length)].file_id, {
			disable_notification: true
		}).catch(error => {
			console.error(error);
		});
	}

	setTimeout(async() => {
		let savedFact;
		let sentMessage;

		try {
			const fact = await getCatFact();

			if (fact) {
				savedFact = await dbHelper.saveFact(fact, maxFakeUpvotes);
				triedAPIs = [];
				const imageFileName = await getRandomCatPicture();

				if (imageFileName) {
					await telegram.sendPhoto(channelId, {
						source: fs.readFileSync(`./${imageFileName}`)
					});
					const emoji = Math.random() < 0.5 ? `${Math.random() < 0.5 ? "😸" : "😺"}` : `${Math.random() < 0.5 ? "🐱" : "🐈"}`;

					sentMessage = await telegram.sendMessage(channelId, `*${Math.random() < 0.5 ? `${emoji} Did you know that...` : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`, {
						parse_mode: "Markdown"
					});
				} else {
					console.warn("It seems that getting the image failed");
					telegram.sendMessage(PRIVATE_CHAT_ID, "Getting image from both CATAAS and TCDNE failed! Please check the server console for more information.");
					sentMessage = await telegram.sendMessage(channelId, `*${Math.random() < 0.5 ? "Did you know that..." : `Cat Fact #${Math.floor(Math.random() * 99999)}`}*\n\n${fact}`, {
						parse_mode: "Markdown",
						reply_markup: getLikeButton(savedFact.id)
					});
				}
			}
		} catch (error) {
			console.error(error);
			telegram.sendMessage(PRIVATE_CHAT_ID, "Interval failed! Please check the server console for more information.");
		}

		if (sentMessage && savedFact) {
			addVoteButtons(savedFact.id, sentMessage.message_id, 5000);

			if (Math.random() < 0.5) {
				loopTimer.resetRandom();
			}
		} else {
			console.debug(sentMessage, savedFact);
			telegram.sendMessage(PRIVATE_CHAT_ID, "It seems that the message was not sent or the fact was not saved.");
		}
	}, 300000);
}