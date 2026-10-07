const {loadMemory,updateEntry}=require("../lib/nyra-memory");

module.exports=async function handler(req,res){
  try{
    if(req.method==="GET"){
      const out=await loadMemory();
      return res.status(200).json(out);
    }
    if(req.method==="POST"){
      const {action,id,patch}=req.body||{};
      if(action==="update_entry"){
        if(!id || !patch)return res.status(400).json({error:"id/patch manquant"});
        const out=await updateEntry(id,patch);
        return res.status(200).json(out);
      }
      return res.status(400).json({error:"Action inconnue"});
    }
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){
    return res.status(500).json({error:String(e.message||e)});
  }
};
