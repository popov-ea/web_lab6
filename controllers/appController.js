const MongoClient = require("mongodb").MongoClient;
const fs = require("fs");
const CsvReadedableStream = require("csv-reader");
const natural = require("natural");
const bayes = require("bayes-multiple-categories");

let mongoClient = new MongoClient('mongodb://localhost:27017', { useNewUrlParser: true, useUnifiedTopology: true});

exports.index = function (request, response) {
    response.render("index");
}

exports.addArticlePage = function (request, response) {
    response.render("addArticle");
}

exports.addArticle = function (request, response) {
    const nbc = bayes.fromJson(fs.readFileSync("nbc.json"));
    nbc.categorizeMultiple(request.body.articleHeader + " " + request.body.articleKeywords + " " + request.body.articleText, 4)
        .then((classificationResult) => {
            const articleInfo = {
                header: request.body.articleHeader,
                keywords: request.body.articleKeywords,
                text: request.body.articleText,
                class: request.body.class,
                classificationResult: classificationResult
            };
            mongoClient.connect()
                .then((c) => {
                    const db = c.db("web_lab6");
                    const collection = db.collection("articles");
                    return collection.insertOne(articleInfo);
                })
                .then(() => response.render("classificationResult", {
                    text: articleInfo.text,
                    firstClassValue: classificationResult.find(x => x.category === "1").propability,
                    secondClassValue: classificationResult.find(x => x.category === "2").propability,
                    thirdClassValue: classificationResult.find(x => x.category === "3").propability,
                    fourthClassValue: classificationResult.find(x => x.category === "4").propability,

                    //в hbs нет возможности сравнить что-то в #if, надо писать хэлпер, поэтому пока так
                    isFirstClass: articleInfo.class === "1",
                    isSecondClass: articleInfo.class === "2",
                    isThirdClass: articleInfo.class === "3",
                    isFourthClass: articleInfo.class === "4"
                }));
        })
   
}

exports.addArticlesFromCsvPage = function (request, response) {
    response.render("addFromCsv");
}

exports.addArticlesFromCsv = function (request, response) {
    const inputStream = fs.createReadStream(request.file.path, "utf-8");
    const articles = [];
    const nbc = bayes.fromJson(fs.readFileSync("nbc.json"));

    inputStream.pipe(new CsvReadedableStream({
        trim: true,
        skipHeader: true,
        delimiter: ";"
    })).on("data", function (raw) {
        const txtClass = raw.pop();
        const header = raw.shift();
        const keywords = raw[0];
        const text = raw[1];

        nbc.categorizeMultiple(header + " " + keywords + " " + text, 4)
            .then((result) => {
                mongoClient.connect()
                    .then((c) => c.db("web_lab6").collection("articles").insertOne({
                        header: header,
                        keywords: keywords,
                        text: text,
                        class: txtClass,
                        classificationResult: result.map(x => {
                            //в библиотеке не используется вероятность класса, при подсчете. Поэтому добавил здесь
                            const classLogProb = Math.log(nbc.docCount[x.category] / nbc.totalDocuments);
                            x.propability = classLogProb + x.propability;
                            return x;
                        }).sort(x => -x.propability)
                    }));
            });
    }).on("end", function () { 
        response.redirect("/");
    });
}

exports.train = function (request, response) {
    const nbc = bayes();
    const inputStream = fs.createReadStream("train.csv", "utf-8");

    inputStream.pipe(new CsvReadedableStream({
        trim: true,
        skipHeader: true,
        delimiter: ";"
    })).on("data", function (raw) {
        const txtClass = raw.pop();
        const fullText = raw.join(" ");
        nbc.learn(fullText, txtClass);
    }).on("end", function () {
        fs.writeFile("nbc.json", nbc.toJson(), () => response.redirect("/"));        
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
                articles: (articles || [])
            });
        })
}

exports.getStatistic = function (request, response) {
    mongoClient.connect()
        .then(c => c.db("web_lab6").collection("articles").find({}).toArray())
        .then(articles => {
            const statistic = {
                firstClass: getStatisticsForClass(articles, "1"),
                secondClass: getStatisticsForClass(articles, "2"),
                thirdClass: getStatisticsForClass(articles, "3"),
                fourthClass: getStatisticsForClass(articles, "4")
            };

            const precision = getPrecision(statistic);
            const recall = getRecall(statistic);
            const f = 2 * precision * recall / (precision + recall);

            response.render("statistics", {
                statistic: statistic,
                precision: precision,
                recall: recall,
                f: f
            });
        });
}

function getStatisticsForClass(articles, className) {
    return {
        truePositive: articles.filter(a => a.class === className).filter(a => a.classificationResult[0].category === className).length,
        falsePositive: articles.filter(a => a.class !== className).filter(a => a.classificationResult[0].category === className).length,
        falseNegative: articles.filter(a => a.class === className).filter(a => a.classificationResult[0].category !== className).length
    }
}

function getPrecision(stat) {
    var truePositiveSum = 0;
    var falsePositiveSum = 0;
    Object.values(stat).forEach(x => {
        truePositiveSum += x.truePositive;
        falsePositiveSum += x.falsePositive;
    });
    return truePositiveSum / (truePositiveSum + falsePositiveSum);
}

function getRecall(stat) {
    var truePositiveSum = 0;
    var falseNegativeSum = 0;
    Object.values(stat).forEach(x => {
        truePositiveSum += x.truePositive;
        falseNegativeSum += x.falseNegative;
    });
    return truePositiveSum / (truePositiveSum + falseNegativeSum);
}