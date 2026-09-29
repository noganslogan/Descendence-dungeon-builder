import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FLOOR_ID='ground';
const objects=[];
const connections=[];
let nextConnectionId=1;
let nextHallwayId=100;
let nextDoorId=300;
let nextMarkerId=400;

const roomNotes={
  1:'Grand central hall. The source map shows a star-like floor emblem and two ranks of pillars. The broad south passage is the main entrance.',
  6:'Large eastern hall linking the central chamber to the east-side rooms.',
  12:'Large pillared hall. The source map shows four pillars along each side wall.',
  29:'Large inner chamber set inside the eastern corridor loop.',
  32:'Distinctive six-sided chamber at the heart of the north-western wing.',
  45:'Rounded pillared chamber. The source map shows three pillars along each side and an apsidal north end.',
  49:'Small chamber with a secret eastern threshold in the source map.',
  50:'Small northern alcove above the rounded hall.'
};

function register(object){
  object.connectionIds=[];
  objects.push(object);
  return object.id;
}

function rectRoom(number,column,row,widthCells,heightCells){
  return register({
    id:number,type:'room',floorId:FLOOR_ID,label:String(number),
    notes:roomNotes[number]||`Numbered chamber ${number} from the supplied reference map.`,
    shape:'rectangle',gridPosition:{column,row},dimensions:{widthCells,heightCells},
    geometry:{kind:'rectangle',origin:{column,row},size:{widthCells,heightCells}}
  });
}

function outlineRoom(number,points){
  const gridOutline=points.map(([column,row])=>({column,row}));
  return register({
    id:number,type:'room',subtype:'cavern',floorId:FLOOR_ID,label:String(number),notes:roomNotes[number],
    shape:'outline',gridOutline,
    geometry:{kind:'outline',points:gridOutline,closed:true,smoothing:'curve'}
  });
}

function hallway(label,points,widthCells=1.5,notes=''){ 
  const id=nextHallwayId++;
  const gridPath=points.map(([column,row])=>({column,row}));
  register({
    id,type:'hallway',subtype:'passage',floorId:FLOOR_ID,label,notes,
    shape:'path',pathStyle:'constructed',widthCells,smoothing:'none',gridPath,
    geometry:{kind:'centerline',points:gridPath,widthCells,smoothing:'none'}
  });
  return id;
}

function marker(markerType,column,row,label,notes){
  return register({
    id:nextMarkerId++,type:'marker',floorId:FLOOR_ID,label,notes,connectionIds:[],
    gridPosition:{column,row},markerType,targetFloorId:null
  });
}

function objectById(id){
  const object=objects.find(item=>String(item.id)===String(id));
  if(!object)throw new Error(`Unknown object ${id}`);
  return object;
}

function objectSummary(id){
  const object=objectById(id);
  return {objectId:id,objectType:object.type,label:object.label};
}

function link(fromObjectId,toObjectId,{type='open-passage',at,angleDegrees=0,contact='threshold',door=true,notes=''}){
  const id=nextConnectionId++;
  let doorObjectId=null;
  if((type==='door'||type==='secret-door')&&door){
    doorObjectId=nextDoorId++;
    register({
      id:doorObjectId,type:'door',floorId:FLOOR_ID,label:'',
      notes:notes||`Threshold between ${objectById(fromObjectId).label||fromObjectId} and ${objectById(toObjectId).label||toObjectId}.`,
      gridPosition:{column:at[0],row:at[1]},
      orientation:angleDegrees===90?'vertical':'horizontal',angleDegrees,
      doorType:type,connectionId:id
    });
  }
  const connection={
    id,type,floorId:FLOOR_ID,from:objectSummary(fromObjectId),to:objectSummary(toObjectId),
    gridPosition:{column:at[0],row:at[1]},
    orientation:angleDegrees===90?'vertical':'horizontal',angleDegrees,contact,doorObjectId,status:'valid',issue:null
  };
  connections.push(connection);
  objectById(fromObjectId).connectionIds.push(id);
  objectById(toObjectId).connectionIds.push(id);
  if(doorObjectId!==null)objectById(doorObjectId).connectionIds.push(id);
  return id;
}

function doorToRoom(roomId,hallwayId,at,angleDegrees=0,type='door',options={}){
  return link(hallwayId,roomId,{type,at,angleDegrees,contact:'threshold',...options});
}

function joinHallways(fromObjectId,toObjectId,at,angleDegrees=0){
  return link(fromObjectId,toObjectId,{type:'open-passage',at,angleDegrees,contact:'junction',door:false});
}

// The rooms use the original map's numbering and broadly preserve its footprint.
rectRoom(1,32,31,24,8);
rectRoom(2,58,40,3,5);
rectRoom(3,63,40,3,5);
rectRoom(4,58,27,3,4);
rectRoom(5,63,27,3,4);
rectRoom(6,76,31,7,8);
rectRoom(7,67,24,9,5);
rectRoom(8,82,24,4,4);
rectRoom(9,82,19,4,4);
rectRoom(10,72,19,3,4);
rectRoom(11,82,14,4,4);
rectRoom(12,72,1,13,12);
rectRoom(13,71,13,4,3);
rectRoom(14,68,8,4,4);
rectRoom(15,67,1,3,4);
rectRoom(16,63,1,3,4);
rectRoom(17,59,1,3,4);
rectRoom(18,55,1,3,4);
rectRoom(19,51,1,3,4);
rectRoom(20,47,1,3,4);
rectRoom(21,43,1,3,4);
rectRoom(22,39,1,3,4);
rectRoom(23,35,1,3,4);
rectRoom(24,31,1,3,4);
rectRoom(25,27,1,3,4);
rectRoom(26,27,8,8,4);
rectRoom(27,56,8,3,4);
rectRoom(28,62,8,3,4);
rectRoom(29,56,15,9,7);
rectRoom(30,45,8,4,3);
rectRoom(31,45,14,4,3);
outlineRoom(32,[[40,8],[44,11],[44,15],[40,18],[36,15],[36,11]]);
rectRoom(33,30,15,7,5);
rectRoom(34,26,22,5,4);
rectRoom(35,26,27,5,3);
rectRoom(36,36,22,5,4);
rectRoom(37,36,27,5,4);
rectRoom(38,35,40,5,4);
rectRoom(39,22,36,5,7);
rectRoom(40,16,36,5,7);
rectRoom(41,6,32,3,4);
rectRoom(42,6,25,3,4);
rectRoom(43,1,32,4,4);
rectRoom(44,1,25,4,4);
outlineRoom(45,[[10,24],[9,21],[9,13],[10,10],[13,8],[16,9],[19,12],[19,21],[18,24]]);
rectRoom(46,20,14,4,5);
rectRoom(47,5.5,14,3,5);
rectRoom(48,1,14,4,4);
rectRoom(49,43,21,4,5);
rectRoom(50,13,5,2,3);

// Major routes. These are separate semantic hallways so they remain easy to move and reshape.
const northGallery=hallway('',[[28.5,7],[72,7]],2,'Long northern gallery serving rooms 15–29 and the large east hall.');
const centralSpine=hallway('',[[50,7],[50,31]],2,'North-south spine between the northern gallery and central hall.');
const eastSpine=hallway('',[[79,13],[79,35],[76,35]],2,'Eastern spine linking rooms 6–13.');
const eastMain=hallway('',[[56,35],[76,35]],2.5,'Broad passage between the central and eastern halls.');
const westSouth=hallway('',[[32,35],[29,35],[29,45],[14,45],[14,24]],2.5,'Bent western and southern gallery linking rooms 1, 38–45.');
const westCross=hallway('',[[14,31],[3,31]],2.5,'Cross gallery between rooms 41–44 and the western descent.');
const innerWestSpine=hallway('',[[33.5,20],[33.5,31]],2,'Inner spine serving rooms 33–37.');
const northwestDescent=hallway('',[[36,7],[36,14],[33.5,14],[33.5,15]],2,'Upper passage from the northern gallery to room 33.');
const rightCentralSpine=hallway('',[[60.5,7],[60.5,15]],2,'Short spine serving rooms 27–29.');
const entrancePassage=hallway('',[[44,39],[44,51]],5,'Broad stepped entrance passage leading south from room 1.');

joinHallways(northGallery,centralSpine,[50,7],0);
joinHallways(northGallery,northwestDescent,[36,7],0);
joinHallways(northGallery,rightCentralSpine,[60.5,7],0);
joinHallways(westSouth,westCross,[14,31],90);
joinHallways(eastSpine,eastMain,[76,35],90);

// Northern row: a short neck and a real door for every numbered cell.
const topRooms=[
  [25,28.5],[24,32.5],[23,36.5],[22,40.5],[21,44.5],[20,48.5],
  [19,52.5],[18,56.5],[17,60.5],[16,64.5],[15,68.5]
];
for(const [roomId,column] of topRooms){
  const neck=hallway('',[[column,5],[column,7]],1.25);
  doorToRoom(roomId,neck,[column,5],0);
  joinHallways(neck,northGallery,[column,7],90);
}

doorToRoom(12,northGallery,[72,7],90);
const room12South=hallway('',[[78.5,13],[78.5,13.5],[79,13.5]],1.5);
doorToRoom(12,room12South,[78.5,13],0);
joinHallways(room12South,eastSpine,[79,13.5],90);

const room26Neck=hallway('',[[31,7],[31,8]],1.5);
doorToRoom(26,room26Neck,[31,8],0);
joinHallways(room26Neck,northGallery,[31,7],0);

doorToRoom(33,northwestDescent,[33.5,15],0);
doorToRoom(33,innerWestSpine,[33.5,20],0);
doorToRoom(1,innerWestSpine,[33.5,31],0,'open-passage',{door:false});

const room32East=hallway('',[[44,13],[50,13]],1.5);
doorToRoom(32,room32East,[44,13],90);
joinHallways(room32East,centralSpine,[50,13],90);

for(const [roomId,row] of [[30,9.5],[31,15.5],[49,23.5]]){
  const room=objectById(roomId);
  const startColumn=roomId===49?47:49;
  const branch=hallway('',[[startColumn,row],[50,row]],1.5);
  doorToRoom(roomId,branch,[startColumn,row],90,roomId===49?'secret-door':'door');
  joinHallways(branch,centralSpine,[50,row],90);
}

for(const [roomId,row,startColumn] of [[34,24,31],[35,28.5,31],[36,24,36],[37,28.5,36]]){
  const branch=hallway('',[[startColumn,row],[33.5,row]],1.5);
  doorToRoom(roomId,branch,[startColumn,row],90);
  joinHallways(branch,innerWestSpine,[33.5,row],90);
}

doorToRoom(1,centralSpine,[50,31],0,'open-passage',{door:false});
doorToRoom(1,westSouth,[32,35],90,'open-passage',{door:false});
doorToRoom(1,eastMain,[56,35],90,'open-passage',{door:false});
doorToRoom(1,entrancePassage,[44,39],0,'open-passage',{door:false});
doorToRoom(6,eastMain,[76,35],90,'open-passage',{door:false});
doorToRoom(6,eastSpine,[76,35],90,'open-passage',{door:false});

for(const [roomId,column,row,roomRow] of [[4,59.5,35,31],[5,64.5,35,31]]){
  const branch=hallway('',[[column,roomRow],[column,row]],1.5);
  doorToRoom(roomId,branch,[column,roomRow],0);
  joinHallways(branch,eastMain,[column,row],0);
}
for(const [roomId,column] of [[2,59.5],[3,64.5]]){
  const branch=hallway('',[[column,35],[column,40]],1.5);
  doorToRoom(roomId,branch,[column,40],0);
  joinHallways(branch,eastMain,[column,35],0);
}

const room14Neck=hallway('',[[70,7],[70,8]],1.5);
doorToRoom(14,room14Neck,[70,8],0);
joinHallways(room14Neck,northGallery,[70,7],0);

for(const [roomId,row,startColumn] of [[13,14.5,75],[10,21,75],[7,26.5,76],[11,16,82],[9,21,82],[8,26,82]]){
  const branch=hallway('',[[startColumn,row],[79,row]],1.5);
  doorToRoom(roomId,branch,[startColumn,row],90);
  joinHallways(branch,eastSpine,[79,row],90);
}

for(const [roomId,row,startColumn] of [[27,10,59],[28,10,62]]){
  const branch=hallway('',[[startColumn,row],[60.5,row]],1.25);
  doorToRoom(roomId,branch,[startColumn,row],90);
  joinHallways(branch,rightCentralSpine,[60.5,row],90);
}
doorToRoom(29,rightCentralSpine,[60.5,15],0);

const room38Neck=hallway('',[[37.5,39],[37.5,40]],1.5);
doorToRoom(1,room38Neck,[37.5,39],0);
doorToRoom(38,room38Neck,[37.5,40],0);

for(const [roomId,column,row] of [[39,24.5,43],[40,18.5,43]]){
  const branch=hallway('',[[column,row],[column,45]],1.5);
  doorToRoom(roomId,branch,[column,row],0);
  joinHallways(branch,westSouth,[column,45],0);
}

for(const [roomId,column,roomRow] of [[42,7.5,29],[44,3,29],[41,7.5,32],[43,3,32]]){
  const branch=hallway('',[[column,roomRow],[column,31]],1.25);
  doorToRoom(roomId,branch,[column,roomRow],0);
  joinHallways(branch,westCross,[column,31],0);
}

doorToRoom(45,westSouth,[14,24],0);

const room48To47=hallway('',[[5,16],[5.5,16]],1.5);
doorToRoom(48,room48To47,[5,16],90);
doorToRoom(47,room48To47,[5.5,16],90);
const room47To45=hallway('',[[8.5,16],[9,16]],1.5);
doorToRoom(47,room47To45,[8.5,16],90);
doorToRoom(45,room47To45,[9,16],90);
const room45To46=hallway('',[[19,16.5],[20,16.5]],1.5);
doorToRoom(45,room45To46,[19,16.5],90);
doorToRoom(46,room45To46,[20,16.5],90);
const room50Neck=hallway('',[[14,8],[14,9]],1.5);
doorToRoom(50,room50Neck,[14,8],0,'open-passage',{door:false});
doorToRoom(45,room50Neck,[14,9],0,'open-passage',{door:false});

marker('objective',44,35,'Central sigil','Star-shaped floor emblem shown in the center of room 1.');
marker('entrance',44,51,'Main entrance','Southern stair and primary entrance/exit.');
marker('stairs-up',44,48,'Entrance stair','Broad stair rising into the dungeon entrance passage.');

const counts=objects.reduce((result,object)=>{
  result[object.type]=(result[object.type]||0)+1;
  return result;
},{});

const payload={
  format:'Descendence Dungeon Draft',schemaVersion:4,
  grid:{coordinateUnit:'grid-cell',cellSize:24,origin:'top-left',axes:{column:'east',row:'south'}},
  dungeon:{
    title:'Reference Dungeon — 50 Chambers',activeFloorId:FLOOR_ID,
    floors:[{id:FLOOR_ID,name:'Ground',order:0,objectIds:objects.map(object=>object.id),connectionIds:connections.map(connection=>connection.id)}],
    objects,connections
  },
  summary:{objectCounts:counts,connectionCount:connections.length,invalidConnectionIds:[]},
  provenance:{
    source:'User-supplied reference image IMG_0916.jpeg',
    reconstruction:'Editable architectural approximation; room numbering and major topology preserved.'
  }
};

const scriptDirectory=path.dirname(fileURLToPath(import.meta.url));
const outputPath=path.resolve(scriptDirectory,'../examples/reference-dungeon-50-rooms.json');
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
// Keep the deployed example compact; the app's normal Download JSON action still produces an indented copy.
fs.writeFileSync(outputPath,`${JSON.stringify(payload)}\n`);
console.log(`Wrote ${outputPath}`);
console.log(`${counts.room} rooms, ${counts.hallway} hallways, ${counts.door} doors, ${counts.marker} markers, ${connections.length} connections`);
