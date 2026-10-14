'use strict';
const embedded=new URLSearchParams(location.search).has('embed');if(embedded)document.documentElement.classList.add('embedded');
const $=id=>document.getElementById(id),F=FlowMath;const W=2000,H=895,L=300,R=1240,T=85,B=775,CLOUD_WIDTH=540,CLOUD_HEIGHT=B-T,CLOUD_X=W-CLOUD_WIDTH-25,Y=z=>B-(z+4.5)/9*(B-T);let D,q=.58,t=0,axis='linear',path,background,pool,svg,timer=null,worker,inFlight=false,pending=null,serial=0,ready=false,images={};const toggles={},timings=[];let atlas,cloudCanvas,cloudContext,cloudWidth,cloudHeight,previewWidth=220,cloudLastFrame,finalCloudImage=null,finalCloudId=-1;
const zoom=s=>(1-Math.exp(-3*s))/(1-Math.exp(-3)),unzoom=s=>-Math.log(1-s*(1-Math.exp(-3)))/3,X=s=>L+(R-L)*(axis==='focus'?zoom(s):s),timeAt=x=>axis==='focus'?unzoom(Math.max(0,Math.min(1,(x-L)/(R-L)))):Math.max(0,Math.min(1,(x-L)/(R-L)));
function set(id,attrs){for(const[k,v]of Object.entries(attrs))$(id).setAttribute(k,v)}function stop(){clearTimeout(timer);timer=null;$('play').textContent='Play'}
function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let v=Math.imul(seed^seed>>>15,1|seed);v^=v+Math.imul(v^v>>>7,61|v);return ((v^v>>>14)>>>0)/4294967296}}
function gaussian(rng){return Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng())}
function dismissHint(){const hint=$('interaction-hint');if(hint)hint.remove()}
function interactionHintSetup(){
 svg.insertAdjacentHTML('beforeend',`<g id="interaction-hint" pointer-events="none" style="display:none"><circle id="interaction-halo" class="interaction-halo" r="17" fill="none" stroke="#db8651" stroke-width="2"/donghoon/><path id="interaction-guide" fill="none" stroke="#db8651" stroke-width="1.5"/donghoon/><g id="interaction-bubble"><rect width="238" height="38" rx="8" fill="white" stroke="#e6bb9f"/donghoon/><text x="119" y="25" text-anchor="middle" font-size="18" fill="#795039">Click or drag to explore</text></g></g>`);
 svg.append($('point-markers'));
}
function updateInteractionHint(x,y){
 const hint=$('interaction-hint');if(!hint)return;
 hint.style.display='';
 const small=innerWidth<=600,width=small?460:238,height=small?76:38,font=small?36:18;
 const left=Math.max(L+8,Math.min(R-width-8,x+18)),top=Math.max(T+8,Math.min(B-height-8,y-height-22));
 const bubble=$('interaction-bubble');
 bubble.querySelector('rect').setAttribute('width',width);
 bubble.querySelector('rect').setAttribute('height',height);
 const text=bubble.querySelector('text');
 text.setAttribute('x',width/2);text.setAttribute('y',height/2+font*.33);text.setAttribute('font-size',font);
 text.textContent=navigator.maxTouchPoints>0?'Tap or drag to explore':'Click or drag to explore';
 set('interaction-halo',{cx:x,cy:y});
 set('interaction-bubble',{transform:`translate(${left},${top})`});
 set('interaction-guide',{d:`M${left+12},${top+height}L${x},${y-12}`});
}
document.querySelector('.controls').addEventListener('pointerdown',dismissHint);
document.querySelector('.controls').addEventListener('keydown',dismissHint);
function trajectory(points){return points.map(([s,z],i)=>(i?'L':'M')+X(s).toFixed(2)+','+Y(z).toFixed(2)).join('')}
function mapping(eps,clean,start=0,end=1){return trajectory(Array.from({length:41},(_,i)=>{const s=start+(end-start)*i/40;return [s,(1-s)*eps+s*clean]}))}
function densityPath(values,anchor=R,sign=1,scale=150){return `M${anchor},${Y(-4.5)}`+values.map(([z,d])=>`L${anchor+sign*scale*d},${Y(z)}`).join('')+`L${anchor},${Y(4.5)}Z`}
function targetValues(){return Array.from({length:451},(_,i)=>{const z=-4.5+9*i/450;return [z,F.mu.reduce((v,m,j)=>v+F.pi[j]*F.normal(z,m,F.sigma),0)]})}
function posteriorValues(z,time,p){if(time===0)return targetValues();const values=Array.from({length:451},(_,i)=>-4.5+9*i/450);if(p.sd>1e-8)for(const m of p.cm)for(let i=-40;i<=40;i++)values.push(m+p.sd*i/10);return [...new Set(values.filter(x=>x>=-4.5&&x<=4.5))].sort((a,b)=>a-b).map(x=>[x,p.w.reduce((s,w,j)=>s+w*F.normal(x,p.cm[j],Math.max(p.sd,1e-8)),0)])}
function graphInit(){svg=$('plot').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-label="Interactive Gaussian-to-GMM flow with point images"><defs><linearGradient id="posterior-zoom-shade" gradientUnits="userSpaceOnUse" x1="${R}" x2="${CLOUD_X}" y1="0" y2="0"><stop offset="0" stop-color="#64717a" stop-opacity=".04"/donghoon/><stop offset=".6" stop-color="#64717a" stop-opacity=".1"/donghoon/><stop offset="1" stop-color="#64717a" stop-opacity=".06"/donghoon/></linearGradient><clipPath id="field"><rect x="${L}" y="${T}" width="${R-L}" height="${B-T}"/donghoon/></clipPath><marker id="red-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8Z" fill="#d92d27"/donghoon/></marker></defs><rect width="${W}" height="${H}" fill="white"/donghoon/><g id="grid"></g><g id="distributions"><path id="noise-density" fill="#bcd1d850" stroke="#587995" stroke-width="1.8"/donghoon/><path id="target-density" fill="#92bfa220" stroke="#62967a" stroke-width="1.8"/donghoon/></g><g id="posterior"><path id="posterior-zoom" fill="url(#posterior-zoom-shade)" stroke="#64717a" stroke-opacity=".18" stroke-width="1.1" pointer-events="none"/donghoon/><path id="clean-posterior" fill="#bc9bd240" stroke="#9659ba" stroke-width="2"/donghoon/></g><g clip-path="url(#field)"><g id="paths"></g><g id="pairs"></g><g id="trajectory"><path id="flow-path" fill="none" stroke="#087c8b" stroke-width="3.5"/donghoon/></g><g id="time-line"><path id="time-guide" stroke="#b4c7d0" stroke-width="1.5" stroke-dasharray="6 7"/donghoon/></g><g id="mean-line"><path id="mean-mapping" fill="none" stroke="#9659ba" stroke-width="3"/donghoon/></g><g id="extrapolate"><path id="extrapolation" fill="none" stroke="#d92d27" stroke-width="6" marker-end="url(#red-head)"/donghoon/></g></g><g id="endpoints"></g><g id="noise-strip"></g><circle id="noise-point" r="6" fill="#587995"/donghoon/><circle id="current-point" r="10" fill="#db8651" stroke="white" stroke-width="3"/donghoon/><circle id="clean-point" r="7" fill="#d92d27" stroke="white" stroke-width="2"/donghoon/><circle id="final-point" r="7" fill="#2a766d" stroke="white" stroke-width="2"/donghoon/><g id="image-links" class="image-links"></g><g id="images"></g><text x="${L}" y="40" text-anchor="middle" font-size="24" fill="#426474">Gaussian noise</text><text x="${R}" y="40" text-anchor="middle" font-size="24" fill="#426474">Clean data</text><text x="${(L+R)/2}" y="${H-37}" text-anchor="middle" font-size="20" fill="#67818e">denoising time · t</text></svg>`;svg=$('plot').querySelector('svg');const markers=document.createElementNS('http://www.w3.org/2000/svg','g');markers.id='point-markers';markers.style.pointerEvents='none';for(const id of ['noise-point','current-point','clean-point','final-point'])markers.append($(id));svg.append(markers);interactionHintSetup();const rng=random(91);pool=Array.from({length:2048},()=>{const j=Math.floor(rng()*4);return {eps:gaussian(rng),x:F.mu[j]+F.sigma*gaussian(rng),j}});background=Array.from({length:45},(_,i)=>F.path((i+.5)/45));let strip='';for(let j=0;j<4;j++)strip+=`<rect x="19" y="${T+(3-j)*(B-T)/4}" width="25" height="${(B-T)/4}" fill="${D.classes[j].color}" opacity=".75"/donghoon/>`;strip+=`<rect id="strip-hit" x="15" y="${T}" width="33" height="${B-T}" fill="transparent"/donghoon/><path id="strip-cursor" d="" stroke="#153c4e" stroke-width="3"/donghoon/><text x="33" y="${T-15}" text-anchor="middle" font-size="12" fill="#617c89">noise</text><text x="33" y="${B+27}" text-anchor="middle" font-size="12" fill="#617c89">rank</text>`;$('noise-strip').innerHTML=strip;redrawStatic();let dragging=false,stripDrag=false,pointerPending=null,pointerRAF=0;function pointer(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return {x:p.x,y:p.y}}function move(e){const p=pointer(e);pointerPending={p,strip:stripDrag};if(!pointerRAF)pointerRAF=requestAnimationFrame(()=>{pointerRAF=0;const v=pointerPending;if(v.strip)selectRank((B-v.p.y)/(B-T),true);else choosePoint(timeAt(v.p.x),Math.max(-4.49,Math.min(4.49,4.5-(v.p.y-T)/(B-T)*9)),true)})}svg.addEventListener('pointerdown',e=>{if(!ready||e.button!==0)return;const p=pointer(e);if(p.y<T||p.y>B||p.x>R+165)return;dismissHint();stop();svg.classList.add('dragging');dragging=true;stripDrag=p.x>=12&&p.x<=50;svg.setPointerCapture(e.pointerId);move(e);e.preventDefault()});svg.addEventListener('pointermove',e=>{if(dragging)move(e)});svg.addEventListener('pointerup',e=>{if(dragging){move(e);dragging=false;svg.classList.remove('dragging')}});svg.addEventListener('pointercancel',()=>{dragging=false;svg.classList.remove('dragging')})}
function redrawStatic(){let s=`<rect x="${L}" y="${T}" width="${R-L}" height="${B-T}" fill="#f9fbfc"/donghoon/>`;for(const time of [0,.1,.2,.3,.4,.6,.8,1])s+=`<path d="M${X(time)},${T}V${B}" stroke="#e0e9ed"/donghoon/><text x="${X(time)}" y="${B+29}" text-anchor="middle" font-size="19" fill="#698392">${time.toFixed(1)}</text>`;for(let z=-4;z<=4;z++)s+=`<path d="M${L},${Y(z)}H${R}" stroke="#edf1f3"/donghoon/><text x="${L-15}" y="${Y(z)+6}" text-anchor="end" font-size="18" fill="#8299a3">${z}</text>`;$('grid').innerHTML=s;$('paths').innerHTML=background.map(p=>`<path d="${trajectory(p)}" fill="none" stroke="#bdd0d8" stroke-width="1.1" opacity=".55"/donghoon/>`).join('');set('noise-density',{d:densityPath(Array.from({length:451},(_,i)=>{const z=-4.5+9*i/450;return [z,F.normal(z,0,1)]}),L,-1,145)});$('endpoints').innerHTML=D.photos.map(p=>`<circle class="endpoint" data-index="${p.index}" cx="${R}" cy="${Y(p.coordinate)}" r="1.6" fill="${D.classes[p.class_index].color}" opacity=".35"><title>Clean photograph</title></circle>`).join('');$('axis-note').textContent=axis==='focus'?'Early-time zoom. Tick labels show the actual time.':'Linear time axis.'}
function card(id,x,y,label,url,color,anchorX,anchorY,size=90,caption=''){return {id,x,y:Math.max(T+28,Math.min(B-size-8,y)),label,url,color,anchorX,anchorY,size,caption}}
function pointPhotos(frame){
 const {z,m,final,eps,winner}=frame,size=82*+$('image-size').value/100;
 const clampY=y=>Math.max(T+28,Math.min(B-size-8,y));
 const finalX=R-size-32,predictionX=finalX-size-20,rowY=clampY((Y(m)+Y(final))/2-size-16);
 let stateX=Math.min(finalX,X(t)+16),stateY=clampY(Y(z)+16);
 // Keep the current image beside its point, avoiding the compact endpoint row.
 if(stateX+size+8>predictionX && stateY+size+8>rowY-26 && stateY-26<rowY+size+8){
  const below=rowY+size+42,above=rowY-size-42;
  if(below<=B-size-8)stateY=below;
  else if(above>=T+28)stateY=above;
  else stateX=predictionX-size-20;
 }
 const cards=[
  card('noise-photo',L-size-32,Y(eps)-size/2,'\\epsilon',images.noise,'#587995',L,Y(eps),size),
  card('state-photo',stateX,stateY,'x_t',images.state,'#db8651',X(t),Y(z),size),
  card('prediction-photo',predictionX,rowY,'\\hat{x}_1',images.prediction,'#d92d27',R,Y(m),size),
  card('final-photo',finalX,rowY,'x_1',D.photos[winner].file,'#2a766d',R,Y(final),size)
 ];
 for(const c of cards){
  const role={'prediction-photo':'Prediction','final-photo':'Final sample'}[c.id]||'',header=26;
  if(!$(c.id)){
   $('images').insertAdjacentHTML('beforeend',`<g class="floating-photo" id="${c.id}"><title></title><rect rx="4" fill="white" fill-opacity=".97" stroke="${c.color}"/donghoon/><foreignObject class="math-label"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;height:24px"><span class="role" style="font-family:system-ui"></span><span class="formula"></span></div></foreignObject><image id="${c.id}-img"/donghoon/></g>`);
   $('image-links').insertAdjacentHTML('beforeend',`<path id="${c.id}-link" fill="none" stroke="${c.color}" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="4 4"/donghoon/>`);
   katex.render(c.label,$(c.id).querySelector('.math-label .formula'),{throwOnError:true});$(c.id).querySelector('.role').textContent=role;if(!role)$(c.id).querySelector('.role').style.display='none';
   $(c.id).querySelector('title').textContent={'noise-photo':'Initial noise ε','state-photo':'Current input xₜ','prediction-photo':'One-step clean prediction','final-photo':'Final image along the flow'}[c.id];
  }
  const g=$(c.id),rect=g.querySelector('rect'),label=g.querySelector('.math-label'),im=g.querySelector('image');
  for(const[k,v]of Object.entries({x:c.x-4,y:c.y-header,width:c.size+8,height:c.size+header+4}))rect.setAttribute(k,v);
  for(const[k,v]of Object.entries({x:c.x,y:c.y-header+1,width:c.size,height:header-1}))label.setAttribute(k,v);
  label.style.color=c.color;
  const fontSize=Math.min(18,c.size*.18);
  label.querySelector('div').style.fontSize=fontSize+'px';
  label.querySelector('.role').style.fontSize=fontSize*2/3+'px';
  for(const[k,v]of Object.entries({x:c.x,y:c.y,width:c.size,height:c.size}))im.setAttribute(k,v);
  if(c.url&&im.getAttribute('href')!==c.url)im.setAttribute('href',c.url);
  set(c.id+'-link',{d:`M${c.anchorX},${c.anchorY}L${c.x+c.size/2},${c.y+c.size/2}`});
 }
}
function posteriorZoom(frame,values,scale){
 const p=frame.p;
 function quantile(q){let lo=-10,hi=10;for(let i=0;i<35;i++){const x=(lo+hi)/2,c=p.w.reduce((s,w,j)=>s+w*F.cdf((x-p.cm[j])/p.sd),0);if(c<q)lo=x;else hi=x}return (lo+hi)/2}
 const low=frame.t>=1?frame.z:quantile(.005),high=frame.t>=1?frame.z:quantile(.995);
 let top=Math.max(T,Math.min(B,Y(high))),bottom=Math.max(T,Math.min(B,Y(low)));
 if(bottom-top<6){const center=Math.max(T+3,Math.min(B-3,(top+bottom)/2));top=center-3;bottom=center+3}
 const valueAt=y=>4.5-(y-T)*9/(B-T),density=x=>p.w.reduce((s,w,j)=>s+w*F.normal(x,p.cm[j],Math.max(p.sd,1e-8)),0);
 const edge=y=>[frame.t>=1?R+150:R+scale*density(valueAt(y)),y];
 const first=edge(top),last=edge(bottom),right=CLOUD_X-12;
 const contour=frame.t>=1?[first,last]:[first,...values.map(([x,d])=>[R+scale*d,Y(x)]).filter(a=>a[1]>top&&a[1]<bottom).reverse(),last];
 const d=`M${first[0]},${top}L${right},${T}L${right},${B}L${last[0]},${bottom}`+contour.slice().reverse().slice(1).map(a=>`L${a[0]},${a[1]}`).join('')+'Z';
 set('posterior-zoom',{d});window.posteriorZoomFrame={t:frame.t,q:frame.q,top,bottom,low,high,right};
}
function graph(frame){const {z,p,m,eps,final}=frame;const values=posteriorValues(z,t,p),peak=Math.max(...values.map(v=>v[1])),scale=Math.min(180,155/Math.max(peak,.01));set('target-density',{d:densityPath(targetValues(),R,1,scale)});set('clean-posterior',{d:t>=1?`M${R},${Y(z)}H${R+150}`:densityPath(values,R,1,scale)});posteriorZoom(frame,values,scale);set('flow-path',{d:trajectory(path)});set('time-guide',{d:`M${X(t)},${T}V${B}`});const pairs=pool.filter(a=>Math.abs((1-t)*a.eps+t*a.x-z)<=.04);$('pairs').innerHTML=pairs.map(a=>`<path class="training-pair" d="${mapping(a.eps,a.x)}" fill="none" stroke="${toggles['pair-colors']?D.classes[a.j].color:'#9659ba'}" stroke-width="1.4" opacity=".35"><title>ε=${a.eps.toFixed(3)}, x=${a.x.toFixed(3)}</title></path>`).join('');set('mean-mapping',{d:mapping(p.e,m,0,t)});set('extrapolation',{d:mapping(p.e,m,t,1),visibility:t===1?'hidden':'visible'});set('noise-point',{cx:L,cy:Y(eps)});set('current-point',{cx:X(t),cy:Y(z)});set('clean-point',{cx:R,cy:Y(m)});set('final-point',{cx:R,cy:Y(final)});
 const atStart=Math.hypot(X(t)-L,Y(z)-Y(eps))<20,atEnd=Math.hypot(X(t)-R,Y(z)-Y(final))<20,mergedEnd=Math.abs(Y(m)-Y(final))<18;
 set('noise-point',{r:atStart?14:7,fill:atStart?'none':'#587995',stroke:atStart?'#587995':'white','stroke-width':atStart?3:2});
 set('current-point',{r:atEnd?17:10,fill:atEnd?'none':'#db8651',stroke:atEnd?'#db8651':'white','stroke-width':atEnd?2.5:3});
 set('clean-point',{r:mergedEnd?12:7,fill:mergedEnd?'none':'#d92d27',stroke:mergedEnd?'#d92d27':'white','stroke-width':mergedEnd?3:2});
 set('strip-cursor',{d:`M13,${B-q*(B-T)}H50`});updateInteractionHint(X(t),Y(z));pointPhotos(frame);for(const[k,v]of Object.entries(toggles))if(k!=='pair-colors')$(k).style.display=v?'':'none';frame.pairCount=pairs.length;}
function cloudLayout(ids,width=cloudWidth,height=cloudHeight){
 const n=ids.length,rows=Math.max(1,Math.min(n,Math.round(Math.sqrt(n*height/width)))),gap=n>1?1:0,rowHeight=(height-gap*(rows-1))/rows,base=Math.floor(n/rows),extra=n%rows,sorted=ids.slice().sort((a,b)=>a-b),out=[];
 let k=0;
 for(let r=0;r<rows;r++){
  const count=base+(r<extra?1:0),cellWidth=(width-gap*(count-1))/count;
  for(let c=0;c<count;c++)out.push({id:sorted[k++],x:c*(cellWidth+gap),y:r*(rowHeight+gap),width:cellWidth,height:rowHeight,size:Math.min(cellWidth,rowHeight)});
 }
 return out;
}
function cloudSetup(){const canvas=document.createElement('canvas');canvas.id='cloud-canvas';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Candidate photograph cloud');canvas.style.width=canvas.style.height='100%';canvas.style.position='absolute';canvas.style.left=canvas.style.top='0';$('cloud').append(canvas);cloudCanvas=canvas;cloudContext=canvas.getContext('2d');const hover=document.createElement('div');hover.id='cloud-hover';hover.style.cssText='display:none;position:absolute;z-index:20;pointer-events:none;background:white;border:1px solid #c5d8df;border-radius:8px;padding:8px;width:190px;box-shadow:0 5px 24px #17364630';hover.innerHTML='<img style="width:172px;height:172px;object-fit:cover;border-radius:5px"><div style="font-size:12px;margin-top:5px"></div>';$('cloud').append(hover);plotCloudSetup();function hit(e){const box=canvas.getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;return cloudLastFrame?.layout.find(p=>x>=p.x&&x<=p.x+p.width&&y>=p.y&&y<=p.y+p.height)}canvas.onmousemove=e=>{const p=hit(e);if(!p){hover.style.display='none';return}const photo=D.photos[p.id];hover.querySelector('img').src=photo.file;hover.querySelector('div').textContent=`Posterior weight: ${(cloudLastFrame.weights[p.id]*100).toFixed(3)}%`;const box=canvas.getBoundingClientRect();hover.style.left=Math.max(0,Math.min(box.width-190,e.clientX-box.left+12))+'px';hover.style.top=Math.max(0,Math.min(box.height-220,e.clientY-box.top-105))+'px';hover.style.display='block'};canvas.onmouseleave=()=>hover.style.display='none';canvas.onclick=e=>{const p=hit(e);if(p){hover.style.display='none';selectRank(D.photos[p.id].q)}};measureCloud()}
function plotCloudSetup(){
 $('plot').querySelector('svg').insertAdjacentHTML('beforeend',`<g id="posterior-cloud" transform="translate(${CLOUD_X},${T})"><rect x="-12" y="-12" width="${CLOUD_WIDTH+24}" height="${CLOUD_HEIGHT+24}" rx="12" fill="#f9fbfa" stroke="#d9e5df"/donghoon/><foreignObject x="0" y="-65" width="${CLOUD_WIDTH}" height="52"><div xmlns="http://www.w3.org/1999/xhtml" id="cloud-density-title" style="text-align:center;color:#426474;font-size:24px;padding-top:8px"></div></foreignObject><foreignObject width="${CLOUD_WIDTH}" height="${CLOUD_HEIGHT}"><canvas xmlns="http://www.w3.org/1999/xhtml" id="plot-cloud-canvas" style="display:block;width:${CLOUD_WIDTH}px;height:${CLOUD_HEIGHT}px" role="img" aria-label="Fixed posterior photograph cloud"></canvas></foreignObject><text id="plot-cloud-count" x="${CLOUD_WIDTH/2}" y="${CLOUD_HEIGHT+36}" text-anchor="middle" font-size="16" fill="#587282"/donghoon/></g>`);
 katex.render('p(x_1 \\mid x_t,t)',$('cloud-density-title'),{throwOnError:true});
 const c=$('plot-cloud-canvas');c.width=Math.round(CLOUD_WIDTH*devicePixelRatio);c.height=Math.round(CLOUD_HEIGHT*devicePixelRatio);c.getContext('2d').setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
 // The fixed cloud is not an input to the scalar graph's drag handler.
 c.addEventListener('pointerdown',e=>e.stopPropagation());
}
function paintPlotCloud(frame){
 if(!$('plot-cloud-canvas'))return;
 paintCloud(frame,$('plot-cloud-canvas').getContext('2d'),CLOUD_WIDTH,CLOUD_HEIGHT,cloudLayout(frame.visible,CLOUD_WIDTH,CLOUD_HEIGHT,Math.min(CLOUD_WIDTH,CLOUD_HEIGHT)-24));
 $('plot-cloud-count').textContent=frame.visible.length===1?'One final image':`${frame.visible.length} images being averaged`;
 window.plotCloudFrame=frame;
}
function measureCloud(){if(!cloudCanvas)return;cloudWidth=$('cloud').clientWidth||CLOUD_WIDTH;cloudHeight=$('cloud').clientHeight||450;previewWidth=$('mean').getBoundingClientRect().width||220;const dpr=window.devicePixelRatio;cloudCanvas.width=Math.round(cloudWidth*dpr);cloudCanvas.height=Math.round(cloudHeight*dpr);cloudContext.setTransform(dpr,0,0,dpr,0,0)}
function paintCloud(frame,ctx=cloudContext,width=cloudWidth,height=cloudHeight,layout=frame.layout){
 ctx.clearRect(0,0,width,height);ctx.save();
 for(const p of layout){
  const photo=D.photos[p.id],highRes=frame.visible.length===1&&finalCloudId===photo.id&&finalCloudImage?.complete&&finalCloudImage.naturalWidth;
  const image=highRes?finalCloudImage:atlas,sourceSize=highRes?image.naturalWidth:128,sourceHeight=highRes?image.naturalHeight:128;
  const cover=Math.max(p.width/sourceSize,p.height/sourceHeight),sw=p.width/cover,sh=p.height/cover;
  const sx=(highRes?0:photo.id%25*128)+(sourceSize-sw)/2,sy=(highRes?0:Math.floor(photo.id/25)*128)+(sourceHeight-sh)/2;
  ctx.drawImage(image,sx,sy,sw,sh,p.x,p.y,p.width,p.height);
 }
 ctx.restore();
}
function updateCloud(frame){frame.layout=cloudLayout(frame.visible);cloudLastFrame=frame;if(frame.visible.length===1){const photo=D.photos[frame.visible[0]];if(finalCloudId!==photo.id){finalCloudId=photo.id;finalCloudImage=new Image();const img=finalCloudImage;img.onload=()=>{if(cloudLastFrame?.visible.length===1&&finalCloudImage===img){paintCloud(cloudLastFrame);paintPlotCloud(cloudLastFrame)}};img.src=photo.file}}paintCloud(frame);paintPlotCloud(frame);$('cloud-title').textContent=frame.visible.length===1?'One final image':'Images being averaged';$('cloud-count').textContent=`${frame.visible.length} of 500`;$('cloud-caption').textContent=frame.t===0?'Every photograph has weight 1/500. Every class has probability 25%.':frame.visible.length===1?'One photograph covers at least 99% of the posterior.':'The prediction beside this cloud uses exactly these posterior weights, including hidden candidates.';window.cloudFrame=frame;}
function queueImages(frame){pending={type:'frame',id:++serial,q,t,weights:frame.weights,frame};if(!inFlight&&worker){inFlight=true;worker.postMessage(pending);pending=null}}
function rgbaURL(bytes){const c=document.createElement('canvas');c.width=c.height=128;c.getContext('2d').putImageData(new ImageData(bytes,128,128),0,0);return c.toDataURL('image/png')}
function updateMeanCaption(f){$('mean-caption').textContent=f.t===0?'The arithmetic mean of all 500 photographs.':'The RGB mean of all photographs, weighted by their posterior probabilities.'}
function acceptImages(d){inFlight=false;const f=d.frame;images={noise:rgbaURL(d.noise),prediction:rgbaURL(d.prediction),state:rgbaURL(d.current)};if(d.t>=1)images.prediction=images.state=D.photos[f.winner].file;$('mean').src=images.prediction;$('state').src=images.state;$('download-mean').href=images.prediction;for(const[k,id]of [['noise','noise-photo-img'],['state','state-photo-img'],['prediction','prediction-photo-img']])if($(id))$(id).setAttribute('href',images[k]);updateCloud(f);updateMeanCaption(f);window.imageFrame={q:d.q,t:d.t,coefficients:d.coefficients,weights:f.weights,target:d.target,elapsed:d.elapsed,quadratureTime:d.quadratureTime,simd:d.simd};window.previewHistory=(window.previewHistory||[]).concat([{q:d.q,t:d.t,at:performance.now()}]).slice(-40);window.imageReady=true;if(pending){inFlight=true;worker.postMessage(pending);pending=null}}
function render(){const start=performance.now(),z=F.inverse(q,t),p=F.posterior(z,t),weights=F.photoWeights(z,t,D.photos,q),winner=Math.min(D.size-1,Math.floor(q*D.size)),ranked=weights.map((w,i)=>({w,i})).sort((a,b)=>b.w-a.w||a.i-b.i);let mass=0,visible=[];for(const v of ranked){mass+=v.w;visible.push(v.i);if(t>0&&mass>=.99-1e-12)break}const cls=Array(4).fill(0);weights.forEach((v,i)=>cls[D.photos[i].class_index]+=v);const frame={t,q,z,p,m:p.m,eps:F.inverse(q,0),final:F.inverse(q,1),weights,winner,visible,visibleMass:mass,ess:1/weights.reduce((s,v)=>s+v*v,0),class_mass:cls};$('time').textContent=`t = ${t.toFixed(3)}`;$('step').value=Math.round((axis==='focus'?zoom(t):t)*1000);$('t-value').value=t.toFixed(4);$('x-value').value=z.toFixed(4);graph(frame);window.flowFrame=frame;if(!window.imageReady){updateCloud(frame);updateMeanCaption(frame)}queueImages(frame);timings.push(performance.now()-start);window.renderTimings=timings;window.cloudReady=true;return frame}
function selectRank(value,fromPointer=false){if(!fromPointer)stop();q=Math.max(1e-9,Math.min(1-1e-9,value));path=F.path(q);render()}
function choosePoint(time,z,fromPointer=false){t=Math.max(0,Math.min(1,time));selectRank(F.rank(z,t),fromPointer)}
function seek(time){stop();t=Math.max(0,Math.min(1,time));render()}
function start(){
 if(timer!==null)return;
 if(t>=1)t=0;
 $('play').textContent='Pause';
 render();
 function tick(){
  if(t>=1){
   if(!$('loop').checked){stop();return;}
   t=0;
  }else{
   const position=(axis==='focus'?zoom(t):t)+.006;
   t=position>=1?1:axis==='focus'?unzoom(position):position;
  }
  render();
  if(t>=1&&!$('loop').checked)stop();
  else timer=setTimeout(tick,t>=1?1000:55);
 }
 timer=setTimeout(tick,55);
}
$('loop').onchange=()=>{if(t>=1&&!$('loop').checked)stop()};
$('image-size').oninput=()=>{
 $('image-size-value').value=$('image-size').value+'%';
 if(window.flowFrame)pointPhotos(window.flowFrame);
};
$('step').oninput=()=>seek(axis==='focus'?unzoom(+$('step').value/1000):+$('step').value/1000);$('t-value').onchange=()=>seek(+$('t-value').value);$('x-value').onchange=()=>choosePoint(t,+$('x-value').value);$('axis').onchange=()=>{axis=$('axis').value;redrawStatic();render()};$('new-noise').onclick=()=>selectRank((crypto.getRandomValues(new Uint32Array(1))[0]+.5)/4294967296);$('play').onclick=()=>timer===null?start():stop();document.querySelectorAll('[data-line]').forEach(el=>{toggles[el.dataset.line]=el.checked;el.onchange=()=>{toggles[el.dataset.line]=el.checked;render()}});window.addEventListener('resize',()=>{if(ready){measureCloud();if(cloudLastFrame){cloudLastFrame.layout=cloudLayout(cloudLastFrame.visible);paintCloud(cloudLastFrame)}render()}});
async function loadAtlas(){const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='bank-atlas.png'});atlas=image;const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d',{willReadFrequently:true}),bank=[];for(let id=0;id<D.size;id++){ctx.clearRect(0,0,128,128);ctx.drawImage(image,id%25*128,Math.floor(id/25)*128,128,128,0,0,128,128);const bytes=ctx.getImageData(0,0,128,128).data,raw=new Uint8Array(128*128*3);for(let j=0;j<raw.length;j++)raw[j]=bytes[Math.floor(j/3)*4+j%3];bank.push(raw.buffer)}return bank}
(async()=>{try{D=await(await fetch('photo-bank.json')).json();images.prediction='global-mean.png';images.state='global-mean.png';$('timeline').replaceChildren(...[0,.1,.2,.3,.4,.6,.8,.95,1].map(v=>{const b=document.createElement('button');b.textContent=`t = ${v.toFixed(2)}`;b.onclick=()=>seek(v);return b}));document.querySelectorAll('.inline-math').forEach(e=>katex.render(e.textContent,e,{throwOnError:true}));document.querySelectorAll('.math').forEach(e=>katex.render(e.textContent,e,{displayMode:true,throwOnError:true}));graphInit();path=F.path(q);const bank=await loadAtlas();cloudSetup();worker=new Worker('image-flow-worker.js');worker.onmessage=e=>{if(e.data.type==='ready'){ready=true;document.querySelectorAll('.controls button,.controls input').forEach(e=>e.disabled=false);start()}else acceptImages(e.data)};worker.onerror=e=>{$('status').textContent=e.message;throw new Error(e.message)};worker.postMessage({type:'init',photos:D.photos,bank,resolution:128,quadrature:D.image_quadrature},bank);window.flowData=D;window.flowSeek=seek;window.choosePoint=choosePoint;window.selectRank=selectRank;window.flowMath=F;window.sampleIndex=r=>Math.min(D.size-1,Math.floor(r*D.size))}catch(e){$('status').textContent=e.message;throw e}})();

if(embedded&&window.parent!==window){const report=()=>parent.postMessage({kind:"flow-demo-resize",height:Math.ceil(document.querySelector("main").getBoundingClientRect().height)},location.origin);new ResizeObserver(report).observe(document.querySelector("main"));addEventListener("load",report);}
