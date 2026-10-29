/* Chef & Mixologist: one colour code for every card.
   A coloured strip down a card's left edge says how it stands; the words sit behind a small info icon.
   Each page ends with a colour guide built from LEGEND below. */

const EDGE_OF={lime:'ok',turmeric:'warn',melon:'bad',info:'info',soft:'mute'};
const edgeTip=label=>`<span class="info-tip edge-tip" role="img" tabindex="0" data-tip="${esc(label)}" aria-label="${esc(label)}">${INFO_ICON}</span>`;

const EDGE_NAME={ok:'Green',warn:'Gold',bad:'Red',info:'Brown',mute:'Grey'};
const STOCK_KEY=[['ok','Healthy stock'],['warn','Reorder now'],['info','On order'],['bad','Out of stock or below safety level'],['mute','Overstocked']];
const LEGEND={
  overview:STOCK_KEY,
  items:STOCK_KEY,
  replenish:[['bad','Includes an item that is out or below safety'],['warn','Items to reorder now'],['info','Everything else is on order or healthy']],
  inward:[['bad','Open order is late'],['warn','Open order is due today'],['info','Open order is on its way'],['ok','Receipt: accepted in full'],['warn','Receipt: delivery came short'],['bad','Receipt: partly rejected']],
  suppliers:[['ok','On time 90%+, in full 95%+ and quality 80%+'],['warn','One of the three is below target'],['bad','Two or more are below target']],
  recipes:[['ok','Jain-friendly: every ingredient qualifies'],['mute','No strip: not marked Jain-friendly']],
  prep:[['ok','In stock and in date'],['bad','A batch must be used today or is past its date'],['mute','None made']],
  sales:[['ok','Imported and stock taken out cleanly'],['warn','Check stock: an ingredient ran short'],['mute','Void']],
  events:[['info','Planned'],['ok','Open, licence valid'],['mute','Closed']],
  stocktake:[['warn','Counting'],['info','Ready for review'],['ok','Posted'],['mute','Cancelled']],
  requests:[['warn','Waiting for the store'],['info','Partly issued'],['ok','Done'],['bad','Late'],['mute','Cancelled']],
  approvals:[['warn','Waiting for a decision'],['ok','Approved'],['bad','Turned down']],
  closing:[['ok','Closed'],['warn','Ready to close'],['info','Month still running'],['mute','Not ready']],
  team:[['ok','Active'],['warn','Invited, not signed in yet'],['mute','Deactivated']]
};
function legendHtml(id){
  const L=LEGEND[id];if(!L)return '';
  return `<div class="colour-guide" data-legend="${id}"><b>Colour guide</b>${L.map(([k,t])=>`<span><i class="sw edge-${k}"></i><u>${EDGE_NAME[k]}</u> ${esc(t)}</span>`).join('')}</div>`;
}
function addLegend(sec,id){
  if(!sec||!LEGEND[id])return;
  sec.querySelectorAll(':scope > .colour-guide').forEach(n=>n.remove());
  sec.insertAdjacentHTML('beforeend',legendHtml(id));
}
const viewBeforeEdges=view;
view=function(id,...rest){const body=viewBeforeEdges(id,...rest);addLegend(body.parentElement,id);return body};
['overview','items','inward','replenish'].forEach(id=>addLegend(document.getElementById('v-'+id),id));
