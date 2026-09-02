"use client";

import { useEffect, useState } from "react";

type Project = { id:string; name:string; status?:string; plan?:string };
type Production = { workflows?:Array<{status?:string}>; tasks?:Array<{task_key:string;status:string}>; artifacts?:Array<{id:string;kind:string}> };
type RequestItem = { id:string; title?:string; body?:string; status?:string };
type Message = { id:string; content:string; author_type?:string; created_at?:string };

const core = process.env.NEXT_PUBLIC_CORE_API_URL || "https://akinael-ai.com";

export default function PortalPage(){
  const [projects,setProjects]=useState<Project[]>([]); const [production,setProduction]=useState<Production|null>(null); const [requests,setRequests]=useState<RequestItem[]>([]); const [messages,setMessages]=useState<Message[]>([]); const [draft,setDraft]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{ const token=window.localStorage.getItem("customer-token"); if(!token){setError("ログインが必要です。公開サイトのログイン画面からお進みください。");return;}
    const headers={authorization:`Bearer ${token}`}; fetch(`${core}/api/v2/projects`,{headers}).then(r=>r.ok?r.json():Promise.reject(new Error("案件を取得できませんでした"))).then(setProjects).catch(e=>setError(e.message));
  },[]);
  useEffect(()=>{const p=projects[0]; const token=window.localStorage.getItem("customer-token"); if(!p||!token)return; const h={authorization:`Bearer ${token}`}; Promise.all([fetch(`${core}/api/v2/projects/${p.id}/production`,{headers:h}).then(r=>r.ok?r.json():null),fetch(`${core}/api/v2/projects/${p.id}/requests`,{headers:h}).then(r=>r.ok?r.json():[]),fetch(`${core}/api/v2/projects/${p.id}/messages`,{headers:h}).then(r=>r.ok?r.json():[])]).then(([prod,req,msg])=>{setProduction(prod);setRequests(req);setMessages(msg);});},[projects]);
  const project=projects[0]; const token=typeof window!=="undefined"?window.localStorage.getItem("customer-token"):null;
  const send=async(type:"request"|"message"|"approval")=>{if(!project||!token||!draft.trim())return; const url=type==="request"?`${core}/api/v2/projects/${project.id}/requests`:`${core}/api/v2/projects/${project.id}/messages`; const body=type==="request"?{type:"general",title:draft.slice(0,80),body:draft,priority:"normal"}:{content:draft,requestId:requests[0]?.id}; const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify(body)}); if(r.ok){setDraft(""); const data=await r.json(); type==="request"?setRequests(x=>[data,...x]):setMessages(x=>[...x,data]);}};
  return <main><header><div><span className="eyebrow">CUSTOMER PORTAL</span><h1>相談の続きから、<br/>制作の今を確認できます。</h1></div><span className="status">認証済み領域</span></header>{error?<section className="card"><h2>ログインしてください</h2><p>{error}</p></section>:<><section className="grid"><article className="card"><span className="eyebrow">PROJECT</span><h2>{project?.name||"案件を読み込んでいます"}</h2><p className="muted">プラン：{project?.plan||"確認中"}</p></article><article className="card"><span className="eyebrow">PRODUCTION</span><h2>{production?.workflows?.[0]?.status||"制作状況を読み込んでいます"}</h2><p className="muted">完了タスク：{production?.tasks?.filter(t=>t.status==="completed").length||0}件 ／ 成果物：{production?.artifacts?.length||0}件</p></article></section><section className="card"><span className="eyebrow">REQUEST / MESSAGE</span><h2>相談を送る</h2><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="相談内容を入力してください" rows={4}/><div><button onClick={()=>send("request")}>新しい依頼を送る</button><button onClick={()=>send("message")}>メッセージを送る</button><button onClick={()=>send("approval")}>この内容で承認する</button></div></section><section className="grid"><article className="card"><h2>相談履歴</h2>{requests.map(r=><p key={r.id}><span className="status">{r.status||"受付済み"}</span> {r.title||r.body}</p>)}</article><article className="card"><h2>メッセージ</h2>{messages.slice(-5).map(m=><p key={m.id}><b>{m.author_type||"customer"}</b>：{m.content}</p>)}</article></section></>}</main>;
}
