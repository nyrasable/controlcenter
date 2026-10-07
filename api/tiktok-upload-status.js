const {read}=require("../lib/session");
const {fresh}=require("../lib/tiktok");

module.exports=async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    let session=read(req);
    if(!session)return res.status(401).json({error:"Not authenticated"});
    session=await fresh(session,res);

    const publish_id=String(req.body?.publish_id||"");
    if(!publish_id)return res.status(400).json({error:"publish_id manquant"});

    const rr=await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/",{
      method:"POST",
      headers:{
        Authorization:`Bearer ${session.access_token}`,
        "Content-Type":"application/json; charset=UTF-8"
      },
      body:JSON.stringify({publish_id})
    });

    const data=await rr.json();
    if(!rr.ok || (data.error?.code && data.error.code!=="ok")){
      throw new Error(data.error?.message||data.error?.code||"TikTok status error");
    }

    return res.status(200).json({
      status:data.data?.status||null,
      fail_reason:data.data?.fail_reason||null,
      uploaded_bytes:data.data?.uploaded_bytes||0,
      post_ids:data.data?.publicaly_available_post_id||[]
    });
  }catch(e){
    return res.status(500).json({error:String(e.message||e)});
  }
};
