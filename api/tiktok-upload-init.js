const {read}=require("../lib/session");
const {fresh}=require("../lib/tiktok");

const MAX_SIZE=4*1024*1024*1024;
const MAX_SINGLE=64*1000*1000;
const CHUNK=10*1000*1000;
const ALLOWED=new Set(["video/mp4","video/quicktime","video/webm"]);

module.exports=async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  try{
    let session=read(req);
    if(!session)return res.status(401).json({error:"Not authenticated"});
    session=await fresh(session,res);

    const size=Number(req.body?.size||0);
    const type=String(req.body?.type||"video/mp4");
    if(!Number.isFinite(size)||size<=0)return res.status(400).json({error:"Taille de fichier invalide"});
    if(size>MAX_SIZE)return res.status(400).json({error:"TikTok limite l'upload vidéo à 4 Go"});
    if(!ALLOWED.has(type))return res.status(400).json({error:"Format accepté : MP4, MOV ou WebM"});

    let chunkSize,totalChunks;
    if(size<=MAX_SINGLE){
      chunkSize=size;
      totalChunks=1;
    }else{
      chunkSize=CHUNK;
      totalChunks=Math.floor(size/chunkSize);
      if(totalChunks<1)totalChunks=1;
    }

    const rr=await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",{
      method:"POST",
      headers:{
        Authorization:`Bearer ${session.access_token}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        source_info:{
          source:"FILE_UPLOAD",
          video_size:size,
          chunk_size:chunkSize,
          total_chunk_count:totalChunks
        }
      })
    });

    const data=await rr.json();
    if(!rr.ok || (data.error?.code && data.error.code!=="ok")){
      throw new Error(data.error?.message||data.error?.code||"TikTok upload init error");
    }

    return res.status(200).json({
      publish_id:data.data?.publish_id,
      upload_url:data.data?.upload_url,
      chunk_size:chunkSize,
      total_chunk_count:totalChunks
    });
  }catch(e){
    return res.status(500).json({error:String(e.message||e)});
  }
};
