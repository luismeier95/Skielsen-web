/* SKIELSEN Minority · shared rules/content layer
   Pure browser-compatible rules used by the standalone today and reusable by the in-app module later. */
(function(root){
'use strict';

var DIFFICULTIES=['EASY','NORMAL','HARDCORE'];
var QUESTION_POOLS={
  2:[
    ['Rechts','Links'],['Oben','Unten'],['Heiß','Kalt'],['Drinnen','Draußen'],['Regen','Sonne'],
    ['Tag','Nacht'],['Früh','Spät'],['Cola','Fanta'],['Mayo','Ketchup'],['Nudeln','Reis'],
    ['Apfel','Banane'],['Schokolade','Chips'],['Dusche','Badewanne'],['Fenster','Tür'],['Treppe','Aufzug'],
    ['Fliegen','Fahren'],['Hotel','Ferienwohnung'],['Strand','Pool'],['Camping','Hotel'],['Film','Serie'],
    ['Kino','Zuhause'],['Musik','Podcast'],['Spotify','YouTube'],['Buch','Film'],['Horror','Comedy'],
    ['Action','Drama'],['Marvel','DC'],['Harry Potter','Herr der Ringe'],['Star Wars','Star Trek'],['Mario','Sonic'],
    ['FIFA','Call of Duty'],['Maus','Controller'],['Chrome','Safari'],['Anrufen','Schreiben'],['Foto','Video'],
    ['Selfie','Gruppenfoto'],['Frühaufsteher','Nachteule'],['Planen','Spontan'],['Chaos','Ordnung'],['Laut','Leise'],
    ['Schnell','Langsam'],['Kopf','Bauch'],['Glück','Können'],['Risiko','Sicherheit'],['Geld','Freizeit'],
    ['Bekannt','Unbekannt'],['Vergangenheit','Zukunft'],['Fragen','Antworten'],['Gewinnen','Spaß'],['Allein','Gruppe'],
    ['Gastgeber','Gast'],['Wahrheit','Pflicht'],['Reden','Zuhören'],['Tanzen','Singen'],['Kochen','Bestellen'],
    ['Sport','Gaming'],['Tischtennis','Dart'],['Fitnessstudio','Laufen'],['Angreifen','Verteidigen'],['Kraft','Geschwindigkeit'],
    ['Linksfuß','Rechtsfuß'],['Schwarz','Weiß'],['Kreis','Quadrat'],['Groß','Klein'],['Rund','Eckig'],
    ['Voll','Leer'],['Hell','Dunkel'],['Hoch','Tief'],['Vorne','Hinten'],['Innen','Außen'],
    ['Gerade','Kurve'],['Kopf','Zahl'],['Eins','Zwei'],['Plus','Minus'],['Ja','Nein'],
    ['Jetzt','Später'],['Mehr','Weniger'],['Anfang','Ende'],['Alt','Neu']
  ],
  3:[
    ['Frühstück','Mittagessen','Abendessen'],['Schule','Uni','Arbeit'],['Dusche','Sauna','Whirlpool'],
    ['Balkon','Terrasse','Garten'],['Hemd','Hoodie','T-Shirt'],['Sneakers','Stiefel','Sandalen'],
    ['Gold','Silber','Bronze'],['Rock','Pop','Hip-Hop'],['WhatsApp','Telegram','Snapchat'],
    ['Comedy','Thriller','Dokumentation'],['Frühstücksei','Müsli','Toast'],['Gabel','Messer','Löffel'],
    ['Taxi','E-Scooter','Motorrad'],['Keller','Erdgeschoss','Dachgeschoss'],['Kissen','Decke','Matratze'],
    ['Augen','Ohren','Nase'],['Morgen','Mittag','Abend'],['Zuhause','Büro','Café'],['Tick','Trick','Track']
  ],
  4:[
    ['Frühling','Sommer','Herbst','Winter'],['Nord','Süd','Ost','West'],['Rot','Blau','Grün','Gelb'],
    ['Montag','Mittwoch','Freitag','Sonntag'],['Pizza','Burger','Döner','Pasta'],['Hund','Katze','Pferd','Vogel'],
    ['PC','PlayStation','Xbox','Switch'],['Auto','Fahrrad','Bahn','Zu Fuß'],['Netflix','YouTube','TikTok','Instagram'],
    ['Meer','Berge','Stadt','Land'],['Süß','Salzig','Sauer','Scharf'],['Fußball','Basketball','Tennis','Tischtennis'],
    ['Herz','Pik','Karo','Kreuz'],['Feuer','Wasser','Erde','Luft'],['Januar','April','Juli','Oktober']
  ]
};

function normalizeDifficulty(value){
  var upper=String(value||'').toUpperCase();
  return DIFFICULTIES.indexOf(upper)>=0?upper:'NORMAL';
}

function optionCountForRound(difficulty,roundNo,randomFn){
  var diff=normalizeDifficulty(difficulty);
  var n=Math.max(1,Number(roundNo)||1);
  if(n%5!==0||diff==='EASY')return 2;
  if(diff==='NORMAL')return 3;
  var rand=typeof randomFn==='function'?randomFn:Math.random;
  return rand()<0.5?3:4;
}

function resolveRound(input){
  input=input||{};
  var diff=normalizeDifficulty(input.difficulty);
  var rawChoices=Array.isArray(input.choices)?input.choices:[];
  var choices=rawChoices.map(function(v){return Number(v)||0;});
  var optionCount=Math.max(2,Number(input.optionCount)||Math.max.apply(null,[2].concat(choices)));
  var counts=new Array(optionCount).fill(0);
  choices.forEach(function(choice){if(choice>=1&&choice<=optionCount)counts[choice-1]+=1;});

  var positive=counts.filter(function(v){return v>0;});
  var min=positive.length?Math.min.apply(null,positive):0;
  var max=positive.length?Math.max.apply(null,positive):0;
  var hasMinority=positive.length>1&&min<max;
  var winningSeats=[];
  if(hasMinority){
    choices.forEach(function(choice,index){
      if(choice>=1&&counts[choice-1]===min)winningSeats.push(index+1);
    });
  }

  var scoreInput=Array.isArray(input.scores)?input.scores:[0,0,0,0];
  var scores=[0,1,2,3].map(function(i){return Number(scoreInput[i])||0;});
  var roundValue=Math.max(1,Number(input.roundValue)||1);
  var award=hasMinority?(diff==='EASY'?1:roundValue):0;
  if(award){
    winningSeats.forEach(function(seat){scores[seat-1]+=award;});
  }

  var penaltySeats=[];
  var isFourZero=counts.some(function(v){return v===4;});
  if(!hasMinority&&diff==='HARDCORE'&&isFourZero){
    var leaderScore=Math.max.apply(null,scores);
    scores.forEach(function(score,index){
      if(score===leaderScore){
        scores[index]-=1;
        penaltySeats.push(index+1);
      }
    });
  }

  var nextRoundValue=1;
  if(diff!=='EASY'&&!hasMinority)nextRoundValue=roundValue+1;

  return {
    counts:counts,
    hasMinority:hasMinority,
    winningSeats:winningSeats,
    penaltySeats:penaltySeats,
    award:award,
    roundValue:roundValue,
    nextRoundValue:nextRoundValue,
    scores:scores,
    isFourZero:isFourZero
  };
}

function shuffledCopy(list,randomFn){
  var rand=typeof randomFn==='function'?randomFn:Math.random;
  var copy=list.slice();
  for(var i=copy.length-1;i>0;i--){
    var j=Math.floor(rand()*(i+1));
    var tmp=copy[i];copy[i]=copy[j];copy[j]=tmp;
  }
  return copy;
}

function buildLocalSchedule(difficulty,roundCount,randomFn){
  var rand=typeof randomFn==='function'?randomFn:Math.random;
  var count=Math.max(1,Number(roundCount)||10);
  var bags={2:[],3:[],4:[]};
  function draw(optionCount){
    if(!bags[optionCount].length)bags[optionCount]=shuffledCopy(QUESTION_POOLS[optionCount],rand);
    return bags[optionCount].pop().slice();
  }
  var out=[];
  for(var round=1;round<=count;round++){
    var optionCount=optionCountForRound(difficulty,round,rand);
    out.push({id:'local-'+round,options:draw(optionCount),optionCount:optionCount,chaos:optionCount>2});
  }
  return out;
}

root.SkielsenMinorityRules={
  version:'1.0.0',
  difficulties:DIFFICULTIES.slice(),
  questionPools:QUESTION_POOLS,
  normalizeDifficulty:normalizeDifficulty,
  optionCountForRound:optionCountForRound,
  resolveRound:resolveRound,
  buildLocalSchedule:buildLocalSchedule
};
})(globalThis);
