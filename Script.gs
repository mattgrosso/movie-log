function entry(title,api_key) {
  /*Search TMDB for the Film*/
  var api = "https://api.themoviedb.org/3/search/movie?api_key="+api_key+"&language=en-US&query="+title;
  var url = UrlFetchApp.fetch(api).getContentText();
  var response = JSON.parse(url).results;
  /*Put Search Results in an Array*/
  var results = new Array();
  for(var i=0;i<response.length;i++){
    results.push([response[i].title, response[i].release_date, response[i].id, response[i].poster_path]);
  }
  return results;
}

function rateRunner(ssid,api_key,id,title,year,medium,date,pj,direction,imagery,story,performance,soundtrack,impression,love,overall,tags,own){
  var ss = SpreadsheetApp.openById(ssid);
  var database = ss.getRangeByName("Database").getValues();
  var count = ss.getRangeByName("Count").getValues();

  /*Create Timestamp*/
  var d = new Date();
  var timeStamp = ((d.getTime())/86400000) + 25568.7082;

  /*Create Viewing Data*/
  var viewing = "";
  if(date){
    date = date.split("-");
    date = date[1]+"/"+date[2]+"/"+date[0];
    date = new Date(date);  
    if(pj){pj=" (PJ)";}else{pj="";}
    viewing = medium + pj+"| "+(date.getMonth()+1)+"/"+(date.getDate())+"/"+date.getFullYear()+";";
  }

  /*Check for existing entry, override timestamp, and amend viewing*/
  var index = Number(count)+1;
  for(var i=0;i<database.length;i++){
    if(database[i][14]==id){
      index = i+1; 
      viewing = database[i][3]+" "+viewing;
      timeStamp = database[i][0];
    }
  }
  viewing = viewing.trim();

  /*Grab TMDB Data*/
  var tmbd_tags = tmdbGrabber(id,api_key);
  var imdb_awards = imdbGrabber(tmbd_tags[0]);

  ss.getSheetByName("Database").getRange(index, 1).setValue(timeStamp);
  ss.getSheetByName("Database").getRange(index, 2).setValue(title);
  ss.getSheetByName("Database").getRange(index, 3).setValue(year);
  ss.getSheetByName("Database").getRange(index, 4).setValue(viewing);
  ss.getSheetByName("Database").getRange(index, 5).setValue(direction);
  ss.getSheetByName("Database").getRange(index, 6).setValue(imagery);
  ss.getSheetByName("Database").getRange(index, 7).setValue(story);
  ss.getSheetByName("Database").getRange(index, 8).setValue(performance);
  ss.getSheetByName("Database").getRange(index, 9).setValue(soundtrack);
  ss.getSheetByName("Database").getRange(index, 10).setValue(impression);
  ss.getSheetByName("Database").getRange(index, 11).setValue(love);
  ss.getSheetByName("Database").getRange(index, 12).setValue(overall);
  ss.getSheetByName("Database").getRange(index, 13).setValue(own);
  ss.getSheetByName("Database").getRange(index, 14).setValue(tags);

  ss.getSheetByName("Database").getRange(index, 15).setValue(id);
  
  ss.getSheetByName("Database").getRange(index, 16).setValue(tmbd_tags[0]);
  ss.getSheetByName("Database").getRange(index, 17).setValue(tmbd_tags[1]);
  ss.getSheetByName("Database").getRange(index, 18).setValue(tmbd_tags[2]);
  ss.getSheetByName("Database").getRange(index, 19).setValue(tmbd_tags[3]);
  ss.getSheetByName("Database").getRange(index, 20).setValue(tmbd_tags[4]);
  ss.getSheetByName("Database").getRange(index, 21).setValue(tmbd_tags[5]);
  ss.getSheetByName("Database").getRange(index, 22).setValue(tmbd_tags[6]);
  ss.getSheetByName("Database").getRange(index, 23).setValue(tmbd_tags[7]);
  ss.getSheetByName("Database").getRange(index, 24).setValue(tmbd_tags[8]);
  ss.getSheetByName("Database").getRange(index, 25).setValue(tmbd_tags[9]);
  ss.getSheetByName("Database").getRange(index, 26).setValue(tmbd_tags[10]);
  ss.getSheetByName("Database").getRange(index, 27).setValue(tmbd_tags[11]);
  
  
  ss.getSheetByName("Database").getRange(index, 28).setValue(imdb_awards[0]);
  ss.getSheetByName("Database").getRange(index, 29).setValue(imdb_awards[1]); 

}

function tmdbGrabber(id,api_key){

  var output = new Array();

  var api = "https://api.themoviedb.org/3/movie/"+id+"?api_key="+api_key;
  var url = UrlFetchApp.fetch(api).getContentText();
  var data = JSON.parse(url);

  api = "https://api.themoviedb.org/3/movie/"+id+"/credits?api_key="+api_key;
  url = UrlFetchApp.fetch(api).getContentText();
  var credits = JSON.parse(url);
  var cast = credits.cast;
  var crew = credits.crew;
  var btc = new Array();
  for(var i=0;i<crew.length;i++){
    btc.push([crew[i].name,crew[i].job,crew[i].department]);
  }


  /*Get IMDB ID*/
  var imdb = data.imdb_id;
  output.push(imdb);

  /*Get Runtime*/
  var r = data.runtime;
  var h = Math.floor(r/60);
  var m = Math.round(r - 60*h);
  var runtime = h + "h " + m + "m";
  if(m == 0){runtime = h+"h";}
  output.push(runtime);

  /*Get Genres*/
  var gdata = data.genres;
  var genre = ""
  for(var i=0;i<gdata.length;i++){
    if(genre.length < 2){genre = gdata[i].name;}
    else {genre = genre + " | " + gdata[i].name;}
  }
  output.push(genre);

  /*Get Production Companies*/
  var pdata = data.production_companies;
  var companies = ""
  for(var i=0;i<pdata.length;i++){
    if(companies.length < 2){companies = pdata[i].name;}
    else {companies = companies + " | " + pdata[i].name;}
  }
  output.push(companies);

  /*Get Director*/
  var director = "";
  for(var i=0;i<btc.length;i++){
    if(btc[i][1]=="Director"){
      if(director.length > 2){director = director + " | " + btc[i][0];} else {director = btc[i][0];}
      }
  }
  output.push(director);

  /*Get Writers*/
  var writers = "";
  for(var i=0;i<btc.length;i++){
    if(btc[i][2]=="Writing"){
      if(writers.length > 2){writers = writers + " | " + btc[i][0];} else {writers = btc[i][0];}
      }
  }
  output.push(writers);

  /*Get Actors*/
  var actor = cast[0].name;
  for(var i=1;i<cast.length;i++){
    actor = actor + " | " + cast[i].name;
  }
  output.push(actor);

  /*Get Producers*/
  var producers = "";
  for(var i=0;i<btc.length;i++){
    if(btc[i][1]=="Producer"){
      if(producers.length > 2){producers = producers + " | " + btc[i][0];} else {producers = btc[i][0];}
      }
  }
  output.push(producers);

  /*Get Composer*/
  var composer = "";
  for(var i=0;i<btc.length;i++){
    if(btc[i][1]=="Original Music Composer"){
      if(composer.length > 2){composer = composer + " | " + btc[i][0];} else {composer = btc[i][0];}
      }
  }
  output.push(composer);

  /*Get DP*/
  var dp = "";
  for(var i=0;i<btc.length;i++){
    if(btc[i][1]=="Director of Photography"){
      if(dp.length > 2){dp = dp + " | " + btc[i][0];} else {dp = btc[i][0];}
      }
  }
  output.push(dp);

  /*Get Editor*/
  var editor = "";
  for(var i=0;i<btc.length;i++){
    if(btc[i][1]=="Editor"){
      if(editor.length > 2){editor = editor + " | " + btc[i][0];} else {editor = btc[i][0];}
      }
  }
  output.push(editor);

  /*Get Poster*/
  var poster = data.poster_path;
  output.push("https://image.tmdb.org/t/p/original"+poster);


return output;
}

function imdbGrabber(id){
  var link = "https://www.imdb.com/title/"+ id + "/awards";
  do{var awards_data = UrlFetchApp.fetch(link).getContentText();} while(awards_data.length < 10);
  
  awards_data = awards_data.substr(awards_data.search("<table"),awards_data.search("</table>"));
  awards_data = awards_data.substr(0,awards_data.search("</table>"));
  if(awards_data.length.toString()<1){awards_data = "nothing<tr>";} /*The "Uncle Buck" code for when a film has 0 awards.*/
  var rows = awards_data.match(/<tr>/g).length;
  var awards = new Array();
  var update = [0,1];
  
  if(awards_data.indexOf("Oscar")>=0){
    for(var i=0;i<rows;i++){
      var awards1 = awards_data.substr(awards_data.search("<tr>")+4,awards_data.search("</tr>"));
      awards1 = awards1.substr(0,awards1.search("</tr>"));
      var count = awards1.match(/<td/g).length;
      if(count==2){
        var part1 = awards1.substr(awards1.search("<td"),awards1.search("</td>"));
        part1 = awardtrim(part1);
        awards1 = awards1.substr(awards1.search("</td>")+5,awards1.length);
        var part2 = awards1.substr(awards1.search("<td"),awards1.search("</td>"));
        part2 = awardtrim(part2);
        update = [part1,part2];
        awards.push(update);
      } else {
        var part1 = awards1.substr(awards1.search("<td"),awards1.search("</td>"));
        part1 = awardtrim(part1);
        update = ["",part1];
        awards.push(update);
      }
      awards_data = awards_data.substr(awards_data.search("</tr>")+5,awards_data.length);
    }
    awards = AwardsParse(awards);
  } else {awards = "";}
  var wins = new Array();
  var noms = new Array();
  awards = awards.split("; ");
  for(var a=0;a<awards.length;a++){
    awards[a] = awards[a].split("| ");
    if(awards[a][0]=="Win Oscar"){wins.push(awards[a][1]);}
    if(awards[a][0]=="Nomination Oscar"){noms.push(awards[a][1]);}
  }
  wins = wins.join(" | ");
  noms = noms.join(" | ");
  if(wins.length > 0){noms = wins + " | " + noms;}
  var output = new Array();
  output.push(wins);
  output.push(noms);

  return output;
  
}

function awardtrim(part){
    part = part.replace(/<.*?>/g,'');
    part = part.replace(/<(?:.|\n)*?>/g,'');
    part = part.replace(/  /g,'');
    part = part.replace(/\n\n/g,'\n');
    part = part.trim();
    return part;
  }

function AwardsParse(awards){
  var outcome = [0];
  if(awards[0][0].indexOf("Oscar") >= 0 || awards[1][0].indexOf("Oscar") >= 0 ||awards[2][0].indexOf("Oscar") >= 0){
    /*Determine # of Wins*/
    var wins = awards.length;
    for(var i = 0; i < awards.length; i++){
      if(awards[i][0].indexOf("Nominee") >= 0){wins = i;}
    }
    /*Label Honorary Oscars*/
    for(var i=0;i<awards.length;i++){
      if((awards[i][0].indexOf("Honor")>=0) || (awards[i][0].indexOf("Special")>=0) || (awards[i][0].indexOf("Technical Achievement")>=0)){awards[i][1] = "Honorary Oscar";}
    }
    /*Replace Columns 1 with Win and Nomination*/
    for(var i=0;i<awards.length;i++){
      if(i<wins){awards[i][0] = "Win Oscar";}else{awards[i][0] = "Nomination Oscar"}
    }
    /*Replace Column 2 with catgeories*/
    for(var i=0;i<awards.length;i++){
    
      if((awards[i][1].indexOf("Actor")>=0) & (awards[i][1].indexOf("Lead")>=0)){awards[i][1] = "Best Actor - Lead";}
      else if((awards[i][1].indexOf("Actress")>=0) & (awards[i][1].indexOf("Lead")>=0)){awards[i][1] = "Best Actress - Lead";}
      else if((awards[i][1].indexOf("Actor")>=0) & (awards[i][1].indexOf("Supporting")>=0)){awards[i][1] = "Best Actor - Supporting";}
      else if((awards[i][1].indexOf("Actress")>=0) & (awards[i][1].indexOf("Supporting")>=0)){awards[i][1] = "Best Actress - Supporting";}
      else if((awards[i][1].indexOf("Animat")>=0) & (awards[i][1].indexOf("Feature")>=0)){awards[i][1] = "Best Animated Film";}
      else if((awards[i][1].indexOf("Animat")>=0) & (awards[i][1].indexOf("Short")>=0)){awards[i][1] = "Best Animated Short";}
      else if(awards[i][1].indexOf("Cinematography")>=0){awards[i][1] = "Best Cinematography";}
      else if(awards[i][1].indexOf("Costume")>=0){awards[i][1] = "Best Costumes";}
      else if((awards[i][1].indexOf("Documentary")>=0) & (awards[i][1].indexOf("Feature")>=0)){awards[i][1] = "Best Documentary";}
      else if((awards[i][1].indexOf("Documentary")>=0) & (awards[i][1].indexOf("Short")>=0)){awards[i][1] = "Best Documentary Short";}
      else if((awards[i][1].indexOf("Sound")>=0) & (awards[i][1].indexOf("Editing")>=0)){awards[i][1] = "Best Sound Editing";}
      else if(awards[i][1].indexOf("Editing")>=0){awards[i][1] = "Best Editing";}
      else if(awards[i][1].indexOf("Sound")>=0){awards[i][1] = "Best Sound Mixing";}
      else if(awards[i][1].indexOf("Foreign")>=0){awards[i][1] = "Best Foreign Film";}
      else if(awards[i][1].indexOf("International")>=0){awards[i][1] = "Best Foreign Film";}
      else if(awards[i][1].indexOf("Makeup")>=0){awards[i][1] = "Best Makeup";}
      else if((awards[i][1].indexOf("Score")>=0 | awards[i][1].indexOf("Scoring")>=0) & !(awards[i][1].indexOf("Song")>=0) & !(awards[i][1].indexOf("Adapted")>=0)){awards[i][1] = "Best Original Score";}
      else if((awards[i][1].indexOf("Song")>=0) & !(awards[i][1].indexOf("Scor")>=0)){awards[i][1] = "Best Original Song";}
      else if((awards[i][1].indexOf("Production")>=0) & (awards[i][1].indexOf("Design")>=0)){awards[i][1] = "Best Production Design";}
      else if((awards[i][1].indexOf("Art")>=0) & (awards[i][1].indexOf("Direction")>=0)){awards[i][1] = "Best Production Design";}
      else if((awards[i][1].indexOf("Best")>=0) & (awards[i][1].indexOf("Director")>=0)){awards[i][1] = "Best Director";}
      else if((awards[i][1].indexOf("Best")>=0) & (awards[i][1].indexOf("Direction")>=0)){awards[i][1] = "Best Director";}
      else if((awards[i][1].indexOf("Best")>=0) & (awards[i][1].indexOf("Directing")>=0)){awards[i][1] = "Best Director";}
      else if((awards[i][1].indexOf("Visual")>=0) & (awards[i][1].indexOf("Effects")>=0)){awards[i][1] = "Best Visual Effects";}
      else if((awards[i][1].indexOf("Special")>=0) & (awards[i][1].indexOf("Effects")>=0)){awards[i][1] = "Best Visual Effects";}
      else if((awards[i][1].indexOf("Writing")>=0) & ((awards[i][1].indexOf("Adapt")>=0) || (awards[i][1].indexOf("Another")>=0))){awards[i][1] = "Best Adapted Screenplay";}
      else if((awards[i][1].indexOf("Writing")>=0) & ((awards[i][1].indexOf("Original")>=0) || (awards[i][1].indexOf("Factual")>=0) || (awards[i][1].indexOf("Directly")>=0))){awards[i][1] = "Best Original Screenplay";}
      else if((awards[i][1].indexOf("Screenplay")>=0) & (awards[i][1].indexOf("Adapt")>=0)){awards[i][1] = "Best Adapted Screenplay";}
      else if((awards[i][1].indexOf("Screenplay")>=0) & (awards[i][1].indexOf("Orig")>=0)){awards[i][1] = "Best Original Screenplay";}
      else if((awards[i][1].indexOf("Writing")>=0)){awards[i][1] = "Best Screenplay";}
      else if((awards[i][1].indexOf("Best")>=0) & (awards[i][1].indexOf("Picture")>=0)){awards[i][1] = "Best Picture";}
      else if(awards[i][1].indexOf("Honor")>=0){awards[i][1] = "Honorary Oscar";}
      else {awards[i][1] = "Discontinued Oscar";}
    }
  }
  
  for(var i=0;i<awards.length;i++){
    outcome[i] = awards[i][0] + "| " + awards[i][1];
  }
  
  return outcome.join("; ");
}




