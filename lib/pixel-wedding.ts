export const mapWidth = 480;
export const mapHeight = 270;
export type Point = [number, number];
export type Paint = (x: number, y: number, width: number, height: number, color: string) => void;
export type Cat = { id: number; x: number; y: number; facing: number; step: number };
export const meadow = "#a3ad83";
const pine = "#3b5442";
const sage = "#758c66";
const dark = "#2a4235";
const ivory = "#f9efd6";
const snow = "#fffaf0";
const raspberry = "#ad4264";

export const stops = [
  { id: "france", x: 87, y: 104, en: "Eiffel Tower", zh: "埃菲尔铁塔", country: "France", countryZh: "法国", note: "Bonjour from Paris. The cats are looking for a bakery.", noteZh: "巴黎你好！两只猫正在找附近的面包店。" },
  { id: "switzerland", x: 237, y: 97, en: "The Matterhorn", zh: "马特洪峰", country: "Switzerland", countryZh: "瑞士", note: "A snowy peak and a tiny chalet. A very good spot for a catnap.", noteZh: "雪山脚下有一座小木屋，正适合猫咪打个盹。" },
  { id: "japan", x: 390, y: 108, en: "Mount Fuji & a torii gate", zh: "富士山与鸟居", country: "Japan", countryZh: "日本", note: "A little torii gate with Mount Fuji in the distance.", noteZh: "穿过小小的鸟居，就能看到远处的富士山。" },
  { id: "portugal", x: 100, y: 218, en: "Belém Tower", zh: "贝伦塔", country: "Portugal", countryZh: "葡萄牙", note: "The cats made it to Lisbon. Next stop, a pastel de nata.", noteZh: "猫咪到了里斯本。下一站，葡式蛋挞！" },
  { id: "spain", x: 392, y: 219, en: "Sagrada Família", zh: "圣家堂", country: "Spain", countryZh: "西班牙", note: "Look up at the spires. The cats are ready for a long dinner in Barcelona.", noteZh: "抬头看看尖塔。逛完巴塞罗那，猫咪们准备去吃一顿长长的晚饭。" },
] as const;
export const snacks = [
  { id: "bread", x: 146, y: 136, en: "Baguette", zh: "法棍", note: "Very crunchy. They’re taking it for the road.", noteZh: "外皮脆脆的。猫咪们决定打包带走。" },
  { id: "steak", x: 292, y: 193, en: "Steak", zh: "牛排", note: "The cats have agreed to share. We’ll see how long that lasts.", noteZh: "两只猫同意一人一半。就看它们能坚持多久了。" },
] as const;
export const startCats: [Cat, Cat] = [
  { id: 0, x: 224, y: 226, facing: 1, step: 0 },
  { id: 1, x: 253, y: 230, facing: -1, step: 0 },
];

function polygon(paint: Paint, points: Point[], color: string) {
  const top = Math.min(...points.map((point) => point[1]));
  const bottom = Math.max(...points.map((point) => point[1]));
  for (let y = top; y < bottom; y++) {
    const crossings: number[] = [];
    for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
      const [ax, ay] = points[previous];
      const [bx, by] = points[i];
      const row = y + .5;
      if ((ay > row) !== (by > row)) crossings.push(Math.round(ax + (row - ay) * (bx - ax) / (by - ay)));
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) paint(crossings[i], y, crossings[i + 1] - crossings[i], 1, color);
  }
}

function line(p: Paint, from: Point, to: Point, width: number, color: string) {
  const length = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
  for (let i = 0; i <= length; i++) {
    p(Math.round(from[0] + i * (to[0] - from[0]) / length - width / 2),
      Math.round(from[1] + i * (to[1] - from[1]) / length - width / 2), width, width, color);
  }
}

const tracks: Point[][] = [
  [[-13, 168], [30, 161], [64, 132], [88, 104], [123, 104], [158, 125], [200, 134], [235, 115], [237, 97], [255, 84], [290, 92], [326, 120], [355, 126], [390, 108], [431, 113], [482, 137]],
  [[90, 130], [102, 160], [127, 182], [128, 203], [100, 218], [96, 244], [87, 270]],
  [[128, 203], [162, 219], [204, 229], [257, 226], [294, 201], [319, 187], [350, 189], [392, 219], [427, 221], [479, 211]],
  [[235, 115], [247, 139], [249, 172], [223, 199], [224, 226], [226, 270]],
  [[355, 126], [341, 150], [344, 174], [350, 189]],
];

function tree(p: Paint, x: number, y: number, size: number, shade: number) {
  const leaf = [pine, "#526e51", sage][shade];
  polygon(p, [[x - size, y], [x - size + 5, y - 9], [x - 5, y - 9], [x - 10, y - 11], [x, y - size - 10], [x + 10, y - 11], [x + 5, y - 9], [x + size - 5, y - 9], [x + size, y]], leaf);
  p(x-2,y,4,5,"#61704e"); p(x-size+2,y+4,size*2-4,2,"#889670");
  p(x-2,y-size+1,2,5,"#a1a984");
}

function protectPaths(x: number, y: number) {
  return tracks.some((track) => track.slice(1).some(([bx, by], i) => {
    const [ax, ay] = track[i];
    const length = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length));
    return (x - ax - t * (bx - ax)) ** 2 + (y - ay - t * (by - ay)) ** 2 < 150;
  }));
}

export function drawTerrain(p: Paint) {
  p(0,0,mapWidth,mapHeight,meadow);
  polygon(p,[[0,0],[480,0],[480,46],[436,52],[410,23],[352,21],[316,41],[276,24],[228,22],[184,46],[114,33],[64,53],[0,44]],"#879971");
  polygon(p,[[0,0],[480,0],[480,15],[416,15],[382,8],[274,19],[235,9],[183,20],[123,12],[48,19],[0,12]],"#6a825f");
  polygon(p,[[0,186],[39,173],[59,183],[68,200],[53,213],[74,235],[61,270],[0,270]],"#d1d3a8");
  polygon(p,[[0,193],[37,180],[53,188],[58,199],[44,212],[65,235],[54,270],[0,270]],"#819f8b");
  polygon(p,[[0,200],[27,192],[43,194],[35,211],[51,233],[47,270],[0,270]],"#749682");
  polygon(p,[[480,154],[453,162],[446,180],[459,194],[480,190]],"#c2c99a");
  polygon(p,[[480,159],[456,165],[452,178],[462,187],[480,183]],"#819f8b");
  polygon(p,[[137,45],[152,36],[183,44],[197,59],[185,83],[158,87],[137,71]],"#98a478");
  polygon(p,[[281,224],[308,210],[327,216],[342,240],[315,270],[264,270],[270,244]],"#8e9f75");
  for (const track of tracks) {
    track.slice(1).forEach((to, i) => line(p,track[i],to,18,"#a4a785"));
  }
  for (const track of tracks) {
    track.slice(1).forEach((to, i) => line(p,track[i],to,13,"#e5d9ae"));
    track.slice(1).forEach((to, i) => line(p,track[i],to,9,"#ebdfb9"));
  }
  let seed = 43;
  const next = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * max);
  };
  for (let i = 0; i < 510; i++) {
    const x = next(480), y = next(269), type = next(6);
    if (protectPaths(x,y)) {
      if (type === 0) p(x,y,2,1,"#cdbf97");
      continue;
    }
    p(x,y,type % 3 + 1,1,["#aeb68b","#929e76","#b6bf94","#95a17a","#8a9b74","#b7bd94"][type]);
    if (type === 2 || type === 4) p(x+1,y-2,1,2,"#84966e");
    if (i % 17 === 0) {
      p(x-1,y-2,4,2,i % 3 ? "#f7edcb" : "#b95d78");
      p(x,y-3,2,4,i % 3 ? "#f7edcb" : "#b95d78");
    }
  }
  const forest: [number,number,number,number][] = [
    [11,23,10,0],[28,18,13,1],[42,27,11,0],[63,19,9,2],[318,23,9,0],[335,19,11,1],[348,28,8,2],
    [461,28,12,1],[475,35,13,0],[460,54,8,2],[14,70,13,0],[27,64,8,1],[25,86,10,1],
    [16,124,13,1],[30,119,8,2],[44,147,9,1],[61,154,7,2],[139,69,8,2],[159,53,12,1],
    [178,73,9,0],[170,83,8,2],[304,71,8,1],[320,87,12,0],[333,94,8,2],[445,94,8,0],
    [182,158,11,0],[192,152,8,2],[210,156,11,1],[204,165,7,2],[278,147,7,1],[289,136,9,0],
    [330,148,7,2],[417,153,11,1],[435,159,12,0],[427,167,8,2],[455,236,15,0],[475,249,13,1],
    [444,253,12,1],[421,258,10,2],[326,249,9,0],[313,260,13,1],[305,246,8,2],[288,254,8,2],
    [167,252,12,1],[152,262,11,0],[183,266,9,2],[78,249,9,2],[109,260,11,1],[68,265,10,0],
  ];
  forest.sort((a,b)=>a[1]-b[1]).forEach(([x,y,size,shade])=>tree(p,x,y,size,shade));
  for (const [x,y] of [[10,206],[27,226],[13,241],[36,254],[8,261],[463,173],[472,177]]) {
    p(x,y,8,1,"#b3c6ad"); p(x+2,y+2,8,1,"#9bb49b");
  }
}

export function drawLandmarks(p: Paint) {
  // Eiffel Tower
  p(59,94,57,5,"#808768"); p(63,91,51,4,"#d8cba4");
  line(p,[87,36],[66,91],4,"#665c4a"); line(p,[87,36],[107,91],4,"#665c4a");
  line(p,[87,46],[74,89],2,"#a88664"); line(p,[87,46],[100,89],2,"#a88664");
  p(86,25,2,16,"#665c4a"); p(82,44,10,3,"#665c4a"); p(77,58,21,4,"#876c54"); p(72,74,31,4,"#6b5d49");
  line(p,[78,74],[92,61],1,"#876c54"); line(p,[81,61],[96,74],1,"#876c54");
  line(p,[66,91],[79,80],2,"#876c54"); line(p,[107,91],[94,80],2,"#876c54");
  p(81,79,13,3,"#876c54");

  // Matterhorn and an alpine chalet
  polygon(p,[[185,81],[209,53],[224,44],[238,18],[248,33],[256,36],[278,70],[288,83]],"#748679");
  polygon(p,[[238,18],[248,33],[256,36],[278,70],[287,83],[250,82],[253,65],[247,58],[245,43]],"#566d62");
  polygon(p,[[238,18],[248,33],[256,36],[264,49],[253,45],[250,51],[246,43],[240,38],[229,47],[219,47],[224,44]],snow);
  polygon(p,[[190,87],[207,65],[219,76],[229,63],[249,89]],"#879a83");
  p(241,73,32,16,"#b19571"); p(242,76,29,3,"#e4d0a8");
  polygon(p,[[237,75],[257,61],[276,75]],"#765946");
  p(254,81,6,8,"#6b5543"); p(244,79,5,4,ivory); p(265,79,4,4,ivory);
  p(263,62,4,5,"#8c7257");

  // Mount Fuji and red torii
  polygon(p,[[347,84],[381,55],[406,30],[417,29],[438,53],[466,84]],"#7c9489");
  polygon(p,[[406,30],[417,29],[438,53],[426,50],[422,54],[414,49],[410,55],[404,50],[394,54],[381,55]],snow);
  polygon(p,[[417,29],[438,53],[466,84],[436,79],[426,63]],"#68887c");
  p(370,94,47,4,"#8c9070");
  p(376,66,5,29,"#963f53"); p(403,66,5,29,"#963f53"); p(374,91,9,4,"#654943"); p(401,91,9,4,"#654943");
  p(369,60,46,5,"#ae4d62"); p(367,58,6,4,"#ae4d62"); p(412,58,6,4,"#ae4d62"); p(374,69,37,4,"#963f53"); p(389,64,6,6,"#d27b82");
  p(357,83,8,3,"#697954"); p(429,83,8,3,"#697954");

  // Belém Tower, Lisbon
  p(68,196,57,5,"#818a70"); p(68,191,54,6,"#c9b38a");
  p(71,172,51,20,"#d5c29a"); p(78,150,31,37,"#ead9af");
  p(80,154,27,3,"#c6aa82"); p(76,168,36,3,"#bca680"); p(78,177,30,2,"#bea782");
  for (const x of [71,80,89,98,107,116]) p(x,168,5,6,"#e9d8b2");
  for (const x of [78,86,94,102]) p(x,145,5,8,"#ead9af");
  p(84,157,4,9,"#718275"); p(99,157,4,9,"#718275");
  p(88,178,10,15,"#8e8871"); p(90,176,6,4,"#8e8871");
  p(72,178,5,6,"#a57f60"); p(113,178,5,6,"#a57f60");

  // Sagrada Família, Barcelona
  p(358,198,67,4,"#818567"); p(363,190,56,8,"#b09b72");
  p(371,176,42,16,"#d9c39a"); p(378,168,31,13,"#dfcba1");
  for (const [x,top] of [[371,150],[383,139],[397,143],[409,153]]) {
    polygon(p,[[x-4,179],[x-3,top+8],[x,top],[x+3,top+8],[x+4,179]],"#d7be92");
    p(x-1,top-4,2,6,raspberry); p(x-2,top+11,4,2,"#ac906b"); p(x-1,top+16,2,9,"#827861");
  }
  p(390,181,7,11,"#997b5d"); p(392,178,3,5,"#997b5d");
  p(374,182,4,7,"#9c8768"); p(407,182,4,7,"#9c8768");
}

export function drawMarker(p: Paint, x: number, y: number, seen: boolean) {
  const color = seen ? "#48634d" : raspberry;
  p(x-5,y-5,11,9,color); p(x-4,y-6,9,11,color); p(x-1,y-2,3,3,snow);
}

export function drawSnack(p: Paint, id: string, x: number, y: number) {
  p(x-10,y-4,20,12,"#a9a682"); p(x-8,y-6,16,14,ivory);
  p(x-10,y-4,20,10,ivory);
  if (id === "bread") {
    polygon(p,[[x-8,y+1],[x+4,y-5],[x+8,y-3],[x+7,y+1],[x-5,y+6],[x-8,y+4]],"#ba8047");
    line(p,[x-4,y+2],[x+5,y-2],2,"#e1a967");
    p(x-3,y-1,2,3,ivory); p(x+1,y-3,2,3,ivory);
  } else {
    polygon(p,[[x-7,y-1],[x-3,y-4],[x+6,y-3],[x+8,y+2],[x+4,y+5],[x-5,y+4]],"#8c4356");
    p(x-3,y-2,7,2,"#c2747e"); p(x+1,y,3,2,"#e5af9d");
  }
}

export function drawCat(p: Paint, cat: Cat, active: boolean) {
  const x = Math.round(cat.x), y = Math.round(cat.y), frame = cat.step;
  const body = cat.id === 0 ? "#303c34" : "#fcf3de";
  const contrast = cat.id === 0 ? "#526254" : "#d2c0a2";
  const eye = cat.id === 0 ? "#f5d77b" : "#4d624d";
  const tail = x - cat.facing * 9;
  p(x-10,y+4,20,3,"#84916d");
  p(Math.min(tail,x-4),y-2,Math.abs(tail-x+4)+1,3,contrast);
  p(tail,y-5-(frame%2),3,4,body);
  p(x-8,y-4,16,9,body);
  p(x-5,y-7,13,9,body);
  p(x-7,y-10,4,5,body); p(x+4,y-10,4,5,body);
  p(x-6,y-8,2,2,raspberry); p(x+5,y-8,2,2,raspberry);
  p(x-3,y-3,2,2,eye); p(x+4,y-3,2,2,eye);
  p(x+1,y,2,1,raspberry);
  p(x-7,y+4-(frame%2),3,3,body); p(x+4,y+3+(frame%2),3,3,body);
  if (active) { p(x-3,y-17,7,2,raspberry); p(x-2,y-15,5,2,raspberry); p(x,y-13,1,2,raspberry); }
}

export function drawMap(p: Paint) {
  drawTerrain(p);
  drawLandmarks(p);
}
