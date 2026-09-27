(()=>{
'use strict';
const root=document.getElementById('quickTicTacToe');
const id=new URLSearchParams(location.search).get('quick_lobby');
if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id||'')){
 root.textContent='Kein gültiges Spiel gewählt. Öffne Tic Tac Toe über die Quick-Games-Lobby.';return;
}
// Preserve the production module's RPC interface and the existing auth refresh.
const mappings={
 get_tic_tac_toe_state:['get_quick_tic_tac_toe_state',()=>({})],
 set_tic_tac_toe_team_mode:['configure_quick_tic_tac_toe',a=>({p_team_mode:a.p_mode})],
 set_tic_tac_toe_timer:['configure_quick_tic_tac_toe',a=>({p_turn_seconds:a.p_turn_seconds})],
 set_tic_tac_toe_variant:['configure_quick_tic_tac_toe',a=>({p_variant:a.p_variant})],
 select_tic_tac_toe_player:['select_quick_tic_tac_toe_player',a=>({p_member_id:a.p_tournament_member_id,p_selection:a.p_selection})],
 set_in_app_game_ready:['ready_quick_tic_tac_toe',a=>({p_ready:a.p_ready})],
 start_tic_tac_toe_match:['start_quick_tic_tac_toe',()=>({})],
 submit_tic_tac_toe_move:['submit_quick_tic_tac_toe_move',a=>({p_cell_index:a.p_cell_index,p_duel:a.p_duel,
   p_expected_round:a.p_expected_round,p_expected_move:a.p_expected_move,p_client_action_id:a.p_client_action_id})]
};
let queue=Promise.resolve();
const db={rpc(name,args){
 const action=queue.then(async()=>{
   try{
     const route=mappings[name];if(!route)throw new Error('Unbekannte Spielaktion.');
     const data=await window.skielsenQuickGames.rpc(route[0],{p_lobby_id:id,...route[1](args)});
     if(data?.move_accepted===false)return {data,error:new Error('Der Spielstand hat sich geändert. Bitte erneut wählen.')};
     return {data,error:null};
   }catch(error){return {data:null,error};}
 });
 queue=action.then(()=>{});return action;
}};
window.skielsenTicTacToe.mount(root,{session_id:id,quick_game:true,onQuickExit:()=>location.assign('../')},db);
window.addEventListener('pagehide',()=>window.skielsenTicTacToe.unmount());
window.addEventListener('pageshow',event=>{
 if(event.persisted)window.skielsenTicTacToe.mount(root,{session_id:id,quick_game:true,onQuickExit:()=>location.assign('../')},db);
});
})();
