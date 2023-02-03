function webApp(e) {
  var action = e.parameter.action;
  var title = e.parameter.title;
  var id = e.parameter.id;

  var url = "https://script.google.com/macros/s/AKfycbyoKs1KSdc3b912KrM-v4L6w9k_f1YWVL04R08EfA9kkn8Js8eroD4JNz60Yw5m3c_0vA/exec";
  var api_key = "7a5e8056956703ad202d3a3ddbcfc0e3";
  var ssid = "1FGB3nVDsq8yInhwJcGNGa1LG5_nTKw1HZjRydCNKiAM";

  var t = HtmlService.createTemplateFromFile("Home.html");
  t.url = url;

  if (action == "entry") {
    var TMDB_results = entry(title, api_key);
    t = HtmlService.createTemplateFromFile("Entry.html");
    t.url = url;
    t.TMDB_results = TMDB_results;

  }
  if (action == "rate") {
    var database = SpreadsheetApp.openById(ssid).getRangeByName("Database").getValues();
    var weights = SpreadsheetApp.openById(ssid).getRangeByName("Weights").getValues();
    var tags = SpreadsheetApp.openById(ssid).getRangeByName("Tags").getValues();
    t = HtmlService.createTemplateFromFile("Rate.html");
    t.id = id;
    t.webapp = url;
    t.api_key = api_key;
    t.database = database;
    t.weights = weights;
    t.customtags = tags;

  }
  if (action == "submit") {
    var year = e.parameter.year;
    var medium = e.parameter.medium;
    var date = e.parameter.date;
    var direction = e.parameter.direction;
    var imagery = e.parameter.imagery;
    var story = e.parameter.story;
    var performance = e.parameter.performance;
    var soundtrack = e.parameter.soundtrack;
    var impression = e.parameter.impression;
    var love = e.parameter.love;
    var overall = e.parameter.overall;
    var tags = e.parameter.tags;
    var own = e.parameter.own;
    var pj = e.parameter.pj;
    rateRunner(ssid, api_key, id, title, year, medium, date, pj, direction, imagery, story, performance, soundtrack, impression, love, overall, tags, own);

    var redirect = url + "?action=search&start=0&sort=Rating&term=Year+%3D+" + year;
    t = HtmlService.createTemplateFromFile("Redirect.html");
    t.redirect = redirect;
    t.url = url;

  }
  if (action == "search") {
    t = HtmlService.createTemplateFromFile("Search.html");
    t.url = url;
    t.term = e.parameter.term;
    t.sort = e.parameter.sort;
    t.xor = e.parameter.xor;
    t.start = e.parameter.start;
    t.searchResults = searchLog(e.parameter.term, e.parameter.sort, e.parameter.xor, ssid);

  }
  if (action == "recent") {
    t = HtmlService.createTemplateFromFile("Search.html");
    t.url = url;
    t.start = e.parameter.start;
    t.term = e.parameter.term;
    t.sort = e.parameter.sort;
    t.xor = e.parameter.xor;
    t.searchResults = recentView(ssid);
  }
  return t.evaluate();
}