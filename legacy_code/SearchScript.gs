function searchLog(term,sort,xor,ssid){
  var ss = SpreadsheetApp.openById(ssid);
  var database = ss.getRangeByName("Database").getValues();
  var count = ss.getRangeByName("Count").getValue();
  var results = new Array();
  
  /*****Columns in Database*****/
    var cols = ['Date', 'Title', 'Year', 'Viewings', 'Direction', 'Imagery', 'Story', 'Performance', 'Soundtrack', 'Impression', 'Love', 'Overall', 'Own', 'Tag', 'TMDB ID', 'IMDB ID', 'Runtime', 'Genre', 'Production', 'Director', 'Writer', 'Actor', 'Producer', 'Composer', 'Cinematographer', 'Editor', 'Poster', 'Oscar Win', 'Oscar Nom', 'Rating'];

  /****Split Up Search Term****/
  if(term==''){term = "IMDB ID = tt";}
  term = splitTerm(term);

  /****Run Through Database****/
  for(var i=1;i<count;i++){
    /***Check Each Term***/
    var matches = 0;
    for(var j=0;j<term.length;j++){
      for(var k=0;k<cols.length;k++){
        if(term[j][0]==cols[k] | term[j][0]==''){
          if(term[j][1]=="=" & database[i][k].toString().indexOf(term[j][2])>-1){matches++;}
          if(term[j][1]==">" & database[i][k] >= term[j][2]){matches++;}
          if(term[j][1]=="<" & database[i][k] <= term[j][2]){matches++;}
          if(term[j][1]=="!=" & database[i][k].toString().indexOf(term[j][2])==-1){matches++;}
       }
      }
    }
    if(matches >= term.length & xor != "on"){results.push(database[i]);}
    if(matches > 0 & xor == "on"){results.push(database[i]);}
    
  }
  var sortCol = cols.indexOf(sort);
  results.sort(sortByCol);
  results.sort(function(a,b){return b[sortCol]-a[sortCol];}); 
  return results;
}

function sortByCol(a,b){
    var A = a[2].toString();
    var B = b[2].toString(); 
     
    A = A.toLowerCase();
    B = B.toLowerCase();
    
    if(A.substr(0,4)=="the "){A = A.substr(4);}
    if(B.substr(0,4)=="the "){B = B.substr(4);}
    
    if(A.substr(0,2)=="a "){A = A.substr(2);}
    if(B.substr(0,2)=="a "){B = B.substr(2);}
     
    if (A < B) return -1;
    if (A > B) return 1;
    return 0;
}

function splitTerm(term){
  term = term.split("|");
  var output = new Array();
  for(var i=0;i<term.length;i++){
    if(term[i].indexOf("!=")>-1){term[i] = term[i].split("!="); output.push([term[i][0].trim(),"!=",term[i][1].trim()]);}
    else if(term[i].indexOf("=")>-1){term[i] = term[i].split("="); output.push([term[i][0].trim(),"=",term[i][1].trim()]);}
    else if(term[i].indexOf(">")>-1){term[i] = term[i].split(">"); output.push([term[i][0].trim(),">",term[i][1].trim()]);}
    else if(term[i].indexOf("<")>-1){term[i] = term[i].split("<"); output.push([term[i][0].trim(),"<",term[i][1].trim()]);}
    else {output.push(["","=",term[i].trim()]);}
  }
  return output;
}

function recentView(ssid){
  var ss = SpreadsheetApp.openById(ssid);
  var database = ss.getRangeByName("Database").getValues();
  var count = ss.getRangeByName("Count").getValue();
  var timeOut = new Array();
  
  for(var i=1;i<count;i++){
    var views = database[i][3].toString().trim();
    if(views.length > 3){
      views = views.split("; ");
      for(var j=0;j<views.length;j++){
        views[j] = views[j].split("| ");
        var date = new Date(views[j][1].replace(";",""));
        timeOut.push([date,database[i][1],database[i][2],database[i][3],database[i][4],database[i][5],database[i][6],database[i][7],database[i][8],database[i][9],database[i][10],database[i][11],database[i][12],database[i][13],database[i][14],database[i][15],database[i][16],database[i][17],database[i][18],database[i][19],database[i][20],database[i][21],database[i][22],database[i][23],database[i][24],database[i][25],database[i][26],database[i][27],database[i][28],database[i][29]]);
      }     
    }
  }  
  timeOut.sort(function(a,b){return b[0]-a[0];});
  return timeOut;
}














