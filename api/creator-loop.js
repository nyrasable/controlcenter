const {loadMemory}=require("../lib/nyra-memory");

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  try{
    const {available,memory}=await loadMemory();
    const decisions=memory?.decisions||[];
    const linked=decisions.filter(d=>d.linkedVideoId).length;
    const measured=decisions.filter(d=>d.status==="measured").length;
    return res.status(200).json({
      ok:true,
      memory_available:available,
      decisions:decisions.length,
      linked,
      measured,
      version:"4.2"
    });
  }catch(e){
    return res.status(500).json({error:String(e.message||e)});
  }
};
