/**
 * Persona Dot Portrait Renderer V2
 *
 * Silhouette-first approach:
 * 1. Draw anime-inspired character silhouette as Canvas paths
 * 2. Dot-sample the silhouette into a dot-matrix portrait
 * 3. Apply fragmentation, noise, glow as post-effects
 *
 * Exposes: window.PersonaPortraitRenderer
 */
(function(){
var DIMS=["EI","SN","TF","JP","AT"];

// ====== CLAMP / UTILITY ======
var C=function(v){return Math.max(0,Math.min(1,v==null?0.5:Number(v)))};
var L=function(v,a,b){return a+(b-a)*C(v)};

// ====== DIMENSION TO VISUAL PARAMS ======
function dimToParams(dims){
  var p={spread:.5,warmth:.5,structure:.5,stability:.5,clarity:.5};
  if(!dims)return p;
  DIMS.forEach(function(d){
    var i=dims[d]||{},s=i.side||"",sc=Number(i.score)||50;
    if(d==="EI")p.spread=s==="E"?L(sc/100,.35,.95):L(1-sc/100,0,.45);
    if(d==="SN")p.structure=s==="S"?L(sc/100,.35,1):L(1-sc/100,.1,.55);
    if(d==="TF")p.warmth=s==="F"?L(sc/100,.4,1):L(1-sc/100,0,.5);
    if(d==="JP")p.stability=s==="J"?L(sc/100,.4,1):L(1-sc/100,.05,.55);
    if(d==="AT")p.clarity=s==="A"?L(sc/100,.4,1):L(1-sc/100,0,.5);
  });
  return p;
}

function sampleStyle(a,b,t){return t<.5?a:b}
var HAIR_STYLES={shortSharp:"short-sharp",softMedium:"soft-medium",straightQuiet:"straight-quiet",messyOpen:"messy-open",haloFragment:"halo-fragment"};
var EYE_STYLES={calm:"calm",sharp:"sharp",bright:"bright",distant:"distant",restless:"restless"};
var SILH_STYLES={frontSoft:"front-soft",sideQuiet:"side-quiet",sharpCentered:"sharp-centered",messyOutward:"messy-outward",fragmentedHalo:"fragmented-halo"};

function buildVI(dimParams,opts){
  opts=opts||{};var dp=dimParams||{};
  var s=C(dp.spread||.5),w=C(dp.warmth||.5),st=C(dp.structure||.5),sb=C(dp.stability||.5),cl=C(dp.clarity||.5);
  return{
    typeCode:opts.typeCode||"----",
    palette:opts.palette||["#DDEEE6","#E8E3F4","#2F8F72","#6F5FA8"],
    dotDensity:C(opts.dotDensity!=null?opts.dotDensity:.56+st*.28),
    noise:C(opts.noise!=null?opts.noise:.1+(1-cl)*.28),
    glow:C(opts.glow!=null?opts.glow:.3+s*.26+w*.16),
    fragmentation:C(opts.fragmentation!=null?opts.fragmentation:.08+(1-cl)*.34),
    symmetry:C(opts.symmetry!=null?opts.symmetry:.36+sb*.44+st*.1),
    softness:C(opts.softness!=null?opts.softness:.5+w*.32),
    motionLevel:C(opts.motionLevel!=null?opts.motionLevel:(1-sb)*.3+(1-st)*.12),
    spread:s,warmth:w,structure:st,stability:sb,clarity:cl,
    hairStyle:opts.hairStyle||"soft-medium",
    eyeStyle:opts.eyeStyle||"calm",
    silhouetteType:opts.silhouetteType||"front-soft",
    motifs:opts.motifs||[],caption:opts.caption||""
  };
}

function buildFromDims(dimensions,opts){return buildVI(dimToParams(dimensions),opts)}

function buildFromTypeCode(tc,opts){
  opts=opts||{};if(!tc||tc==="----")return buildFromDims(null,opts);
  var base=tc.split("-")[0],ident=(tc.split("-")[1]||"A");if(base.length<4)return buildFromDims(null,opts);
  var dims={};["EI","SN","TF","JP"].forEach(function(d,i){var c=base[i];dims[d]={side:c,score:c===(d==="EI"?"E":d==="SN"?"S":d==="TF"?"T":"J")?68:52}});
  dims.AT={side:ident==="A"?"A":"T",score:ident==="A"?72:58};
  return buildFromDims(dims,opts);
}

// ====== V2 CANVAS RENDERER ======

function drawPortraitV2(canvas,vi){
  if(!canvas||!vi)return;
  var w=canvas.width,h=canvas.height,size=Math.min(w,h);
  var pal=vi.palette||["#DDEEE6","#E8E3F4","#2F8F72","#6F5FA8"];
  var den=C(vi.dotDensity||.62),noi=C(vi.noise||.25),glw=C(vi.glow||.35);
  var frag=C(vi.fragmentation||.18),sym=C(vi.symmetry||.55),soft=C(vi.softness||.68);
  var spd=C(vi.spread||.5),wrm=C(vi.warmth||.5),stc=C(vi.structure||.5),stb=C(vi.stability||.5);
  var sb=stb;
  var cl=C(vi.clarity||.5);
  var hs=vi.hairStyle||"soft-medium",es=vi.eyeStyle||"calm";

  // Offscreen canvas for silhouette
  var oc=document.createElement("canvas");oc.width=size;oc.height=size;
  var ox=oc.getContext("2d");ox.clearRect(0,0,size,size);

  var cx=size*.5,cy=size*.44;

  // ---- Shoulders ----
  var shW=size*(.62+spd*.08),shH=size*(.24+spd*.04);
  ox.beginPath();
  ox.moveTo(cx-shW*.9,cy+size*.22);
  ox.quadraticCurveTo(cx-shW*1.05,cy+size*.18,cx-shW,cy+size*.34);
  ox.quadraticCurveTo(cx,cy+size*.44,cx+shW,cy+size*.34);
  ox.quadraticCurveTo(cx+shW*1.05,cy+size*.18,cx+shW*.9,cy+size*.22);
  ox.fillStyle=pal[2]+"66";ox.fill();

  // ---- Neck ----
  var nW=size*.1;
  ox.beginPath();ox.rect(cx-nW,cy+size*.18,cx+nW-(cx-nW),size*.1);
  ox.fillStyle=pal[0]+"AA";ox.fill();

  // ---- Face ----
  var fw=L(stc,size*.22,size*.28)+spd*size*.01;
  var fh=L(stc,size*.26,size*.32)+(1-sym)*size*.01;
  var chinTaper=1+(1-stc)*.4;
  ox.beginPath();
  var steps=30;
  for(var i=0;i<=steps;i++){
    var t=i/steps,a=t*Math.PI*2;
    var dx=Math.cos(a)*fw,dy=Math.sin(a)*fh;
    if(dy>0)dx*=chinTaper;
    var px=cx+dx,py=cy+dy;
    if(i===0)ox.moveTo(px,py);else ox.lineTo(px,py);
  }
  ox.closePath();
  var skinLight=pal[0]||"#DDEEE6";ox.fillStyle=skinLight+"CC";ox.fill();

  // ---- Hair ----
  function drawHair(style){
    ox.save();ox.beginPath();
    var hh=size*(.24+(1-stc)*.04+(1-sb)*.02),hw=size*(.24+spd*.02+(1-sb)*.02);
    var topY=cy-hh,botY=cy+fh*.85;
    if(style==="short-sharp"){
      // Angular, close-cropped
      ox.moveTo(cx,cy-hh*1.1);
      ox.lineTo(cx+hw*.6,cy-hh*.8);ox.lineTo(cx+hw*.8,cy-hh*.5);
      ox.lineTo(cx+hw*.95,cy);ox.lineTo(cx+hw*.9,cy+fh*.65);
      ox.lineTo(cx+hw*.6,cy+fh*.82);ox.lineTo(cx+hw*.2,cy+fh*.88);
      ox.lineTo(cx-hw*.2,cy+fh*.88);ox.lineTo(cx-hw*.6,cy+fh*.82);
      ox.lineTo(cx-hw*.9,cy+fh*.65);ox.lineTo(cx-hw*.95,cy);
      ox.lineTo(cx-hw*.8,cy-hh*.5);ox.lineTo(cx-hw*.6,cy-hh*.8);
      ox.closePath();
      // Bangs
      ox.moveTo(cx-hw*.3,cy-hh*.6);
      ox.lineTo(cx-hw*.2,cy-hh*.1);ox.lineTo(cx,cy-hh*.25);
      ox.lineTo(cx+hw*.15,cy-hh*.12);ox.lineTo(cx+hw*.25,cy-hh*.55);
    }else if(style==="soft-medium"){
      // Medium length, soft curves
      ox.moveTo(cx,cy-hh*1.15);
      ox.bezierCurveTo(cx+hw*.5,cy-hh*1.2,cx+hw*1.05,cy-hh*.4,cx+hw*1.02,cy+fh*.5);
      ox.quadraticCurveTo(cx+hw*1.0,cy+fh*.8,cx+hw*.7,cy+fh*.92);
      ox.quadraticCurveTo(cx+hw*.3,cy+fh*1.0,cx,cy+fh*.95);
      ox.quadraticCurveTo(cx-hw*.3,cy+fh*1.0,cx-hw*.7,cy+fh*.92);
      ox.quadraticCurveTo(cx-hw*1.0,cy+fh*.8,cx-hw*1.02,cy+fh*.5);
      ox.bezierCurveTo(cx-hw*1.05,cy-hh*.4,cx-hw*.5,cy-hh*1.2,cx,cy-hh*1.15);
      ox.closePath();
      // Side strands
      ox.moveTo(cx+hw*.92,cy+fh*.1);
      ox.quadraticCurveTo(cx+hw*1.08,cy+fh*.4,cx+hw*1.04,cy+fh*.6);
      ox.moveTo(cx-hw*.92,cy+fh*.1);
      ox.quadraticCurveTo(cx-hw*1.08,cy+fh*.4,cx-hw*1.04,cy+fh*.6);
    }else if(style==="straight-quiet"){
      // Clean straight hair
      ox.moveTo(cx,cy-hh*.95);
      ox.lineTo(cx+hw*.7,cy-hh*.9);ox.lineTo(cx+hw*.92,cy-hh*.4);
      ox.lineTo(cx+hw*.96,cy+fh*.3);ox.lineTo(cx+hw*.85,cy+fh*.75);
      ox.lineTo(cx+hw*.5,cy+fh*.9);ox.lineTo(cx,cy+fh*.85);
      ox.lineTo(cx-hw*.5,cy+fh*.9);ox.lineTo(cx-hw*.85,cy+fh*.75);
      ox.lineTo(cx-hw*.96,cy+fh*.3);ox.lineTo(cx-hw*.92,cy-hh*.4);
      ox.lineTo(cx-hw*.7,cy-hh*.9);
      ox.closePath();
      // Even bangs
      ox.moveTo(cx-hw*.5,cy-hh*.5);
      ox.lineTo(cx-hw*.35,cy-hh*.15);ox.lineTo(cx,cy-hh*.2);
      ox.lineTo(cx+hw*.3,cy-hh*.12);ox.lineTo(cx+hw*.45,cy-hh*.45);
    }else if(style==="messy-open"){
      // Wild outward
      ox.moveTo(cx,cy-hh*1.25);
      ox.bezierCurveTo(cx+hw*.6,cy-hh*1.3,cx+hw*1.15,cy-hh*.6,cx+hw*1.12,cy+fh*.4);
      ox.quadraticCurveTo(cx+hw*1.1,cy+fh*.7,cx+hw*.8,cy+fh*.9);
      ox.quadraticCurveTo(cx+hw*.4,cy+fh*1.0,cx,cy+fh*.92);
      ox.quadraticCurveTo(cx-hw*.4,cy+fh*1.0,cx-hw*.8,cy+fh*.9);
      ox.quadraticCurveTo(cx-hw*1.1,cy+fh*.7,cx-hw*1.12,cy+fh*.4);
      ox.bezierCurveTo(cx-hw*1.15,cy-hh*.6,cx-hw*.6,cy-hh*1.3,cx,cy-hh*1.25);
      ox.closePath();
      // Messy strands
      for(var si=0;si<6;si++){
        var sa=si/6*Math.PI*2,sr=.7+Math.random()*.3;
        var ssx=cx+Math.cos(sa)*hw*.4*sr,ssy=cy-hh*.5+Math.sin(sa)*hh*.3*sr;
        ox.moveTo(ssx,ssy);
        ox.quadraticCurveTo(ssx+Math.cos(sa)*hw*.3,ssy-Math.sin(sa)*hh*.2,ssx+Math.cos(sa)*hw*.4,ssy-Math.sin(sa)*hh*.1);
      }
    }else if(style==="halo-fragment"){
      // Ethereal, fragmented
      ox.moveTo(cx,cy-hh*1.3);
      ox.bezierCurveTo(cx+hw*.7,cy-hh*1.4,cx+hw*1.1,cy-hh*.7,cx+hw*1.08,cy+fh*.3);
      ox.quadraticCurveTo(cx+hw*1.06,cy+fh*.6,cx+hw*.75,cy+fh*.85);
      ox.quadraticCurveTo(cx+hw*.35,cy+fh*.95,cx,cy+fh*.88);
      ox.quadraticCurveTo(cx-hw*.35,cy+fh*.95,cx-hw*.75,cy+fh*.85);
      ox.quadraticCurveTo(cx-hw*1.06,cy+fh*.6,cx-hw*1.08,cy+fh*.3);
      ox.bezierCurveTo(cx-hw*1.1,cy-hh*.7,cx-hw*.7,cy-hh*1.4,cx,cy-hh*1.3);
      ox.closePath();
    }
    var hairCol=pal[2]||"#3d3a35";
    ox.fillStyle=wrm>.5?hairCol+"EE":pal[3]+"EE";ox.fill();
    ox.restore();
  }
  drawHair(hs);

  // ---- Eyes ----
  function drawEye(ex,ey,style){
    var eOpen=C(spd*.6+.3+cl*.2); // E = more open
    var eSharp=1-C(wrm*.6+.2); // T = sharper
    var eW=size*L(eSharp,.03,.055),eH=size*(.018+eOpen*.025);
    // Upper lid
    ox.beginPath();
    ox.ellipse(cx+ex,cy+ey,eW,eH,0,0,Math.PI*2);
    ox.fillStyle=pal[3]||"#24231f";
    ox.globalAlpha=1;ox.fill();
    // Iris
    var irisR=eW*.5;
    ox.beginPath();ox.arc(cx+ex,cy+ey+size*.002,irisR,0,Math.PI*2);
    ox.fillStyle="#3d3a35";ox.globalAlpha=.85;ox.fill();
    // Iris color hint
    ox.beginPath();ox.arc(cx+ex,cy+ey+size*.002,irisR*.6,0,Math.PI*2);
    ox.fillStyle=wrm>.5?pal[0]:pal[1];ox.globalAlpha=.35;ox.fill();
    // Highlight 1 (main)
    ox.beginPath();ox.arc(cx+ex+eW*.2,cy+ey-eH*.4,irisR*.32,0,Math.PI*2);
    ox.fillStyle="rgba(255,255,255,"+(.7+glw*.2)+")";ox.fill();
    // Highlight 2 (secondary)
    ox.beginPath();ox.arc(cx+ex-eW*.2,cy+ey+eH*.2,irisR*.18,0,Math.PI*2);
    ox.fillStyle="rgba(255,255,255,"+(.5+glw*.15)+")";ox.fill();
    // Upper lid line
    ox.globalAlpha=1;
    ox.beginPath();ox.ellipse(cx+ex,cy+ey-eH*.15,eW*1.05,eH*.35,0,Math.PI,0);
    ox.strokeStyle=pal[2]||"#24231f";ox.lineWidth=1.5+eSharp;ox.stroke();
    // Lower lash hint
    ox.beginPath();ox.ellipse(cx+ex,cy+ey+eH*.2,eW*.6,eH*.12,0,0,Math.PI);
    ox.strokeStyle=pal[2]+"88";ox.lineWidth=.8;ox.stroke();
  }
  var eyeSp=size*L(sym,.085,.115);
  var eyeY=size*.42;
  drawEye(-eyeSp,eyeY,es);
  drawEye(eyeSp,eyeY,es);

  // ---- Eyebrows ----
  var bw=size*.08,bh=size*.012;
  [[-eyeSp,eyeY-size*.035],[eyeSp,eyeY-size*.035]].forEach(function(b){
    ox.beginPath();
    ox.ellipse(cx+b[0],cy+b[1],bw+(1-sb)*size*.01,bh,0,0,Math.PI);
    ox.strokeStyle=pal[2]+"AA";ox.lineWidth=1.5;ox.stroke();
  });

  // ---- Mouth ----
  var mW=size*(.04+(1-stc)*.01),mH=size*(.008+wrm*.006);
  ox.beginPath();ox.ellipse(cx,cy+size*.22,mW,mH,0,0,Math.PI);
  ox.strokeStyle=pal[3]+"99";ox.lineWidth=1.2;ox.stroke();

  // ---- Blush / cheek shadow ----
  [[-.12,.08],[.12,.08]].forEach(function(ch){
    ox.beginPath();
    ox.arc(cx+ch[0]*size,cy+ch[1]*size,size*.05+wrm*size*.02,0,Math.PI*2);
    ox.fillStyle=(wrm>.5?pal[2]:pal[3])+"18";
    ox.fill();
  });

  // ====== DOT SAMPLING ======
  var ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle=pal[1]+"44";
  ctx.fillRect(0,0,w,h);

  // Glow behind character
  var gg=ctx.createRadialGradient(cx,cy,0,cx,cy,size*(.3+glw*.15));
  gg.addColorStop(0,"rgba(255,255,255,"+(.35+glw*.3)+")");
  gg.addColorStop(1,"transparent");
  ctx.fillStyle=gg;ctx.fillRect(0,0,w,h);

  // Outer field (E: larger spread)
  var og=ctx.createRadialGradient(cx,cy,size*.1,cx,cy,size*(.35+spd*.2));
  og.addColorStop(0,pal[0]+"22");og.addColorStop(1,"transparent");
  ctx.fillStyle=og;ctx.fillRect(0,0,w,h);

  // Sample dots from offscreen canvas
  var grid=64,cell=size/grid;
  for(var gy=0;gy<grid;gy++){
    for(var gx=0;gx<grid;gx++){
      var nx=(gx+.5)/grid,ny=(gy+.5)/grid;
      var px=nx*size,py=ny*size;
      // Sample offscreen pixel
      var sd=ox.getImageData(Math.round(px),Math.round(py),1,1).data;
      if(sd[3]<5)continue; // transparent
      var keep=den+(.5-Math.random())*noi*.5;
      if(keep<.08+noi*.15)continue;
      // Dot radius from sampled alpha
      var alpha=sd[3]/255;
      var r=Math.max(.5,1.2+alpha*2.2*(.6+soft*.4));
      ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);
      var col="rgb("+sd[0]+","+sd[1]+","+sd[2]+")";
      ctx.fillStyle=col;
      ctx.globalAlpha=Math.min(.85,.1+alpha*.7);
      ctx.fill();
    }
  }

  // ---- Edge fragmentation ----
  if(frag>.04){
    var ft=ox.getImageData(0,0,size,size);
    for(var fi=0;fi<Math.floor(16+frag*50);fi++){
      var fx=Math.floor(Math.random()*size),fy=Math.floor(Math.random()*size);
      var fi2=(fy*size+fx)*4;
      if(ft.data[fi2+3]<20||ft.data[fi2+3]>200)continue; // only edge pixels
      var fr=.5+Math.random()*frag*3.5;
      ctx.beginPath();ctx.arc(fx,fy,fr,0,Math.PI*2);
      ctx.fillStyle="rgb("+ft.data[fi2]+","+ft.data[fi2+1]+","+ft.data[fi2+2]+")";
      ctx.globalAlpha=frag*(.15+.25*Math.random());
      ctx.fill();
    }
  }

  ctx.globalAlpha=1;

  // ---- Motif / type glyph hint ----
  if(vi.typeCode&&vi.typeCode!=="----"){
    ctx.font="bold 14px sans-serif";ctx.textAlign="center";
    ctx.fillStyle="rgba(255,255,255,"+(.18+glw*.12)+")";
    ctx.fillText(vi.typeCode,cx,cy+size*.36);
  }
}

// ====== V1 COMPATIBILITY ======
function drawPortrait(canvas,vi){drawPortraitV2(canvas,vi)}
function exportPNG(canvas){
  if(!canvas)return;var a=document.createElement("a");a.href=canvas.toDataURL("image/png");
  a.download="persona-portrait.png";a.click();
}

// ====== EXPORT ======
window.PersonaPortraitRenderer={
  dimToParams:dimToParams,buildVI:buildVI,buildFromDims:buildFromDims,buildFromTypeCode:buildFromTypeCode,
  drawPortrait:drawPortrait,drawPortraitV2:drawPortraitV2,
  exportPNG:exportPNG,DIMS:DIMS
};
})();
