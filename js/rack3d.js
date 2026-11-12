"use strict";
/* ============ Vista 3D das racks (fiel ao inventário e à planta) ============
   Usa window.PCV_RACKMAP (js/rackmap.js): cada posição tem rack, andar (lvl), fila e ordem,
   a partir da tabela de andares do armazém. A disposição das racks no chão segue o croqui da planta.
   A posição procurada fica a amarelo. */
const Rack3D=(()=>{
  const THREE_URL=window.PCV_VENDOR?window.PCV_VENDOR+'three.min.js':'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const RK='ABCDEFGH';
  const SLOT=0.28, LEVEL_H=1.0, DEPTH=1.0, ROW_GAP=1.15;
  // posição (x,z) e rotação de cada rack no chão, da planta. ang em radianos (0 = alinhado em X).
  const PLAN={
    // topo: A e B horizontais, lado direito-cima
    A:{x:3,   z:-16, rot:0},
    B:{x:3.5, z:-13, rot:0},
    // Rack E vertical, à esquerda da A
    E:{x:-2,  z:-15, rot:Math.PI/2},
    // faixa do meio: H e D horizontais, lado a lado
    H:{x:-3,  z:-9,  rot:0},
    D:{x:1,   z:-9,  rot:0},
    // faixa de baixo-esquerda: F e G(pequeno? não — ver) ; aqui G é o grande vertical à direita
    F:{x:-3,  z:-4,  rot:0},
    // Rack G grande, vertical, lado direito junto ao PCV
    G:{x:11,  z:-9,  rot:Math.PI/2},
    // Rack C à direita, vertical curto
    C:{x:14,  z:-11, rot:Math.PI/2},
  };
  // zonas do chão (croqui): caixotes 45-60 + SN01 à esquerda da H; armário bobst 106 junto à máquina
  let T,scene,cam,ren,host,occMesh,hlGroup,model=null,slotIndex=new Map(),idxToPos=[],raf=0,dragging=null;
  let ang=-0.6,elev=0.85,dist=40,target={x:4,y:1,z:-9},tgtGoal=null,distGoal=null,tip,needs=true,pulse=0,hlList=[];
  const lerp=(a,b,t)=>a+(b-a)*t;

  function buildModel(positions,occ){
    const RM=window.PCV_RACKMAP||{pos:{},spec:{}};
    const racks={};
    // estrutura a partir do spec
    for(const [L,sp] of Object.entries(RM.spec)){
      const pl=PLAN[L]||{x:0,z:0,rot:0};
      racks[L]={name:L,levels:sp.levels,rows:sp.rows,len:sp.len,x:pl.x,z:pl.z,rot:pl.rot||0,custom:pl.custom,slots:[]};
    }
    // coloca cada posição conhecida
    const zonesMap={Caixotes:[],'Armário B106':[],Outros:[]};
    for(const p of Object.keys(positions)){
      const m=RM.pos[p];
      if(m){const L=RK[m[0]];if(racks[L])racks[L].slots.push({p,lvl:m[1],fila:m[2],ord:m[3],nf:m[4]});}
      else{
        const loc=(positions[p].l||'');
        if(/bobst|b106|b 106/i.test(p+' '+loc))zonesMap['Armário B106'].push(p);
        else if(/caix|ch[aã]o|sn0/i.test(p+' '+loc))zonesMap['Caixotes'].push(p);
        else zonesMap['Outros'].push(p);
      }
    }
    const zones=[
      {name:'Caixotes 45–60 · SN01',positions:zonesMap['Caixotes'],x:-6,z:-9,w:1.2,d:3,stack:true},
      {name:'Armário B106',positions:zonesMap['Armário B106'],x:0,z:0,w:2,d:1.1},
    ];
    if(zonesMap['Outros'].length)zones.push({name:'Outros',positions:zonesMap['Outros'],x:13,z:-6,w:1.6,d:1.2});
    return {racks:Object.values(racks),zones,occ};
  }

  function label(text,size,color,wScale){
    const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');
    g.font=`700 ${size||64}px IBM Plex Sans, Arial, sans-serif`;g.fillStyle=color||'#13693b';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,64);
    const s=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false}));s.scale.set(wScale||3.2,0.8,1);return s;
  }

  // devolve a coordenada local (ao longo do rack, profundidade) para uma posição
  function slotXZ(r,s){
    // fila 0 à frente (dz 0), fila 1 atrás (dz -ROW_GAP). ordem ao longo do comprimento.
    const along=(s.ord+0.5)*SLOT;
    const dz=-s.fila*ROW_GAP;
    return {along,dz};
  }

  function build(){
    if(!scene)return;
    while(scene.children.length)scene.remove(scene.children[0]);
    slotIndex.clear();idxToPos=[];
    scene.add(new T.HemisphereLight(0xffffff,0xb9c8be,0.95));
    const sun=new T.DirectionalLight(0xffffff,0.5);sun.position.set(10,16,8);scene.add(sun);
    const floor=new T.Mesh(new T.PlaneGeometry(40,34),new T.MeshLambertMaterial({color:0xf2f5f3}));
    floor.rotation.x=-Math.PI/2;floor.position.set(3,0,-6);scene.add(floor);
    const grid=new T.GridHelper(40,40,0xdde6e0,0xe8eee9);grid.position.set(3,0.002,-6);scene.add(grid);
    const blue=new T.MeshLambertMaterial({color:0x2f6fb5}),orange=new T.MeshLambertMaterial({color:0xe8833a});
    const deckMat=new T.MeshLambertMaterial({color:0xe9dcc3,transparent:true,opacity:0.5});
    let slots=[];

    for(const r of model.racks){
      const g=new T.Group();g.position.set(r.x,0,r.z);g.rotation.y=r.rot;scene.add(g);
      const L=r.len*SLOT, H=r.levels*LEVEL_H, rows=r.rows;
      const depth=(rows-1)*ROW_GAP+DEPTH;
      const upG=new T.BoxGeometry(0.08,H+0.12,0.08);
      // montantes a cada ~12 posições, em cada fila + fundo
      const bays=Math.max(1,Math.round(r.len/12));
      for(let b=0;b<=bays;b++){const bx=Math.min(b*(L/bays),L);
        for(let f=0;f<rows;f++){const u=new T.Mesh(upG,blue);u.position.set(bx,(H+0.12)/2,-f*ROW_GAP);g.add(u);}
      }
      // travessas horizontais por andar, em cada fila
      for(let k=0;k<=r.levels;k++){
        for(let f=0;f<rows;f++){const bm=new T.Mesh(new T.BoxGeometry(L,0.07,0.07),orange);bm.position.set(L/2,k*LEVEL_H,-f*ROW_GAP);g.add(bm);}
        if(k<r.levels){const deck=new T.Mesh(new T.BoxGeometry(L,0.02,depth),deckMat);deck.position.set(L/2,k*LEVEL_H+0.04,-depth/2+DEPTH/2);g.add(deck);}
      }
      // nome do rack
      const lb=label('Rack '+r.name,72,'#13693b',3.2);lb.position.set(-0.6,H+0.5,0.2);g.add(lb);
      // etiquetas dos andares no rack A
      if(r.name==='A'){['R/C','1º','2º','3º','4º','5º'].forEach((t,k)=>{if(k<r.levels){const s=label(t,40,'#728379',1.3);s.scale.set(1.1,0.5,1);s.position.set(-0.7,k*LEVEL_H+0.5,0.1);g.add(s);}});}
      // slots (posições) — guardamos a coordenada mundial para o raycaster e highlight
      for(const s of r.slots){
        const {along,dz}=slotXZ(r,s);
        const lx=along, ly=s.lvl*LEVEL_H+0.46, lz=dz-DEPTH/2;
        // mundo = grupo transform (rot y + translate)
        const wx=r.x+lx*Math.cos(r.rot)+lz*Math.sin(r.rot);
        const wz=r.z-lx*Math.sin(r.rot)+lz*Math.cos(r.rot);
        slots.push({p:s.p,x:wx,y:ly,z:wz});
      }
    }
    // zonas do chão
    for(const zn of model.zones){
      if(!zn.positions.length)continue;
      const box=new T.Mesh(new T.BoxGeometry(zn.w,zn.stack?1.4:0.5,zn.d),new T.MeshLambertMaterial({color:zn.stack?0xcdbf9a:0xcfd6d1}));
      box.position.set(zn.x,zn.stack?0.7:0.25,zn.z);scene.add(box);
      const lb=label(zn.name,40,'#40554a',2.6);lb.position.set(zn.x,zn.stack?1.8:1.0,zn.z);scene.add(lb);
      zn.positions.forEach((p,i)=>slots.push({p,x:zn.x,y:zn.stack?0.4+(i%5)*0.25:0.6,z:zn.z,zone:true}));
    }

    // cortantes guardados
    const occ=slots.filter(s=>model.occ.has(s.p)&&!s.zone);
    const g=new T.BoxGeometry(SLOT*0.6,0.72,DEPTH*0.8);
    occMesh=new T.InstancedMesh(g,new T.MeshLambertMaterial({color:0x8fbf9f}),Math.max(occ.length,1));
    const mt=new T.Matrix4();occ.forEach((s,i)=>{mt.makeTranslation(s.x,s.y,s.z);occMesh.setMatrixAt(i,mt);idxToPos[i]=s.p});
    occMesh.count=occ.length;occMesh.instanceMatrix.needsUpdate=true;scene.add(occMesh);
    slots.forEach(s=>slotIndex.set(s.p,s));
    hlGroup=new T.Group();scene.add(hlGroup);
    applyHighlight();needs=true;loop();
  }

  function applyHighlight(){
    if(!hlGroup)return;while(hlGroup.children.length)hlGroup.remove(hlGroup.children[0]);
    const pts=hlList.map(p=>slotIndex.get(p)).filter(Boolean);
    const yel=new T.MeshLambertMaterial({color:0xf6c400,emissive:0x6b5300,emissiveIntensity:0.4});
    const topY=7.5;
    for(const s of pts){
      const b=new T.Mesh(s.zone?new T.BoxGeometry(1.2,0.6,1.2):new T.BoxGeometry(SLOT*1.25,0.85,DEPTH*0.9),yel);b.position.set(s.x,s.y,s.z);hlGroup.add(b);
      const c=new T.Mesh(new T.ConeGeometry(0.26,0.56,16),yel);c.rotation.x=Math.PI;c.position.set(s.x,topY,s.z);c.userData.beacon=true;hlGroup.add(c);
      const ln=new T.Mesh(new T.CylinderGeometry(0.014,0.014,topY-s.y,6),yel);ln.position.set(s.x,(s.y+topY)/2,s.z);hlGroup.add(ln);
    }
    if(pts.length){const cx=pts.reduce((a,s)=>a+s.x,0)/pts.length,cz=pts.reduce((a,s)=>a+s.z,0)/pts.length;tgtGoal={x:cx,y:1.5,z:cz};distGoal=pts.length===1?10:18;}
    needs=true;loop();
  }

  function place(){const ce=Math.cos(elev);cam.position.set(target.x+dist*Math.sin(ang)*ce,target.y+dist*Math.sin(elev),target.z+dist*Math.cos(ang)*ce);cam.lookAt(target.x,target.y,target.z);}
  function loop(){if(raf)return;const step=()=>{raf=0;if(!ren||!host.isConnected)return;let moving=false;
      if(tgtGoal){target.x=lerp(target.x,tgtGoal.x,0.12);target.z=lerp(target.z,tgtGoal.z,0.12);if(Math.abs(target.x-tgtGoal.x)+Math.abs(target.z-tgtGoal.z)<0.01)tgtGoal=null;moving=true;}
      if(distGoal){dist=lerp(dist,distGoal,0.12);if(Math.abs(dist-distGoal)<0.05)distGoal=null;moving=true;}
      if(hlGroup&&hlGroup.children.length&&!matchMedia('(prefers-reduced-motion: reduce)').matches){pulse+=0.06;hlGroup.children.forEach(o=>{if(o.userData.beacon)o.position.y=7.5+Math.sin(pulse)*0.18;});moving=true;}
      if(needs||moving){place();ren.render(scene,cam);needs=false;}
      if(moving||dragging)raf=requestAnimationFrame(step);};
    raf=requestAnimationFrame(step);}
  function resize(){if(!ren)return;const w=host.clientWidth,h=host.clientHeight;ren.setSize(w,h,false);cam.aspect=w/Math.max(h,1);cam.updateProjectionMatrix();needs=true;loop();}

  async function mount(el){
    host=el;
    if(!window.THREE){try{await loadScript(THREE_URL)}catch{el.innerHTML='<p class="small muted" style="padding:12px">Não foi possível carregar a vista 3D (sem ligação à internet).</p>';return false;}}
    T=window.THREE;
    scene=new T.Scene();scene.background=null;
    cam=new T.PerspectiveCamera(42,1,0.1,400);
    ren=new T.WebGLRenderer({antialias:true,alpha:true});ren.setPixelRatio(Math.min(devicePixelRatio,2));
    el.innerHTML='';el.append(ren.domElement);ren.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    tip=document.createElement('div');tip.className='r3tip';tip.hidden=true;el.append(tip);
    const c=ren.domElement;
    c.addEventListener('pointerdown',e=>{dragging={x:e.clientX,y:e.clientY,moved:false};c.setPointerCapture(e.pointerId);c.style.cursor='grabbing';});
    c.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;if(Math.abs(dx)+Math.abs(dy)>3)dragging.moved=true;
      if(e.shiftKey||e.buttons===2){const s=dist*0.0016;target.x-=Math.cos(ang)*dx*s;target.z+=Math.sin(ang)*dx*s;}else{ang-=dx*0.006;elev=Math.max(0.12,Math.min(1.35,elev+dy*0.005));}
      dragging.x=e.clientX;dragging.y=e.clientY;needs=true;loop();});
    c.addEventListener('pointerup',e=>{const was=dragging;dragging=null;c.style.cursor='grab';if(was&&!was.moved)pick(e);});
    c.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(5,Math.min(90,dist*(1+Math.sign(e.deltaY)*0.1)));needs=true;loop();},{passive:false});
    c.addEventListener('contextmenu',e=>e.preventDefault());
    new ResizeObserver(resize).observe(el);
    if(model)build();resize();return true;
  }
  function pick(e){
    if(!occMesh)return;const r=ren.domElement.getBoundingClientRect();const v=new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    const rc=new T.Raycaster();rc.setFromCamera(v,cam);const hit=rc.intersectObject(occMesh)[0];
    if(hit&&hit.instanceId!=null){const p=idxToPos[hit.instanceId];Rack3D.onPick&&Rack3D.onPick(p);tip.hidden=false;tip.textContent=Rack3D.describe?Rack3D.describe(p):p;tip.style.left=(e.clientX-r.left+10)+'px';tip.style.top=(e.clientY-r.top+10)+'px';clearTimeout(tip._t);tip._t=setTimeout(()=>tip.hidden=true,3500);}
  }
  return {
    mount,
    setData(positions,occSet){const key=Object.keys(positions).length+':'+occSet.size;if(model&&model._key===key)return;model=buildModel(positions,occSet);model._key=key;if(scene)build();},
    highlight(list){hlList=[...new Set((list||[]).filter(Boolean))];applyHighlight();},
    reset(){ang=-0.6;elev=0.85;tgtGoal=null;target={x:4,y:1,z:-9};distGoal=40;needs=true;loop();},
    get mounted(){return !!ren}
  };
})();
