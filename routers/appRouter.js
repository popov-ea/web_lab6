const express = require("express");
const appController = require("../controllers/appController");
const bodyParser = require("body-parser");

const router = express.Router();
const urlencodedParser = bodyParser.urlencoded({extended: false});


router.get("/", appController.index);

router.get("/addArticle", appController.addArticlePage);
router.post("/addArticle", urlencodedParser,appController.addArticle);

router.get("/articles/:category", appController.getArticlesByCategory);

router.get("/train", appController.train);

router.get("/addArticlesFromCsv", appController.addArticlesFromCsvPage);
router.post("/addArticlesFromCsv", appController.addArticlesFromCsv)

router.get("/statistics", appController.getStatistic);

module.exports = router;