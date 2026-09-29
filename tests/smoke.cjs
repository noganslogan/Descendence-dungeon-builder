const fs=require('fs');
const vm=require('vm');

const html=fs.readFileSync(new URL('../index.html',`file://${__filename}`).pathname,'utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];

class ClassList{
  constructor(){this.values=new Set()}
  add(...names){names.forEach(name=>this.values.add(name))}
  remove(...names){names.forEach(name=>this.values.delete(name))}
  contains(name){return this.values.has(name)}
  toggle(name,force){
    const next=force===undefined?!this.values.has(name):Boolean(force);
    if(next)this.values.add(name);else this.values.delete(name);
    return next;
  }
}

function dataKey(name){return name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())}

class Element{
  constructor(tagName='div'){
    this.tagName=tagName.toUpperCase();
    this.attributes={};
    this.dataset={};
    this.children=[];
    this.parentNode=null;
    this.listeners={};
    this.classList=new ClassList();
    this.style={};
    this.hidden=false;
    this.value='';
    this.textContent='';
    this.files=[];
    this.clientWidth=390;
    this.clientHeight=690;
    this._innerHTML='';
  }
  set id(value){this.attributes.id=String(value)}
  get id(){return this.attributes.id||''}
  set className(value){this.attributes.class=String(value);String(value).split(/\s+/).filter(Boolean).forEach(name=>this.classList.add(name))}
  get className(){return this.attributes.class||''}
  set innerHTML(value){this._innerHTML=String(value);if(value==='')this.children=[]}
  get innerHTML(){return this._innerHTML}
  setAttribute(name,value){
    this.attributes[name]=String(value);
    if(name==='id')this.id=value;
    if(name==='class')this.className=value;
    if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);
    if(name==='hidden')this.hidden=true;
    if(name==='value')this.value=String(value);
  }
  getAttribute(name){return this.attributes[name]??null}
  appendChild(child){child.parentNode=this;this.children.push(child);return child}
  append(...children){children.forEach(child=>this.appendChild(child))}
  addEventListener(type,listener){(this.listeners[type]||(this.listeners[type]=[])).push(listener)}
  dispatchEvent(event){
    event.target=event.target||this;
    event.currentTarget=this;
    event.preventDefault=event.preventDefault||(()=>{event.defaultPrevented=true});
    (this.listeners[event.type]||[]).forEach(listener=>listener(event));
    return !event.defaultPrevented;
  }
  click(){this.dispatchEvent({type:'click',target:this,preventDefault(){}})}
  closest(selector){
    let element=this;
    while(element){
      if(selector.startsWith('#')&&element.id===selector.slice(1))return element;
      const match=selector.match(/^\[data-([a-z0-9-]+)\]$/);
      if(match&&element.dataset[dataKey(`data-${match[1]}`)]!==undefined)return element;
      element=element.parentNode;
    }
    return null;
  }
  getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight,right:this.clientWidth,bottom:this.clientHeight}}
  setPointerCapture(){}
}

class Document{
  constructor(markup){
    this.byId=new Map();
    this.elements=[];
    const tagPattern=/<([a-zA-Z][\w-]*)\b([^>]*)>/g;
    let match;
    while((match=tagPattern.exec(markup))){
      const element=new Element(match[1]);
      const attributePattern=/([:\w-]+)(?:="([^"]*)")?/g;
      let attribute;
      while((attribute=attributePattern.exec(match[2]))){
        const [,name,value='']=attribute;
        element.setAttribute(name,value);
      }
      if(element.id&&this.byId.has(element.id))continue;
      this.elements.push(element);
      if(element.id)this.byId.set(element.id,element);
    }
    this.getElementById('workspace').clientWidth=390;
    this.getElementById('workspace').clientHeight=690;
    this.getElementById('board').clientWidth=390;
    this.getElementById('board').clientHeight=690;
  }
  getElementById(id){
    if(!this.byId.has(id)){
      const element=new Element();element.id=id;this.byId.set(id,element);this.elements.push(element);
    }
    return this.byId.get(id);
  }
  createElement(tag){return new Element(tag)}
  createElementNS(_namespace,tag){return new Element(tag)}
  querySelectorAll(selector){
    const match=selector.match(/^\[data-([a-z0-9-]+)\]$/);
    if(!match)return [];
    const key=dataKey(`data-${match[1]}`);
    return this.elements.filter(element=>element.dataset[key]!==undefined);
  }
}

const document=new Document(html);
const saved=new Map();
const context={
  document,
  console,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Map,
  Set,
  Date,
  RegExp,
  Error,
  URL,
  URLSearchParams,
  Blob,
  setTimeout,
  clearTimeout,
  location:{search:'?test'},
  navigator:{vibrate(){},clipboard:{async writeText(){}}},
  localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  ResizeObserver:class{observe(){}},
  confirm:()=>true,
  prompt:()=>'',
  alert:message=>{throw new Error(message)},
  addEventListener(){},
};
context.window=context;
vm.createContext(context);
new vm.Script(source,{filename:'index.html'}).runInContext(context);

const api=context.__DESCENDENCE_TEST__;
const board=document.getElementById('board');
const GRID_FOR_TEST=24;
let assertions=0;
function assert(condition,message){
  assertions++;
  if(!condition)throw new Error(`Assertion ${assertions} failed: ${message}`);
}
function closeTo(value,expected,tolerance=.01){return Math.abs(value-expected)<=tolerance}
function elementsWith(key,value){return document.elements.filter(element=>element.dataset[key]===value)}
function clickData(key,value){
  const element=elementsWith(key,value)[0];
  if(!element)throw new Error(`Missing data-${key}=${value}`);
  element.click();
  return element;
}
function pointer(type,clientX,clientY,{pointerId=1,pointerType='mouse',target=board}={}){
  board.dispatchEvent({type,clientX,clientY,pointerId,pointerType,button:0,target,preventDefault(){}});
}
function worldToClient(point){
  const viewport=api.getViewport();
  return {x:(point.x-viewport.x)*viewport.zoom,y:(point.y-viewport.y)*viewport.zoom};
}
function drawWorld(points,{pointerType='mouse',pointerId=1,target=board}={}){
  const first=worldToClient(points[0]);
  pointer('pointerdown',first.x,first.y,{pointerId,pointerType,target});
  points.slice(1).forEach(point=>{
    const client=worldToClient(point);
    pointer('pointermove',client.x,client.y,{pointerId,pointerType,target});
  });
  const last=worldToClient(points[points.length-1]);
  pointer('pointerup',last.x,last.y,{pointerId,pointerType,target});
}
function empty(){api.setState({schemaVersion:4,objects:[],connections:[]})}
function renderedObject(id){
  for(const layerId of ['structures','details']){
    const found=document.getElementById(layerId).children.find(element=>String(element.dataset.id)===String(id));
    if(found)return found;
  }
  return null;
}

// Legacy data migrates without losing its old square path behavior.
const legacy=api.normalizeState({schemaVersion:2,objects:[{id:7,type:'corridor',points:[[0,0],[0,72],[48,72]],label:'Old shaft'}]});
assert(legacy.schemaVersion===4,'legacy save upgrades to schema 4');
assert(legacy.objects[0].type==='hallway','corridor migrates to hallway');
assert(legacy.objects[0].pathStyle==='constructed','legacy corridor remains constructed');
assert(legacy.objects[0].points.length===3,'legacy path points survive');

// Existing room and hallway rectangle drawing remains the default.
empty();
clickData('tool','room');
clickData('roomMode','rectangle');
drawWorld([{x:24,y:24},{x:120,y:96}]);
let state=api.getState();
assert(state.objects.length===1&&state.objects[0].type==='room','rectangle room still draws');
assert(state.objects[0].shape==='rect'&&state.objects[0].w===96&&state.objects[0].h===72,'room remains grid sized');
clickData('tool','hallway');
clickData('hallwayMode','block');
drawWorld([{x:120,y:48},{x:216,y:72}]);
state=api.getState();
assert(state.objects.some(object=>object.type==='hallway'&&object.shape==='rect'),'block hallway still draws');

// A cavern is a semantic room with a smooth closed outline.
empty();
clickData('tool','room');
clickData('roomMode','cavern');
drawWorld([{x:24,y:24},{x:96,y:12},{x:156,y:60},{x:132,y:132},{x:48,y:144},{x:12,y:72},{x:24,y:24}]);
state=api.getState();
assert(state.objects.length===1,'cavern creates one object');
assert(state.objects[0].type==='room'&&state.objects[0].subtype==='cavern','cavern remains a semantic room');
assert(state.objects[0].shape==='outline'&&state.objects[0].points.length>=3,'cavern stores an editable outline');
assert(api.sampleObject(state.objects[0].id).length>state.objects[0].points.length,'cavern curve is sampled smoothly');
let payload=api.export();
assert(payload.schemaVersion===4,'export uses schema 4');
assert(payload.dungeon.objects[0].geometry.kind==='outline','cavern exports outline geometry');
assert(payload.dungeon.objects[0].geometry.closed===true,'cavern export is explicitly closed');

// A tunnel captures a smooth centerline and its chosen width.
empty();
clickData('tool','hallway');
clickData('hallwayMode','tunnel');
clickData('tunnelWidth','2');
drawWorld([{x:24,y:48},{x:72,y:24},{x:120,y:60},{x:168,y:36},{x:216,y:84}]);
state=api.getState();
assert(state.objects.length===1&&state.objects[0].subtype==='mine-tunnel','freehand creates a mine tunnel');
assert(state.objects[0].pathStyle==='curved'&&state.objects[0].smoothing==='curve','tunnel stores curved geometry');
assert(state.objects[0].widthCells===2,'tunnel width picker is respected');
payload=api.export();
assert(payload.dungeon.objects[0].geometry.kind==='centerline','tunnel exports a centerline');
assert(payload.dungeon.objects[0].geometry.widthCells===2,'tunnel width is semantic in JSON');
assert(!('d' in payload.dungeon.objects[0].geometry),'export does not depend on SVG path data');

// Starting a second touch cancels a one-finger drawing and becomes a pinch.
empty();
clickData('tool','hallway');
clickData('hallwayMode','tunnel');
let first=worldToClient({x:24,y:24}),second=worldToClient({x:120,y:120});
pointer('pointerdown',first.x,first.y,{pointerId:1,pointerType:'touch'});
pointer('pointermove',first.x+30,first.y+10,{pointerId:1,pointerType:'touch'});
pointer('pointerdown',second.x,second.y,{pointerId:2,pointerType:'touch'});
pointer('pointermove',first.x-10,first.y-10,{pointerId:1,pointerType:'touch'});
pointer('pointerup',first.x-10,first.y-10,{pointerId:1,pointerType:'touch'});
pointer('pointerup',second.x,second.y,{pointerId:2,pointerType:'touch'});
assert(api.getState().objects.length===0,'pinch does not leave a partial tunnel');
assert(api.getViewport().zoom!==1,'pinch updates zoom');

// Organic connection detection accepts thresholds, endpoint joins, and clean crossings.
api.setState({objects:[
  {id:1,type:'room',x:96,y:96,w:96,h:96},
  {id:2,type:'hallway',x:0,y:120,w:96,h:24}
]});
let connection=api.detectConnection(2,1);
assert(connection&&connection.contact==='edge','existing block hallway connection detection still works');
assert(connection.orientation==='vertical','existing rectangular threshold orientation remains correct');

api.setState({objects:[
  {id:1,type:'room',x:240,y:240,w:96,h:96},
  {id:2,type:'hallway',shape:'path',pathStyle:'curved',smoothing:'curve',widthCells:1.25,points:[[96,288],[180,276],[252,288]]}
]});
connection=api.detectConnection(2,1);
assert(connection&&connection.contact==='threshold','tunnel endpoint finds a room threshold');
assert(angleDifferenceForTest(connection.angle,90)<2,'room threshold angle follows its wall');

api.setState({objects:[
  {id:1,type:'hallway',shape:'path',widthCells:1.25,points:[[0,0],[96,0]]},
  {id:2,type:'hallway',shape:'path',widthCells:1.25,points:[[96,0],[168,30],[216,72]]}
]});
connection=api.detectConnection(2,1);
assert(connection&&connection.contact==='endpoint','two tunnel endpoints connect');

api.setState({objects:[
  {id:1,type:'hallway',shape:'path',widthCells:1.25,points:[[0,48],[192,48]]},
  {id:2,type:'hallway',shape:'path',widthCells:1.25,points:[[96,-48],[96,144]]}
]});
connection=api.detectConnection(2,1);
assert(connection&&connection.contact==='crossing','a single clear tunnel crossing connects');

api.setState({objects:[
  {id:1,type:'hallway',shape:'path',widthCells:1.25,points:[[0,0],[120,0]]},
  {id:2,type:'hallway',shape:'path',widthCells:1.25,points:[[30,0],[80,0]]}
]});
assert(api.detectConnection(2,1)===null,'deep parallel overlap is not treated as a connection');

api.setState({objects:[
  {id:1,type:'room',shape:'outline',subtype:'cavern',smoothing:'curve',points:[[240,240],[360,228],[384,312],[324,372],[228,336]]},
  {id:2,type:'hallway',shape:'path',pathStyle:'curved',smoothing:'curve',widthCells:1.25,points:[[96,300],[180,288],[246,300]]}
]});
connection=api.detectConnection(2,1);
assert(connection&&connection.contact==='threshold','tunnel endpoint connects to a cavern boundary');

api.setState({objects:[
  {id:1,type:'room',x:240,y:240,w:96,h:96},
  {id:2,type:'hallway',shape:'path',pathStyle:'curved',smoothing:'curve',widthCells:1.25,points:[[96,288],[180,276],[252,288]]},
  {id:3,type:'door',x:240,y:288,angle:90,doorType:'door',connectionId:1}
],connections:[{id:1,type:'door',fromObjectId:2,toObjectId:1,position:{x:240,y:288},angle:90,doorObjectId:3}]});
assert(api.getState().connections[0].status==='valid','curved connection validates after loading');
const disconnected=api.getState();
disconnected.objects.find(object=>object.id===2).points=disconnected.objects.find(object=>object.id===2).points.map(point=>[point[0]-240,point[1]]);
api.setState(disconnected);
assert(api.getState().connections[0].status==='invalid','moving curved geometry away invalidates its connection');

// Drawing into a room offers a smart angled door and persists the relationship.
api.setState({objects:[{id:1,type:'room',x:240,y:240,w:96,h:96}],connections:[]});
clickData('tool','hallway');
clickData('hallwayMode','tunnel');
clickData('tunnelWidth','1.25');
drawWorld([{x:96,y:288},{x:168,y:276},{x:216,y:288},{x:252,y:288}]);
assert(document.getElementById('sheetTitle').textContent==='Smart Connection','new tunnel opens the smart connection prompt');
clickData('connectionChoice','door');
state=api.getState();
assert(state.connections.length===1&&state.connections[0].type==='door','door choice creates a semantic connection');
const linkedDoor=state.objects.find(object=>object.type==='door');
assert(Boolean(linkedDoor)&&linkedDoor.connectionId===state.connections[0].id,'generated door links back to its connection');
assert(angleDifferenceForTest(linkedDoor.angle,90)<2,'generated door follows the curved threshold angle');

// Schema 4 export/import retains organic geometry and relationships.
payload=api.export();
const roundTrip=api.normalizeState(payload);
assert(roundTrip.objects.some(object=>object.subtype==='mine-tunnel'),'round trip retains tunnel subtype');
assert(roundTrip.objects.some(object=>object.type==='door'&&Number.isFinite(object.angle)),'round trip retains angled doors');
assert(roundTrip.connections.length===1&&roundTrip.connections[0].status==='valid','round trip retains valid connections');

// Whole-object movement remains grid snapped for organic geometry.
api.setState({objects:[{id:8,type:'hallway',shape:'path',pathStyle:'curved',smoothing:'curve',widthCells:1.25,points:[[24,24],[72,48],[120,24]]}]});
clickData('tool','select');
let group=renderedObject(8),shape=group.children[0];
let start=worldToClient({x:24,y:24});
pointer('pointerdown',start.x,start.y,{target:shape});
pointer('pointerup',start.x,start.y,{target:shape});
document.getElementById('closeSheet').click();
const viewport=api.getViewport();
pointer('pointerdown',start.x,start.y,{target:shape});
pointer('pointermove',start.x+GRID_FOR_TEST*viewport.zoom,start.y,{target:shape});
pointer('pointerup',start.x+GRID_FOR_TEST*viewport.zoom,start.y,{target:shape});
state=api.getState();
assert(state.objects[0].points[0][0]===48,`moving a tunnel snaps by one grid cell (received ${JSON.stringify(state.objects[0].points)})`);
assert(state.objects[0].points[1][0]===96,'every tunnel control point moves together');

// Selected tunnel width can be adjusted later without redrawing it.
const widthField=document.getElementById('tunnelWidthField');
widthField.value='2.5';
widthField.dispatchEvent({type:'input',target:widthField,preventDefault(){}});
assert(api.getState().objects[0].widthCells===2.5,'selected tunnel width remains editable');

// Explicit shape editing moves a control point on the half-grid.
document.getElementById('editShapeBtn').click();
assert(document.getElementById('handles').children.length===3,'edit mode shows the simplified control points');
const handle=document.getElementById('handles').children[1];
const before=api.getState().objects[0].points[1].slice();
const handleClient=worldToClient({x:before[0],y:before[1]});
pointer('pointerdown',handleClient.x,handleClient.y,{target:handle});
pointer('pointermove',handleClient.x,handleClient.y+12*api.getViewport().zoom,{target:handle});
pointer('pointerup',handleClient.x,handleClient.y+12*api.getViewport().zoom,{target:handle});
state=api.getState();
assert(state.objects[0].points[1][1]===before[1]+12,'control point editing uses half-grid snapping');
document.getElementById('finishShapeEditBtn').click();
assert(document.getElementById('shapeEditControls').hidden===true,'Done Editing exits explicit edit mode');

// A normal touch swipe on a selected object does not accidentally move it.
document.getElementById('closeSheet').click();
group=renderedObject(8);shape=group.children[0];
const untouched=api.getState().objects[0].points.map(point=>point.slice());
start=worldToClient({x:untouched[0][0],y:untouched[0][1]});
pointer('pointerdown',start.x,start.y,{pointerId:3,pointerType:'touch',target:shape});
pointer('pointermove',start.x+40,start.y,{pointerId:3,pointerType:'touch',target:shape});
pointer('pointerup',start.x+40,start.y,{pointerId:3,pointerType:'touch',target:shape});
assert(JSON.stringify(api.getState().objects[0].points)===JSON.stringify(untouched),'touch swipe does not move without the hold gesture');

// Marker and standalone door creation still work after the gesture changes.
empty();
clickData('tool','marker');
document.getElementById('markerGrid').children[0].click();
drawWorld([{x:48,y:48}]);
clickData('tool','door');
drawWorld([{x:96,y:48}]);
state=api.getState();
assert(state.objects.some(object=>object.type==='marker'),'marker placement still works');
assert(state.objects.some(object=>object.type==='door'),'standalone door placement still works');
document.getElementById('undoBtn').click();
assert(api.getState().objects.some(object=>object.type==='marker')&&!api.getState().objects.some(object=>object.type==='door'),'undo removes the most recent standalone door');

// The bundled 50-room reconstruction is a real, editable dungeon—not a flattened reference image.
const referenceDungeon=JSON.parse(fs.readFileSync(new URL('../examples/reference-dungeon-50-rooms.json',`file://${__filename}`).pathname,'utf8'));
api.setState(referenceDungeon);
state=api.getState();
assert(api.getViewport().zoom<.25,'fit can show a wide 50-room dungeon on a phone-sized canvas');
assert(state.objects.filter(object=>object.type==='room').length===50,'reference dungeon imports all 50 numbered rooms');
assert(state.objects.some(object=>object.type==='room'&&object.label==='32'&&object.shape==='outline'),'reference dungeon keeps the six-sided room editable');
assert(state.objects.some(object=>object.type==='room'&&object.label==='45'&&object.shape==='outline'),'reference dungeon keeps the rounded western hall editable');
assert(state.objects.some(object=>object.type==='marker'&&object.markerType==='entrance'),'reference dungeon includes a semantic main entrance');
const invalidReferenceConnections=state.connections.filter(connection=>connection.status!=='valid');
assert(invalidReferenceConnections.length===0,`reference dungeon imports with valid topology (${invalidReferenceConnections.map(connection=>`${connection.id}: ${connection.reason}`).join(', ')})`);
payload=api.export();
assert(payload.dungeon.connections.length===referenceDungeon.dungeon.connections.length,'reference topology survives an export round trip');
assert(payload.summary.invalidConnectionIds.length===0,'reference export reports no invalid connections');

// Empty-canvas drag and wheel navigation remain functional.
empty();
clickData('tool','select');
let navigationBefore=api.getViewport();
pointer('pointerdown',120,140);
pointer('pointermove',168,188);
pointer('pointerup',168,188);
let navigationAfter=api.getViewport();
assert(navigationAfter.x<navigationBefore.x&&navigationAfter.y<navigationBefore.y,'select-mode empty canvas drag pans');
document.getElementById('workspace').dispatchEvent({type:'wheel',target:board,clientX:180,clientY:220,deltaY:-120,deltaMode:0,preventDefault(){}});
assert(api.getViewport().zoom>navigationAfter.zoom,'desktop wheel zoom remains functional');

// The new autosave key persists organic geometry and remains normalizable.
api.setState({objects:[{id:3,type:'room',shape:'outline',subtype:'cavern',smoothing:'curve',points:[[0,0],[72,0],[72,72],[0,72]]}]});

function angleDifferenceForTest(first,second){
  const a=((first%180)+180)%180,b=((second%180)+180)%180;
  return Math.min(Math.abs(a-b),180-Math.abs(a-b));
}

setTimeout(()=>{
  assert(saved.has('descendenceDungeonDraftV4'),'schema 4 autosave is written');
  const autosaved=JSON.parse(saved.get('descendenceDungeonDraftV4'));
  assert(autosaved.objects[0].subtype==='cavern','autosave retains organic geometry');
  assert(api.normalizeState(autosaved).objects[0].shape==='outline','autosave reload normalization succeeds');
  console.log(`Smoke suite passed: ${assertions} assertions`);
},180);
