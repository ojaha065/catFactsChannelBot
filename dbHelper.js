"use strict";

const mongoose = require("mongoose");

const url = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.MONGO_URL}/test?retryWrites=true&w=majority`;

const factSchema = new mongoose.Schema({
    text: String
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
        new Fact({
            text: fact
        }).save();
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
    }
};