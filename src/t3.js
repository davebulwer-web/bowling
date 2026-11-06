const fs=require('fs');const vm=require('vm');vm.runInThisContext(fs.readFileSync('phys.js','utf8')+'\n'+fs.readFileSync('logic.js','utf8'));
function bowl(o, standing){
  const p=cpuPlan(o,standing);
  const W=simulate(standing.map((s,i)=>s?(typeof s==='object'?s:true):false).some(x=>x!==true)?standing:null,p.x0,p.aim,speedOf(p.power),p.spin);
  return W.pins.map(q=>q.st==='up'?{x:q.x,z:q.z}:false);
}
function game(o){
  const frames=[];let strikes=0,spares=0,opens=0;
  for(let i=0;i<10;i++){
    const f={rolls:[]};frames.push(f);
    let st=Array(10).fill(true);
    while(!frameDone(frames,i,9)){
      const left=bowl(o,st); const before=st.filter(Boolean).length, after=left.filter(Boolean).length;
      f.rolls.push(before-after);
      st = after===0 || (i===9 && ((f.rolls.length===2 && f.rolls[0]===10)||(f.rolls.length===2&&f.rolls[0]+f.rolls[1]===10))) ? Array(10).fill(true) : left;
      if(i===9 && f.rolls.length===1 && f.rolls[0]===10) st=Array(10).fill(true);
      if(i<9 && f.rolls.length===1 && f.rolls[0]===10) break;
    }
    if(f.rolls[0]===10)strikes++; else if(f.rolls[0]+f.rolls[1]===10)spares++; else opens++;
  }
  const sc=scoreCard(frames,10);return {s:sc[9].total,strikes,spares,opens};
}
const only=process.argv[2];
for(const o of BOWLERS){ if(only&&o.id!==only)continue;
  let t=0,st=0,sp=0,N=+process.argv[3]||30;const all=[];
  for(let g=0;g<N;g++){const r=game(o);t+=r.s;st+=r.strikes;sp+=r.spares;all.push(r.s);}
  all.sort((a,b)=>a-b);
  console.log(o.id.padEnd(7),'avg',(t/N).toFixed(0),'min',all[0],'max',all[N-1],'strk/g',(st/N).toFixed(1),'spare/g',(sp/N).toFixed(1));
}
