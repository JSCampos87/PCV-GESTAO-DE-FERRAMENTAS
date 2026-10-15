"use strict";
/* ============ Vista 3D esquemática das racks ============
   Cada rack tem 3 níveis (rés-do-chão, piso 1, piso 2). De frente, os montantes e as
   travessas formam dois "H" sobrepostos. A posição procurada fica a amarelo. */
const Rack3D=(()=>{
  const THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const SLOT=0.14, LEVEL_H=1.15, DEPTH=1.1, BAY=12;
  let T,scene,cam,ren,host,occMesh,repMesh,hlGroup,model=null,slotIndex=new Map(),idxToPos=[],raf=0,dragging=null;
  let ang=-0.75,elev=0.62,dist=30,target={x:0,y:1.6,z:0},tgtGoal=null,distGoal=null,tip,needs=true,pulse=0,hlList=[];
  const lerp=(a,b,t)=>a+(b-a)*t;

  /* modelo: agrupa as posições em racks (letras A–H) com 3 níveis, e zonas (caixotes, chão, outros) */
  function buildModel(positions,occ){
    const racks={},zones={};
    for(const [p,v] of Object.entries(positions)){
      const m=p.match(/^([A-H])(\d{3,4})$/i);
      if(m){const L=m[1].toUpperCase();(racks[L]=racks[L]||[]).push({p,n:+m[2],l:v.l||''})}
      else{const z=/caix|^cx/i.test(p)?'Caixotes':/ch[aã]o/i.test(v.l||'')?'Chão':'Outros';(zones[z]=zones[z]||[]).push({p})}
    }
    const out=[];
    for(const L of Object.keys(racks).sort()){
      const arr=racks[L].sort((a,b)=>a.n-b.n);let lv;
      const piso=arr.map(x=>(x.l.match(/piso\s*(\d)/i)||[])[1]);
      if(piso.filter(Boolean).length>arr.length*0.6){lv=[[],[],[]];arr.forEach((x,i)=>{const k=Math.min(2,Math.max(0,(+piso[i]||1)-1));lv[k].push(x.p)})}
      else{const per=Math.ceil(arr.length/3);lv=[arr.slice(0,per).map(x=>x.p),arr.slice(per,2*per).map(x=>x.p),arr.slice(2*per).map(x=>x.p)]}
      out.push({name:L,levels:lv,len:Math.max(...lv.map(l=>l.length),1)});
    }
    /* disposição: A sozinha na frente; as restantes em filas de corredores */
    let z=0,x=0;const rows=[[],[],[]];
    out.forEach((r,i)=>{if(r.name==='A')rows[0].push(r);else if(rows[1].reduce((s,q)=>s+q.len,0)<=rows[2].reduce((s,q)=>s+q.len,0))rows[1].push(r);else rows[2].push(r)});
    rows.forEach((row,ri)=>{x=0;row.forEach(r=>{r.x=x;r.z=-ri*4.2;x+=r.len*SLOT+1.6})});
    const maxX=Math.max(...out.map(r=>r.x+r.len*SLOT),8);
    const zs=Object.entries(zones).map(([name,ps],i)=>({name,positions:ps.map(q=>q.p),x:-4.5,z:-i*3.4,w:3,d:2.4}));
    return {racks:out,zones:zs,maxX,occ};
  }

  function label(text,size,color){
    const c=document.createElement('canvas');c.width=256;c.height=96;const g=c.getContext('2d');
    g.font=`600 ${size||56}px IBM Plex Sans, Arial, sans-serif`;g.fillStyle=color||'#1f7044';g.textAlign='center';g.textBaseline='middle';g.fillText(text,128,48);
    const s=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(2.4,0.9,1);return s;
  }

  function build(){
    if(!scene)return;
    while(scene.children.length)scene.remove(scene.children[0]);
    slotIndex.clear();idxToPos=[];
    scene.add(new T.HemisphereLight(0xffffff,0xb9c8be,0.9));const sun=new T.DirectionalLight(0xffffff,0.55);sun.position.set(8,14,10);scene.add(sun);
    const m=model;const W=m.maxX+10;
    const floor=new T.Mesh(new T.PlaneGeometry(W+8,22),new T.MeshLambertMaterial({color:0xf2f5f3}));floor.rotation.x=-Math.PI/2;floor.position.set(W/2-6,0,-4);scene.add(floor);
    const grid=new T.GridHelper(Math.max(W+8,22),Math.round(Math.max(W+8,22)),0xdde6e0,0xe8eee9);grid.position.set(W/2-6,0.002,-4);scene.add(grid);
    const blue=new T.MeshLambertMaterial({color:0x2f6fb5}),orange=new T.MeshLambertMaterial({color:0xe8833a});
    const upG=new T.BoxGeometry(0.07,LEVEL_H*3+0.15,0.07);
    let slots=[];
    for(const r of m.racks){
      const L=r.len*SLOT;const x0=r.x,z0=r.z;
      /* montantes (as pernas do H) */
      for(let b=0;b<=Math.ceil(r.len/BAY);b++){const bx=x0+Math.min(b*BAY*SLOT,L);for(const dz of [0,-DEPTH]){const u=new T.Mesh(upG,blue);u.position.set(bx,(LEVEL_H*3+0.15)/2,z0+dz);scene.add(u)}}
      /* travessas (as barras do H): 2 alturas intermédias + base e topo */
      for(let k=0;k<=3;k++){for(const dz of [0,-DEPTH]){const bm=new T.Mesh(new T.BoxGeometry(L,0.07,0.07),orange);bm.position.set(x0+L/2,k*LEVEL_H+0.04,z0+dz);scene.add(bm)}
        if(k<3){const deck=new T.Mesh(new T.BoxGeometry(L,0.02,DEPTH),new T.MeshLambertMaterial({color:0xe9dcc3,transparent:true,opacity:0.55}));deck.position.set(x0+L/2,k*LEVEL_H+0.06,z0-DEPTH/2);scene.add(deck)}}
      const lb=label('Rack '+r.name,64);lb.position.set(x0-0.9,LEVEL_H*3+0.6,z0-DEPTH/2);scene.add(lb);
      if(r.name==='A'){['R/C','Piso 1','Piso 2'].forEach((t,k)=>{const s=label(t,44,'#728379');s.scale.set(1.6,0.6,1);s.position.set(x0-1,k*LEVEL_H+0.55,z0+0.2);scene.add(s)})}
      r.levels.forEach((lv,k)=>lv.forEach((p,i)=>{slots.push({p,x:x0+(i+0.5)*SLOT,y:k*LEVEL_H+0.08+0.42,z:z0-DEPTH/2})}));
    }
    for(const zn of m.zones){
      const box=new T.Mesh(new T.BoxGeometry(zn.w,0.5,zn.d),new T.MeshLambertMaterial({color:0xcfd6d1}));box.position.set(zn.x,0.25,zn.z);scene.add(box);
      const lb=label(zn.name,48,'#40554a');lb.position.set(zn.x,1.1,zn.z);scene.add(lb);
      zn.positions.forEach(p=>slots.push({p,x:zn.x,y:0.6,z:zn.z,zone:true}));
    }
    /* cortantes guardados: placas finas na vertical */
    const occ=slots.filter(s=>m.occ.has(s.p)&&!s.zone);
    const g=new T.BoxGeometry(SLOT*0.62,0.8,DEPTH*0.82);
    occMesh=new T.InstancedMesh(g,new T.MeshLambertMaterial({color:0x8fbf9f}),Math.max(occ.length,1));
    const mt=new T.Matrix4();occ.forEach((s,i)=>{mt.makeTranslation(s.x,s.y,s.z);occMesh.setMatrixAt(i,mt);idxToPos[i]=s.p});occMesh.count=occ.length;scene.add(occMesh);
    slots.forEach(s=>slotIndex.set(s.p,s));
    hlGroup=new T.Group();scene.add(hlGroup);
    target={x:Math.min(m.maxX,14)/2+2,y:1.6,z:-3};dist=Math.max(18,Math.min(42,m.maxX*0.9));
    applyHighlight();needs=true;
  }

  function applyHighlight(){
    if(!hlGroup)return;while(hlGroup.children.length)hlGroup.remove(hlGroup.children[0]);
    const pts=hlList.map(p=>slotIndex.get(p)).filter(Boolean);
    const yel=new T.MeshLambertMaterial({color:0xf6c400,emissive:0x6b5300,emissiveIntensity:0.35});
    for(const s of pts){
      const b=new T.Mesh(s.zone?new T.BoxGeometry(3.1,0.6,2.5):new T.BoxGeometry(SLOT*1.3,0.9,DEPTH*0.95),yel);b.position.set(s.x,s.zone?0.3:s.y,s.z);hlGroup.add(b);
      const c=new T.Mesh(new T.ConeGeometry(0.28,0.6,16),yel);c.rotation.x=Math.PI;c.position.set(s.x,LEVEL_H*3+1.3,s.z);c.userData.beacon=true;hlGroup.add(c);
      const ln=new T.Mesh(new T.CylinderGeometry(0.015,0.015,LEVEL_H*3+1-(s.zone?0.6:s.y),6),yel);ln.position.set(s.x,((s.zone?0.6:s.y)+LEVEL_H*3+1)/2,s.z);hlGroup.add(ln);
    }
    if(pts.length){const cx=pts.reduce((a,s)=>a+s.x,0)/pts.length,cz=pts.reduce((a,s)=>a+s.z,0)/pts.length;tgtGoal={x:cx,y:1.6,z:cz};distGoal=pts.length===1?12:20}
    needs=true;loop();
  }

  function place(){const ce=Math.cos(elev);cam.position.set(target.x+dist*Math.sin(ang)*ce,target.y+dist*Math.sin(elev),target.z+dist*Math.cos(ang)*ce);cam.lookAt(target.x,target.y,target.z)}
  function loop(){if(raf)return;const step=()=>{raf=0;if(!ren||!host.isConnected)return;let moving=false;
      if(tgtGoal){target.x=lerp(target.x,tgtGoal.x,0.12);target.z=lerp(target.z,tgtGoal.z,0.12);if(Math.abs(target.x-tgtGoal.x)+Math.abs(target.z-tgtGoal.z)<0.01)tgtGoal=null;moving=true}
      if(distGoal){dist=lerp(dist,distGoal,0.12);if(Math.abs(dist-distGoal)<0.05)distGoal=null;moving=true}
      if(hlGroup&&hlGroup.children.length&&!matchMedia('(prefers-reduced-motion: reduce)').matches){pulse+=0.06;hlGroup.children.forEach(o=>{if(o.userData.beacon)o.position.y=LEVEL_H*3+1.3+Math.sin(pulse)*0.18});moving=true}
      if(needs||moving){place();ren.render(scene,cam);needs=false}
      if(moving||dragging)raf=requestAnimationFrame(step)};
    raf=requestAnimationFrame(step)}
  function resize(){if(!ren)return;const w=host.clientWidth,h=host.clientHeight;ren.setSize(w,h,false);cam.aspect=w/Math.max(h,1);cam.updateProjectionMatrix();needs=true;loop()}

  async function mount(el){
    host=el;
    if(!window.THREE){try{await loadScript(THREE_URL)}catch{el.innerHTML='<p class="small muted" style="padding:12px">Não foi possível carregar a vista 3D (sem ligação à internet).</p>';return false}}
    T=window.THREE;
    scene=new T.Scene();scene.background=null;
    cam=new T.PerspectiveCamera(40,1,0.1,400);
    ren=new T.WebGLRenderer({antialias:true,alpha:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));
    el.innerHTML='';el.append(ren.domElement);ren.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    tip=document.createElement('div');tip.className='r3tip';tip.hidden=true;el.append(tip);
    const c=ren.domElement;
    c.addEventListener('pointerdown',e=>{dragging={x:e.clientX,y:e.clientY,moved:false};c.setPointerCapture(e.pointerId);c.style.cursor='grabbing'});
    c.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;if(Math.abs(dx)+Math.abs(dy)>3)dragging.moved=true;
      if(e.shiftKey||e.buttons===2){const s=dist*0.0016;target.x-=Math.cos(ang)*dx*s;target.z+=Math.sin(ang)*dx*s}else{ang-=dx*0.006;elev=Math.max(0.12,Math.min(1.35,elev+dy*0.005))}
      dragging.x=e.clientX;dragging.y=e.clientY;needs=true;loop()});
    c.addEventListener('pointerup',e=>{const was=dragging;dragging=null;c.style.cursor='grab';if(was&&!was.moved)pick(e)});
    c.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(5,Math.min(80,dist*(1+Math.sign(e.deltaY)*0.1)));needs=true;loop()},{passive:false});
    c.addEventListener('contextmenu',e=>e.preventDefault());
    new ResizeObserver(resize).observe(el);
    if(model)build();resize();return true;
  }
  function pick(e){
    if(!occMesh)return;const r=ren.domElement.getBoundingClientRect();const v=new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    const rc=new T.Raycaster();rc.setFromCamera(v,cam);const hit=rc.intersectObject(occMesh)[0];
    if(hit&&hit.instanceId!=null){const p=idxToPos[hit.instanceId];Rack3D.onPick&&Rack3D.onPick(p);tip.hidden=false;tip.textContent=Rack3D.describe?Rack3D.describe(p):p;tip.style.left=(e.clientX-r.left+10)+'px';tip.style.top=(e.clientY-r.top+10)+'px';clearTimeout(tip._t);tip._t=setTimeout(()=>tip.hidden=true,3500)}
  }
  return {
    mount,
    setData(positions,occSet){const key=Object.keys(positions).length+':'+occSet.size;if(model&&model._key===key)return;model=buildModel(positions,occSet);model._key=key;build()},
    highlight(list){hlList=[...new Set((list||[]).filter(Boolean))];applyHighlight()},
    reset(){ang=-0.75;elev=0.62;tgtGoal=null;if(model){target={x:Math.min(model.maxX,14)/2+2,y:1.6,z:-3};distGoal=Math.max(18,Math.min(42,model.maxX*0.9))}needs=true;loop()},
    get mounted(){return !!ren}
  };
})();
