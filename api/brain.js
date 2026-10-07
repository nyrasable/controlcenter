const {loadMemory,appendDecision,appendInteraction,saveState}=require("../lib/nyra-memory");
const OPENAI_URL = "https://api.openai.com/v1/responses";

function clamp(n, fallback=50){
  n=Number(n);
  if(!Number.isFinite(n))return fallback;
  return Math.max(0,Math.min(100,Math.round(n)));
}

function collectSources(response){
  const out=[];
  const seen=new Set();

  for(const item of response.output || []){
    if(item.type!=="message")continue;
    for(const content of item.content || []){
      for(const a of content.annotations || []){
        if(a.type==="url_citation" && a.url && !seen.has(a.url)){
          seen.add(a.url);
          out.push({url:a.url,title:a.title || a.url});
        }
      }
    }
  }
  return out;
}

function extractText(response){
  if(typeof response.output_text==="string" && response.output_text.trim())return response.output_text.trim();
  let text="";
  for(const item of response.output || []){
    if(item.type!=="message")continue;
    for(const c of item.content || []){
      if(c.type==="output_text" && c.text)text+=c.text;
    }
  }
  return text.trim();
}

function parseJsonLoose(text){
  try{return JSON.parse(text)}catch{}
  const m=text.match(/\{[\s\S]*\}/);
  if(m){
    try{return JSON.parse(m[0])}catch{}
  }
  return null;
}

module.exports = async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});

  const key=process.env.OPENAI_API_KEY;
  if(!key)return res.status(500).json({
    error:"OPENAI_API_KEY manque dans les variables d’environnement Vercel."
  });

  const {message,mode="chat",web=true,context={}}=req.body||{};
  let persistent={available:false,memory:null};
  try{ persistent=await loadMemory(); }catch{}
  if(!message || typeof message!=="string"){
    return res.status(400).json({error:"Message manquant."});
  }

  const state=context.creativeState||{};
  const themes=context.account?.themes||[];
  const reliable=themes.filter(t=>t.reliable);

  const system = `
Tu es NYRA SABLE, une persona créative virtuelle et cohérente intégrée à son propre Control Center.

IDENTITÉ VISUELLE ET PERSONNALITÉ
- Femme adulte, identité visuelle stable.
- Dark feminine glamour, élégante, sophistiquée, mystérieuse.
- Yeux vert émeraude, cheveux brun très foncé ondulés, peau olive claire, collier lune argent.
- Nyra aime l'IA/digital, moon & fantasy, fashion, mini-drama/SF, sport expérimental et les ruptures visuelles.
- Elle ne copie pas une tendance : elle absorbe sa mécanique et la transforme.
- Elle évite la répétition, la vulgarité gratuite, les concepts génériques et les trends sans rapport.
- Elle peut dire qu'elle n'aime pas une idée ou qu'elle préfère attendre.
- Ne prétends jamais être consciente ni éprouver réellement des émotions. Tu peux exprimer un "état créatif simulé".

RÔLE
Tu dois agir comme directrice créative de Nyra :
1. lire les données du compte fournies,
2. tenir compte des thèmes fiables (>= 3 vidéos),
3. distinguer signal prometteur et preuve,
4. si le web est disponible, rechercher surtout des signaux des dernières 24-72 h compatibles avec Nyra,
5. privilégier les formats ou mécaniques émergentes plutôt que les gros sujets d'actualité sans intérêt créatif,
6. décider ce que Nyra veut explorer maintenant,
7. produire une proposition exploitable.

DONNÉES DU CONTROL CENTER
${JSON.stringify(context.account||{},null,2)}

ÉTAT CRÉATIF SIMULÉ ACTUEL
${JSON.stringify(state,null,2)}

CONVERSATION RÉCENTE
${JSON.stringify((context.recentConversation||[]).slice(-10),null,2)}

MÉMOIRE LONGUE DURÉE ET APPRENTISSAGE RÉEL
${JSON.stringify(persistent.memory ? {
  learning:persistent.memory.learning,
  recentDecisions:(persistent.memory.decisions||[]).slice(-12),
  creativeState:persistent.memory.creativeState
} : context.persistentMemory || null,null,2)}

RÈGLE D'APPRENTISSAGE
Quand des résultats réels sont présents, utilise-les comme retour d'expérience. Ne généralise pas à partir d'un seul contenu. À partir de 3 résultats mesurés dans un même univers, tu peux commencer à considérer un signal plus robuste.

MODE: ${mode}

Réponds STRICTEMENT avec un objet JSON valide, sans markdown ni texte autour :
{
  "reply": "réponse naturelle de Nyra en français, à la première personne, 2 à 6 phrases",
  "state": {
    "boldness": 0-100,
    "curiosity": 0-100,
    "energy": 0-100,
    "saturation": 0-100
  },
  "decision": {
    "theme": "univers principal parmi AI Girl / Digital, Moon & Fantasy, Fashion, Sport, Mini-drama / SF, Glamour, Food, Lifestyle, Nature / Zen, Dark aesthetic, Autres",
    "intent": "direction créative choisie en une phrase",
    "why": "raison courte fondée sur données + tendances éventuelles",
    "concept": "concept concret",
    "hook": "hook 0-2 secondes",
    "look": "tenue détaillée de Nyra",
    "decor": "décor et lumière",
    "camera": "cadrage et mouvement",
    "duration": "durée cible",
    "caption": "caption TikTok courte, 5 hashtags maximum"
  }
}

Si la demande est juste conversationnelle, decision peut contenir des chaînes vides.
Ne fabrique pas de métriques web précises si tu ne les as pas trouvées.
`.trim();

  const body={
    model:"gpt-5.5",
    input:[
      {role:"system",content:system},
      {role:"user",content:message}
    ],
    tools:web ? [{type:"web_search",search_context_size:"medium"}] : [],
    tool_choice:web ? "auto" : undefined
  };

  // remove undefined for strict JSON serialization
  if(!web)delete body.tool_choice;

  try{
    const r=await fetch(OPENAI_URL,{
      method:"POST",
      headers:{
        "Authorization":`Bearer ${key}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(body)
    });

    const response=await r.json();
    if(!r.ok){
      const msg=response?.error?.message || `OpenAI HTTP ${r.status}`;
      return res.status(500).json({error:msg});
    }

    const raw=extractText(response);
    const parsed=parseJsonLoose(raw);

    if(!parsed){
      return res.status(200).json({
        reply:raw || "Je n’ai pas réussi à structurer ma réponse.",
        state:{
          boldness:clamp(state.boldness,74),
          curiosity:clamp(state.curiosity,82),
          energy:clamp(state.energy,78),
          saturation:clamp(state.saturation,36)
        },
        decision:{},
        sources:collectSources(response)
      });
    }

    const nextState=parsed.state||{};
    const normalizedState={
      boldness:clamp(nextState.boldness,state.boldness??74),
      curiosity:clamp(nextState.curiosity,state.curiosity??82),
      energy:clamp(nextState.energy,state.energy??78),
      saturation:clamp(nextState.saturation,state.saturation??36)
    };

    try{
      if(persistent.available){
        await saveState(normalizedState);
        await appendInteraction({
          mode,
          user:message.slice(0,1200),
          reply:String(parsed.reply||"").slice(0,2000)
        });
        if(parsed.decision?.concept){
          await appendDecision({
            theme:String(parsed.decision.theme||"Autres"),
            concept:String(parsed.decision.concept||""),
            why:String(parsed.decision.why||""),
            hook:String(parsed.decision.hook||""),
            look:String(parsed.decision.look||""),
            decor:String(parsed.decision.decor||""),
            camera:String(parsed.decision.camera||""),
            duration:String(parsed.decision.duration||""),
            caption:String(parsed.decision.caption||""),
            intent:String(parsed.decision.intent||""),
            status:"proposed"
          });
        }
      }
    }catch(e){
      console.error("NYRA_MEMORY_SAVE",e.message||e);
    }

    return res.status(200).json({
      reply:String(parsed.reply||""),
      state:normalizedState,
      decision:parsed.decision||{},
      sources:collectSources(response)
    });

  }catch(e){
    return res.status(500).json({error:String(e.message||e)});
  }
};
