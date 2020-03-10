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
    }
});
const Fact = mongoose.model("Fact",factSchema);

mongoose.connect(url,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    keepAlive: true
}).then(() => {
    console.info("Connected to MongoDB");
}).catch(() => {
    console.error("Error connecting to MongoDB",error.message);
});

module.exports = {
    saveFact: (fact) => {
        try{
            return new Fact({
                text: fact
            }).save();
        }
        catch(error){
            console.error(error);
            return null;
        }
    },
    findByText:(text) => {
        try{
            return Fact.find({
                text: text
            }).exec();
        }
        catch(error){
            console.error(error);
            return [];
        }
    },
    addVote: async (factId,voter,vote) => {
        try{
            const fact = await Fact.findById(factId);
            if(!fact){
                return "notFound";
            }

            if(!fact.voters.includes(voter)){
                fact.voters.push(voter);
                fact[vote === "like" ? "upvotes" : "downvotes"]++;
                fact.save();
                return "ok";
            }
            else{
                return "alreadyVoted";
            }
        }
        catch(error){
            console.error(error);
            return "error";
        }
    }
};