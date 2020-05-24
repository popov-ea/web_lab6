const MongoClient = require("mongodb").MongoClient;
const fs = require("fs");
const CsvReadedableStream = require("csv-reader");
const natural = require("natural");
const bayes = require("bayes");

let mongoClient = new MongoClient('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true});

exports.index = function (request, response) {
    response.render("index");
}

exports.addArticlePage = function (request, response) {
    response.render("addArticle");
}

exports.addArticle = function (request, response) {
    natural.BayesClassifier.load("classifier.json", null, (err, classifier) => {
        const classificationResult = classifier.getClassifications(request.body.articleText);
        const articleInfo = {
            text: request.body.articleText,
            class: request.body.class,
            classificationResult: classificationResult
        };
        const res = classifier.classify(request.body.articleText);
        console.log(res);
        mongoClient.connect()
            .then((c) => {
                const db = c.db("web_lab6");
                const collection = db.collection("articles");
                return collection.insertOne(articleInfo);
            })
            .then(() => response.render("classificationResult", {
                text: articleInfo.text,
                firstClassValue: classificationResult.find(x => x.label === "1").value,
                secondClassValue: classificationResult.find(x => x.label === "2").value,
                thirdClassValue: classificationResult.find(x => x.label === "3").value,
                fourthClassValue: classificationResult.find(x => x.label === "4").value
            }));
    })
}

exports.train = function (request, response) {
    const nbcClassifier = new natural.BayesClassifier();
    const inputStream = fs.createReadStream("train.csv", "utf-8");

    inputStream.pipe(new CsvReadedableStream({
        trim: true,
        skipHeader: true,
        delimiter: ";"
    })).on("data", function (raw) {
        const txtClass = raw.pop();
        const fullText = raw.join(" ");
        console.log(fullText);

        nbcClassifier.addDocument(fullText, txtClass);
    }).on("end", function () {
        nbcClassifier.train()
        nbcClassifier.save("classifier.json", (error, classifier) => {
            if (error) {
                response.write(error);
            } else {
                response.redirect("/");
            }
        })
    });
}

exports.getArticlesByCategory = function (request, response) {
    mongoClient.connect()
        .then((c) => 
            c.db("web_lab6")
                .collection("articles")
                .find({
                    class: request.params.category
                })
                .toArray()
        )
        .then((articles) => {
            response.render("articles", {
                articles: (articles || []).map(a => a.text)
            });
        })
}