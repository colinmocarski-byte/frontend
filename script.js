
// Backend-URL
const DEFAULT_BACKEND = 'https://backend-ozsw.onrender.com/'; 

const $ = (id) => document.getElementById(id);
const eur = (n, d=0) => (isFinite(n)?n:0).toLocaleString('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:d});
const pct = (n, d=1) => `${(isFinite(n)?n:0).toFixed(d)} %`;

function getBackend(){
  return localStorage.getItem('immolink_backend') || DEFAULT_BACKEND || '';
}

async function scrape(url){
  const base = getBackend();
  if(!base){ throw new Error('Keine Backend-URL gesetzt. Klicke oben auf „Backend-URL“.'); }
  const resp = await fetch(`${base.replace(/\/$/,'')}/api/scrape?url=${encodeURIComponent(url)}`);
  if(!resp.ok) throw new Error(`Scrape-Fehler: ${resp.status}`);
  return await resp.json();
}

function loadDemo(){ return { address:'Musterstraße 11', city:'12345 Musterstadt', area:95, price:175000 }; }
function fillListing(d){ $('addr').value=d.address||''; $('city').value=d.city||''; $('area').value=d.area||0; $('price').value=d.price||0; render(); }

function calc(){
  const area=+$('area').value||0, price=+$('price').value||0;
  const hausgeld=+$('hausgeld').value||0, umlage=+$('umlage').value||0;
  const rentPerSqm=+$('rentPerSqm').value||0, rentSlots=+$('rentSlots').value||0, rentOther=+$('rentOther').value||0;
  const vacancy=(+$('vacancy').value||0)/100, maintPerSqm=+$('maintPerSqm').value||0;

  const coldRent=area*rentPerSqm, nettoCold=coldRent+rentSlots+rentOther, warmRent=nettoCold+umlage;
  const vacancyEuro=nettoCold*vacancy, ownMaint=(area*maintPerSqm)/12, nichtUml=hausgeld-umlage+ownMaint+vacancyEuro;

  // einfache Finanzierung (DL I)
  const equityPct=0.2, rate=0.039, repay=0.02;
  const totalAcq=price, equityAbs=totalAcq*equityPct, loan=Math.max(totalAcq-equityAbs,0);
  const ann=loan*(rate+repay)/12, iMonth=loan*rate/12, rMonth=Math.max(0,ann-iMonth);

  const bwuSum=umlage+(hausgeld-umlage)+ownMaint+vacancyEuro;
  const cfOper=warmRent-bwuSum-ann;
  const taxRate=(+$('taxRate').value||0)/100;
  const taxable=Math.max(0, warmRent - hausgeld - iMonth - 0);
  const taxMonth=taxable*taxRate;
  const cfAfterTax=cfOper - taxMonth + rMonth;

  const grossYield=price? (nettoCold*12/price*100):0;
  const netYield=totalAcq? ((nettoCold*12 - (ownMaint*12 + (hausgeld-umlage)*12))/totalAcq*100) : 0;
  const principalYear=rMonth*12;
  const roePa=equityAbs? (principalYear/equityAbs*100):0;

  return { coldRent, nettoCold, warmRent, vacancyEuro, ownMaint, nichtUml,
           totalAcq, equityAbs, loan, ann, iMonth, rMonth,
           cfOper, cfAfterTax, grossYield, netYield, roePa };
}

let chart;
function drawChart(m){
  let bal=m.loan, rate=0.039/12, ann=m.loan*(0.039+0.02)/12;
  const Z=[],T=[],L=[],R=[];
  for(let y=1;y<=30;y++){
    let zi=0, ti=0;
    for(let k=0;k<12;k++){
      const i=bal*rate;
      const r=Math.min(ann - i, bal);
      bal=Math.max(0, bal-r);
      zi+=i; ti+=r;
    }
    Z.push(zi); T.push(ti); L.push('J'+y); R.push(bal);
    if(bal<=0) break;
  }
  const cfg={
    data:{labels:L,datasets:[
      {type:'bar', label:'Zinsen/Jahr', data:Z, stack:'st'},
      {type:'bar', label:'Tilgung/Jahr', data:T, stack:'st'},
      {type:'line', label:'Restschuld', data:R, yAxisID:'y1'}
    ]},
    options:{plugins:{legend:{position:'top'}}, responsive:true,
      scales:{x:{stacked:true}, y:{stacked:true, beginAtZero:true}, y1:{position:'right', beginAtZero:true}}}
  };
  if(chart) chart.destroy();
  chart = new Chart(document.getElementById('chart'), cfg);
}

function render(){
  const m=calc();
  $('cfAfterTax').textContent=eur(m.cfAfterTax);
  $('grossYield').textContent=pct(m.grossYield);
  $('netYield').textContent=pct(m.netYield);
  $('roePa').textContent=pct(m.roePa);
  drawChart(m);
}
function detailsTable(){
  const m=calc();
  const rows=[
    ['Kaltmiete (€/Monat)', eur(m.coldRent)],
    ['Nettokaltmiete', eur(m.nettoCold)],
    ['Warmmiete', eur(m.warmRent)],
    ['Leerstand (kalk.)', eur(m.vacancyEuro)],
    ['Eigene Instandhaltung', eur(m.ownMaint)],
    ['Nicht umlagefähige Kosten', eur(m.nichtUml)],
    ['Gesamterwerb (KP)', eur(m.totalAcq)],
    ['Eigenkapital', eur(m.equityAbs)],
    ['Darlehen', eur(m.loan)],
    ['Zinsen/Monat', eur(m.iMonth)],
    ['Tilgung/Monat', eur(m.rMonth)],
    ['Annuität', eur(m.ann)],
    ['CF operativ', eur(m.cfOper)],
    ['CF nach Steuern', eur(m.cfAfterTax)],
    ['Bruttomietrendite', pct(m.grossYield)],
    ['Nettomietrendite', pct(m.netYield)],
    ['Eigenkapitalrendite p.a.', pct(m.roePa)]
  ];
  const html=['<table><thead><tr><th>Größe</th><th>Wert</th></tr></thead><tbody>']
    .concat(rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`))
    .concat(['</tbody></table>']).join('');
  document.getElementById('details').innerHTML=html;
}

function bind(){
  document.querySelectorAll('input').forEach(i=> i.addEventListener('input', render));
  document.getElementById('btnDetails').addEventListener('click', ()=>{ detailsTable(); document.getElementById('dlg').showModal(); });
  document.getElementById('dlgClose').addEventListener('click', ()=> document.getElementById('dlg').close());
  document.getElementById('btnDemo').addEventListener('click', ()=> fillListing(loadDemo()));
  document.getElementById('btnFetch').addEventListener('click', async ()=>{
    const url=document.getElementById('link').value.trim();
    if(!url) return alert('Bitte einen ImmoScout-Link einfügen.');
    try{ const data=await scrape(url); fillListing(data); }
    catch(e){ alert('Konnte nicht auslesen: '+e.message); console.error(e); }
  });
  document.getElementById('btnSettings').addEventListener('click', ()=>{
    const current=getBackend();
    const next=prompt('Backend-URL (Render) eingeben, z. B. https://dein-service.onrender.com', current);
    if(next!==null){ localStorage.setItem('immolink_backend', next); alert('Gespeichert.'); }
  });
}

window.addEventListener('DOMContentLoaded', ()=>{ bind(); fillListing(loadDemo()); render(); });
