(()=>{
'use strict';
const URL='https://rlppuqjolkrwumrrjajq.supabase.co';
const KEY='sb_publishable_6Cuc1rH2WGua2UT__Ta18w_BJVG4O1b';
const SESSION_KEY='skielsen.native.supabase.session';
const COLORS=['#ff1717','#1515ff','#00a65a','#f2b705'];
const NAMES=['TEAM ROT','TEAM BLAU','TEAM GRÜN','TEAM GELB'];
const $=s=>document.querySelector(s);
let lobby=null,poll=0,navigating=false;
function session(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');return s?.access_token?s:null}catch(_){return null}}
function feedback(message,type=''){const el=$('#qgFeedback');el.textContent=message||'';el.className='qg-feedback'+(type?' '+type:'')}
function message(error){const m=String(error?.message||error||'');if(m.includes('LOBBY_NOT_FOUND'))return 'Lobbycode nicht gefunden oder Lobby bereits gestartet.';if(m.includes('LOBBY_FULL'))return 'Die Lobby ist bereits voll.';if(m.includes('FILL_REMAINING'))return 'Fülle zuerst die freien Plätze mit Bots.';if(m.includes('AUTH'))return 'Bitte melde dich zuerst auf der Landing Page an.';return m||'Quick Games konnte nicht geladen werden.'}
async function rpc(name,args={}){
 const s=session();if(!s)throw new Error('AUTH_REQUIRED');
 const res=await fetch(`${URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
 const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.message||data?.error||name);return data;
}
function render(){
 if(!lobby)return;
 $('#qgChoose').hidden=true;$('#qgLobby').hidden=false;$('#qgLobbyCode').textContent=lobby.join_code;
 const players=new Map((lobby.players||[]).map(p=>[Number(p.seat),p]));
 $('#qgSeats').innerHTML=NAMES.map((name,index)=>{const slots=[index*2+1,index*2+2];return `<article class="qg-seat" style="--team:${COLORS[index]}"><small>${name}</small><div class="qg-team-slots">${slots.map((seat,slotIndex)=>{const p=players.get(seat),filled=!p&&lobby.bots_filled;return `<button class="qg-player-slot ${p?.is_me?'is-me':''}" type="button" data-seat="${seat}" ${p||filled?'disabled':''}><strong>${p?escapeHtml(p.display_name):(filled?'BOT':'FREIER PLATZ')}</strong><span>${p?(p.is_me?'DU · PLATZ '+(slotIndex+1):'PLAYER · PLATZ '+(slotIndex+1)):(filled?'BOT · PLATZ '+(slotIndex+1):'PLATZ '+(slotIndex+1)+' WÄHLEN')}</span></button>`}).join('')}</div></article>`}).join('');
 document.querySelectorAll('[data-seat]:not(:disabled)').forEach(button=>button.addEventListener('click',e=>act(e.currentTarget,()=>rpc('set_quick_game_seat',{p_lobby_id:lobby.lobby_id,p_seat:Number(e.currentTarget.dataset.seat)}))));
 $('#qgHostActions').hidden=!lobby.is_host;$('#qgWait').hidden=!!lobby.is_host;
 $('#qgFill').disabled=!!lobby.bots_filled;$('#qgFill').textContent=lobby.bots_filled?'BOTS EINGESETZT ✓':'REST MIT BOTS FÜLLEN';
 $('#qgStart').disabled=!lobby.bots_filled&&(lobby.players||[]).length<8;
 if(lobby.status==='LIVE'&&!navigating){navigating=true;location.assign('../dna-test/?quick_lobby='+encodeURIComponent(lobby.lobby_id))}
}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function refresh(){if(!lobby?.lobby_id)return;try{lobby=await rpc('get_quick_game_lobby',{p_lobby_id:lobby.lobby_id});render()}catch(err){feedback(message(err));stopPoll()}}
function startPoll(){stopPoll();poll=setInterval(refresh,1500)}function stopPoll(){if(poll)clearInterval(poll);poll=0}
async function act(button,fn){button.disabled=true;feedback('');try{lobby=await fn();render();startPoll()}catch(err){feedback(message(err))}finally{if(button.isConnected&&lobby?.status!=='LIVE')button.disabled=false}}
$('#qgCreate').addEventListener('click',e=>act(e.currentTarget,()=>rpc('create_quick_game_lobby',{p_game_key:'dna'})));
$('#qgJoin').addEventListener('click',e=>act(e.currentTarget,()=>rpc('join_quick_game_lobby',{p_join_code:$('#qgCode').value.trim().toUpperCase()})));
$('#qgCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#qgJoin').click()});
$('#qgFill').addEventListener('click',e=>act(e.currentTarget,()=>rpc('fill_quick_game_lobby_bots',{p_lobby_id:lobby.lobby_id})));
$('#qgStart').addEventListener('click',e=>act(e.currentTarget,()=>rpc('start_quick_game_lobby',{p_lobby_id:lobby.lobby_id})));
$('#qgCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lobby.join_code);feedback('Lobbycode kopiert.','ok')}catch(_){feedback('Lobbycode: '+lobby.join_code,'ok')}});
window.addEventListener('beforeunload',stopPoll);
if(!session()){feedback('Bitte melde dich zuerst auf der Landing Page an.');document.querySelectorAll('button').forEach(b=>b.disabled=true)}
})();
