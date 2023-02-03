function updateTMDB() {
  var ss = SpreadsheetApp.openById("1oGg90-4uWhFv3kzmDTuybRml9gHXb-veMOUEBqvXtcE");
  var database = ss.getRangeByName("Database").getValues();
  var count = ss.getRangeByName("Count").getValues();

  for(var j=1794;j<count;j++){
    var id = database[j][15];
    var api = "https://api.themoviedb.org/3/movie/"+id+"?api_key=7a5e8056956703ad202d3a3ddbcfc0e3";
    var url = UrlFetchApp.fetch(api).getContentText();
    var data = JSON.parse(url);

    var tmdb = data.id;

    /*Get Genres*/
    var gdata = data.genres;
    var genre = ""
    for(var i=0;i<gdata.length;i++){
      if(genre.length < 2){genre = gdata[i].name;}
     else {genre = genre + " | " + gdata[i].name;}
    }

  /*Get Production Companies*/
  var pdata = data.production_companies;
  var companies = ""
  for(var i=0;i<pdata.length;i++){
    if(companies.length < 2){companies = pdata[i].name;}
    else {companies = companies + " | " + pdata[i].name;}
  }

  /*Get Runtime*/
  var r = data.runtime;
  var h = Math.floor(r/60);
  var m = Math.round(r - 60*h);
  var runtime = h + "h " + m + "m";
  if(m == 0){runtime = h+"h";}

  ss.getSheetByName("Database").getRange(j+1,15,1,5).setValues([[tmdb,id,runtime,genre,companies]]);

  }


}
