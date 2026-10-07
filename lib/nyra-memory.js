const KEY = process.env.NYRA_MEMORY_KEY || "nyra:memory:v4.1"; // keep same key so V4.1 history migrates automatically

function redisConfig(){
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  };
}

async function command(args){
  const {url,token}=redisConfig();
  if(!url || !token) return {configured:false,result:null};

  const r=await fetch(url,{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${token}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(args)
  });
  const data=await r.json();
  if(!r.ok)throw new Error(data?.error || `Redis HTTP ${r.status}`);
  return {configured:true,result:data.result};
}

function emptyMemory(){
  return {
    version:"4.2",
    creativeState:{boldness:74,curiosity:82,energy:78,saturation:36},
    decisions:[],
    interactions:[],
    learning:{totalMeasured:0,byTheme:{}},
    updatedAt:new Date().toISOString()
  };
}

function rebuildLearning(memory){
  const byTheme={};
  let totalMeasured=0;
  for(const d of memory.decisions||[]){
    if(d.status!=="measured" || !d.result)continue;
    totalMeasured++;
    const theme=d.theme || "Autres";
    const r=d.result;
    const views=Number(r.views||0);
    const engagement=views
      ? ((Number(r.likes||0)+Number(r.comments||0)+Number(r.shares||0))/views)*100
      : 0;
    if(!byTheme[theme])byTheme[theme]={measured:0,totalViews:0,totalEngagement:0,avgViews:0,avgEngagement:0};
    const t=byTheme[theme];
    t.measured++;
    t.totalViews+=views;
    t.totalEngagement+=engagement;
    t.avgViews=t.totalViews/t.measured;
    t.avgEngagement=t.totalEngagement/t.measured;
  }
  memory.learning={totalMeasured,byTheme};
  return memory;
}

async function loadMemory(){
  const out=await command(["GET",KEY]);
  if(!out.configured)return {available:false,memory:emptyMemory()};
  if(!out.result)return {available:true,memory:emptyMemory()};
  try{return {available:true,memory:rebuildLearning(JSON.parse(out.result))}}
  catch{return {available:true,memory:emptyMemory()}}
}

async function saveMemory(memory){
  memory.updatedAt=new Date().toISOString();
  rebuildLearning(memory);
  const out=await command(["SET",KEY,JSON.stringify(memory)]);
  return {available:out.configured,memory};
}

async function appendDecision(decision){
  const {available,memory}=await loadMemory();
  if(!available)return {available:false,memory};
  const entry={
    id:decision.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    createdAt:decision.createdAt || new Date().toISOString(),
    status:decision.status || "proposed",
    ...decision
  };
  memory.decisions=(memory.decisions||[]).concat(entry).slice(-120);
  return saveMemory(memory);
}

async function appendInteraction(interaction){
  const {available,memory}=await loadMemory();
  if(!available)return {available:false,memory};
  memory.interactions=(memory.interactions||[]).concat({
    at:new Date().toISOString(),...interaction
  }).slice(-80);
  return saveMemory(memory);
}

async function saveState(state){
  const {available,memory}=await loadMemory();
  if(!available)return {available:false,memory};
  memory.creativeState={...memory.creativeState,...state};
  return saveMemory(memory);
}

async function updateEntry(id,patch){
  const {available,memory}=await loadMemory();
  if(!available)return {available:false,memory};
  const i=(memory.decisions||[]).findIndex(x=>x.id===id);
  if(i<0)throw new Error("Décision introuvable");
  memory.decisions[i]={...memory.decisions[i],...patch};
  return saveMemory(memory);
}

module.exports={loadMemory,saveMemory,appendDecision,appendInteraction,saveState,updateEntry};
