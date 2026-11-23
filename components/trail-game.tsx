import { useEffect, useRef, useState } from "react";

type Point = {x:number; y:number};
type Props = { paused:boolean; start:Point; goal:Point; step:number; zh:boolean; cat:string; title:string; onArrival:()=>void; children:React.ReactNode };
const keepsakes = [
  ["🍁","Maple leaf","枫叶"], ["🍋","Lemon","柠檬"], ["🍣","Sushi","寿司"],
  ["🥐","Croissant","可颂"], ["🌴","Palm","棕榈"], ["💌","Invitation","请柬"]
];
const directions:Record<string,Point> = {ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};

export function TrailGame({paused,start,goal,step,zh,cat,title,onArrival,children}:Props) {
  const board=useRef<HTMLDivElement>(null);
  const sprite=useRef<HTMLDivElement>(null);
  const pickup=useRef<HTMLButtonElement>(null);
  const yarn=useRef<HTMLDivElement>(null);
  const [tangled,setTangled]=useState(false);
  const keys=useRef(new Set<string>());
  const target=useRef<Point|null>(null);
  const current=useRef({...start});
  const arrive=useRef(onArrival);
  arrive.current=onArrival;
  const [collected,setCollected]=useState(false);
  const [hint,setHint]=useState(false);
  const [icon,en,cn]=keepsakes[step];
  const item={x:(start.x+goal.x)/2,y:Math.min(79,(start.y+goal.y)/2+(step%2?9:-10))};
  const t=(a:string,b:string)=>zh?b:a;
  useEffect(()=>{
    const world=board.current!, catEl=sprite.current!, viewport=world.parentElement!;
    if(paused)return;
    current.current={...start};setCollected(false);setTangled(false);setHint(false);
    const held=keys.current;
    let frame=0, last=0, got=false, done=false, age=0;
    function clear(){held.clear();target.current=null;}
    function key(e:KeyboardEvent,down:boolean){
      const k=e.key.length===1?e.key.toLowerCase():e.key;
      if(!directions[k] || e.ctrlKey || e.metaKey || e.altKey)return;
      e.preventDefault();
      if(down){held.add(k);target.current=null;}else held.delete(k);
    }
    const press=(e:KeyboardEvent)=>key(e,true),release=(e:KeyboardEvent)=>key(e,false);
    function tick(time:number){
      const dt=Math.min((time-(last||time))/1000,.1);last=time;age+=dt;
      const w=world.clientWidth,h=world.clientHeight;
      const p=current.current;
      const bait={x:item.x,y:item.y+Math.sin(age*1.7)*Math.min(1.4,650/h)};
      if(pickup.current)pickup.current.style.top=bait.y+"%";
      let dx=0,dy=0;
      held.forEach(k=>{dx+=directions[k].x;dy+=directions[k].y;});
      let speed=240*dt;
      if(target.current){dx=(target.current.x-p.x)*w/100;dy=(target.current.y-p.y)*h/100;speed=Math.min(speed,Math.hypot(dx,dy));if(speed<.05)target.current=null;}
      const len=Math.hypot(dx,dy);
      if(len){p.x=Math.min(98,Math.max(2,p.x+dx/len*speed/w*100));p.y=Math.min(88,Math.max(15,p.y+dy/len*speed/h*100));if(dx)catEl.style.setProperty('--face',dx<0?'-1':'1');}
      catEl.classList.toggle('is-walking',len>.1);
      catEl.style.left=p.x+'%';catEl.style.top=p.y+'%';
      const scroll=p.x*w/100-viewport.clientWidth/2;
      
      if(len || age<.1)viewport.scrollLeft=scroll;
      const near=(q:Point,r:number)=>Math.hypot((q.x-p.x)*w/100,(q.y-p.y)*h/100)<r;
      if(step>0 && yarn.current){
        const ball={x:(item.x+goal.x)/2,y:(item.y+goal.y)/2+Math.sin(age*1.65)*7};
        yarn.current.style.left=ball.x+'%';yarn.current.style.top=ball.y+'%';
        if(got && near(ball,20)){got=false;setCollected(false);setTangled(true);target.current=null;}
      }
      if(!got && near(bait,34)){got=true;setTangled(false);setCollected(true);setHint(false);}
      if(near(goal,24)){if(got){done=true;arrive.current();}else setHint(true);}
      if(!done)frame=requestAnimationFrame(tick);
    }
    window.addEventListener('keydown',press);window.addEventListener('keyup',release);window.addEventListener('blur',clear);
    frame=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',press);window.removeEventListener('keyup',release);window.removeEventListener('blur',clear);clear();};
  },[paused,step,start.x,start.y,goal.x,goal.y,item.x,item.y]);
  return <>
    <div className="journey-viewport"><div className="journey-board" ref={board} onClick={e=>{
      const r=e.currentTarget.getBoundingClientRect();
      target.current={x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100};
    }}>
      {children}
      <button type="button" className="game-dock" aria-label={title} style={{left:goal.x+'%',top:goal.y+'%'}} onClick={e=>{e.stopPropagation();target.current=goal;}}>⚑</button>
      {step>0 && <div className="game-yarn" aria-hidden="true" ref={yarn}>🧶</div>}
      {!collected && <button className="game-item" ref={pickup} style={{left:item.x+'%',top:item.y+'%'}} aria-label={t(en,cn)} onClick={e=>{e.stopPropagation();target.current=item;}}>{icon}</button>}
      <div className="journey-traveler" ref={sprite} style={{left:start.x+'%',top:start.y+'%'}}><img alt="" className="journey-cat-art" src={cat}/></div>
    </div></div>
    <div className="journey-map-footer game-hud" role="status"><div className="passport">{keepsakes.map(([symbol,name],i)=><span key={name} className={i<step || (i===step && collected)?'stamped':''}>{i<=step?symbol:'·'}</span>)}</div>
      <strong>{collected?t('Deliver to '+title,'送到'+title):t((tangled?'Tangled! Retrieve the ':hint?'First collect the ':'Find the ')+en.toLowerCase(),(tangled?'缠上毛线啦！去找回':hint?'先去收集':'寻找')+cn)}</strong>
    </div>
  </>;
}
