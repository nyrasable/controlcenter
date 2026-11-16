// Stockage isole : ne modifie jamais la cle de memoire creative Nyra Brain.
const KEY=process.env.NYRA_LAB_KEY||'nyra:lab:v4.5';
const URL=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
const TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
async function command(args){
  if(!URL||!TOKEN)throw new Error('Upstash Redis non configure : historique indisponible');
  const r=await fetch(URL,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const data=await r.json();if(!r.ok||data.error)throw new Error('Erreur de stockage');
  return data.result;
}
async function list(){const raw=await command(['GET',KEY]);let arr;try{arr=raw?JSON.parse(raw):[]}catch{arr=[]}return Array.isArray(arr)?arr:[]}
async function write(rows){await command(['SET',KEY,JSON.stringify(rows.slice(-60))])}
async function create(item){const rows=await list();rows.push(item);await write(rows);return item}
async function update(id,patch){const rows=await list();const i=rows.findIndex(r=>r.id===id);if(i<0)return null;rows[i]={...rows[i],...patch,updatedAt:new Date().toISOString()};await write(rows);return rows[i]}
module.exports={list,create,update};
