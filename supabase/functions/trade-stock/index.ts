// Private, per-shop trade stock. Server-side passwords; never expose role keys.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const allowedOrigin="https://jcbuildingservices1-sys.github.io";
const ownerId=Deno.env.get("TRADE_OWNER_USER_ID") || "";
const apiUrl=Deno.env.get("SUPABASE_URL") || "";
const roleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const oldPassword=Deno.env.get("TRADE_VIEW_PASSWORD") || "";
const shopIds=["ml","shop1","shop2"];
const cors={"Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type,authorization,apikey,x-client-info","Cache-Control":"no-store","Content-Type":"application/json; charset=utf-8","Vary":"Origin"};
function response(status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:cors});}
function hex(b:Uint8Array){return [...b].map(x=>x.toString(16).padStart(2,"0")).join("");}
function bytes(h:string){if(!/^(?:[a-f0-9]{2})+$/.test(h))return new Uint8Array(0);return new Uint8Array(h.match(/.{2}/g)!.map(x=>parseInt(x,16)));}
function safeEquals(a:Uint8Array,b:Uint8Array){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);return diff===0;}
async function passwordHash(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",iterations:120000,salt},key,256));}
function validateShop(x:unknown){return typeof x==="string"&&shopIds.includes(x)?x:null;}
async function rest(path:string,init:RequestInit={}){const headers={apikey:roleKey,Authorization:"Bearer "+roleKey,"Content-Type":"application/json",...(init.headers||{})};const r=await fetch(apiUrl+"/rest/v1/"+path,{...init,headers,cache:"no-store"});if(!r.ok){const detail=(await r.text()).slice(0,300);console.error("trade shops REST status",r.status,detail);throw new Error("Database request failed ("+r.status+")");}const raw=await r.text();return raw?JSON.parse(raw):null;}
async function authOwner(req:Request){const auth=req.headers.get("authorization")||"";if(!/^Bearer\s+[^\s]+$/.test(auth))return false;const r=await fetch(apiUrl+"/auth/v1/user",{headers:{apikey:roleKey,authorization:auth},cache:"no-store"});if(!r.ok)return false;const user=await r.json();return user?.id===ownerId;}
const ownerFilter="owner_user_id=eq."+encodeURIComponent(ownerId);
async function readShops(){return await rest("fishroom_trade_shops?select=shop_id,shop_name,password_salt,password_hash&"+ownerFilter);}
async function readOffers(){return await rest("fishroom_trade_shop_stock?select=shop_id,species,quantity,trade_price&"+ownerFilter);}
function stockLimit(data:any,species:string){const tanks=Array.isArray(data?.tanks)?data.tanks:[];return tanks.reduce((sum:number,t:any)=>sum+Math.max(0,Number(t?.saleCounts?.[species])||0),0);}
serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return response(405,{error:"Method not allowed"});
 if(req.headers.get("origin")!==allowedOrigin)return response(403,{error:"Origin not allowed"});
 if(!ownerId||!apiUrl||!roleKey)return response(503,{error:"Trade page not configured"});
 let body:any;try{if(Number(req.headers.get("content-length")||0)>60000)return response(413,{error:"Request too large"});body=await req.json();}catch{return response(400,{error:"Invalid request"});}
 if(!body||typeof body!=="object")return response(400,{error:"Invalid request"});
 const action=typeof body.action==="string"?body.action:"view";
 try{
  if(action==="admin-list"||action==="admin-password"||action==="admin-publish"){
   if(!(await authOwner(req)))return response(401,{error:"Sign in to your Fish Room cloud account"});
   const shop=validateShop(body.shop);
   if(action==="admin-list"){
    const [shops,offers]=await Promise.all([readShops(),readOffers()]);
    return response(200,{shops:shops.map((s:any)=>({id:s.shop_id,name:s.shop_name,passwordSet:!!s.password_hash||(s.shop_id==="ml"&&!!oldPassword),items:offers.filter((x:any)=>x.shop_id===s.shop_id).map((x:any)=>({species:x.species,quantity:x.quantity,trade_price:Number(x.trade_price)}))}))});
   }
   if(!shop)return response(400,{error:"Unknown shop"});
   if(action==="admin-password"){
    const password=body.password;
    if(typeof password!=="string"||password.length<10||password.length>128)return response(400,{error:"Use a password of at least 10 characters"});
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const hash=await passwordHash(password,salt);
    await rest("fishroom_trade_shops?"+ownerFilter+"&shop_id=eq."+shop,{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({password_salt:hex(salt),password_hash:hex(hash),updated_at:new Date().toISOString()})});
    return response(200,{ok:true});
   }
   const items=body.items;
   if(!Array.isArray(items)||items.length>60)return response(400,{error:"Invalid stock list"});
   const unique=new Set<string>();
   const normalized:{owner_user_id:string,shop_id:string,species:string,quantity:number,trade_price:number,updated_at:string}[]=[];
   for(const x of items){
    if(typeof x?.species!=="string"||!x.species.trim()||x.species.length>120||unique.has(x.species)||!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>100000||typeof x.trade_price!=="number"||!Number.isFinite(x.trade_price)||x.trade_price<0||x.trade_price>100000)return response(400,{error:"Invalid quantity or price"});
    unique.add(x.species);
    normalized.push({owner_user_id:ownerId,shop_id:shop,species:x.species,quantity:x.quantity,trade_price:Math.round(x.trade_price*100)/100,updated_at:new Date().toISOString()});
   }
   const [existing,source]=await Promise.all([readOffers(),rest("fishroom_data?select=data&user_id=eq."+encodeURIComponent(ownerId))]);
   if(!source?.length)return response(409,{error:"Cloud fish-room records not found. Stock publishing was not changed"});
   const other=existing.filter((x:any)=>x.shop_id!==shop);
   for(const row of normalized){
    const allocated=other.filter((x:any)=>x.species===row.species).reduce((n:number,x:any)=>n+Number(x.quantity||0),0);
    if(row.quantity+allocated>stockLimit(source[0].data,row.species))return response(409,{error:row.species+": allocations exceed available fish across shops"});
   }
   if(normalized.length)await rest("fishroom_trade_shop_stock?on_conflict=owner_user_id,shop_id,species",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(normalized)});
   for(const row of existing.filter((x:any)=>x.shop_id===shop&&!unique.has(x.species))){
    await rest("fishroom_trade_shop_stock?"+ownerFilter+"&shop_id=eq."+shop+"&species=eq."+encodeURIComponent(row.species),{method:"DELETE"});
   }
   return response(200,{ok:true,count:normalized.length});
  }
  const shop=validateShop(body.shop??"ml");
  if(!shop)return response(404,{error:"Shop not found"});
  if(typeof body.password!=="string"||body.password.length>200)return response(400,{error:"Invalid password"});
  const shops=await readShops(),selected=shops.find((s:any)=>s.shop_id===shop);
  if(!selected)return response(404,{error:"Shop not found"});
  if(!selected.password_hash&&!(shop==="ml"&&oldPassword))return response(503,{error:"Shop password not set"});
  let valid=false;
  if(selected.password_hash&&selected.password_salt)valid=safeEquals(await passwordHash(body.password,bytes(selected.password_salt)),bytes(selected.password_hash));
  else if(shop==="ml"){
   const digest=async(t:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)));
   valid=safeEquals(await digest(body.password),await digest(oldPassword));
  }
  if(!valid)return response(401,{error:"Incorrect password"});
  const rows=await rest("fishroom_trade_shop_stock?select=species,quantity,trade_price&"+ownerFilter+"&shop_id=eq."+shop+"&order=species.asc");
  return response(200,{stock:rows});
 }catch(error){console.error("trade shops request failed",String(error));return response(502,{error:"Unable to load trade stock"});}
});