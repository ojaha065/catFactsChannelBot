"use strict";

const mongoose = require("mongoose");

const url = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.MONGO_URL}/test?retryWrites=true&w=majority`;

const factSchema = new mongoose.Schema({
	text: String,
	voters: [String],
	upvotes: {
		type: Number,
		default: 0
	},
	downvotes: {
		type: Number,
		default: 0
	},
	fakeStarterUpvotes: {
		type: Number,
		default: 5
	}
});
const Fact = mongoose.model("Fact", factSchema);

const lastBreedSchema = new mongoose.Schema({
	date: Date
});
const LastBreed = mongoose.model("LastBreed", lastBreedSchema);

class Result {
	constructor(status, upvotes, downvotes) {
		this.status = status;
		this.upvotes = upvotes;
		this.downvotes = downvotes;
	}
}

mongoose.connect(url, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	keepAlive: true
}).then(() => {
	console.info("Connected to MongoDB");
}).catch(error => {
	console.error("Error connecting to MongoDB", error.message);
});

module.exports = {
	saveFact: (fact, maxFakeUpvotes) => {
		try {
			return new Fact({
				text: fact,
				fakeStarterUpvotes: Math.floor(Math.random() * (maxFakeUpvotes + 1))
			}).save();
		} catch (error) {
			console.error(error);
			return null;
		}
	},
	findByText: text => {
		try {
			return Fact.find({
				text
			}).exec();
		} catch (error) {
			console.error(error);
			return error;
		}
	},
	addVote: async(factId, voter, vote) => {
		try {
			const fact = await Fact.findById(factId);

			if (!fact) {
				return new Result("notFound", null, null);
			}

			if (!fact.voters.includes(voter)) {
				fact.voters.push(voter);
				fact[vote === "like" ? "upvotes" : "downvotes"]++;
				fact.save();
				return new Result("ok", fact.upvotes + fact.fakeStarterUpvotes, fact.downvotes);
			}

			return new Result("alreadyVoted", fact.upvotes + fact.fakeStarterUpvotes, fact.downvotes);

		} catch (error) {
			console.error(error);
			return new Result("error", null, null);
		}
	},
	getVotes: async factId => {
		try {
			const fact = await Fact.findById(factId);

			if (!fact) {
				console.warn(`Fact with id ${factId} not found`);
				return new Result("notFound", null, null);
			}

			return new Result("ok", fact.upvotes + fact.fakeStarterUpvotes, fact.downvotes);
		} catch (error) {
			console.error(error);
			return new Result("error", null, null);
		}
	},
	getLastBreedDate: async() => {
		let result;

		try {
			result = await LastBreed.findOne();
		} catch (error) {
			console.error(error);
		}

		return result ? result.date : new Date();
	},
	updateLastBreedDate: async newDate => {
		try {
			let result = await LastBreed.findOne();

			if (!result) {
				result = new LastBreed({
					date: newDate
				});
			} else {
				result.date = newDate;
			}

			result.save();
		} catch (error) {
			console.error(error);
		}
	}
};