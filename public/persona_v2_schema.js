(function(){
  const DIMENSIONS = ["EI", "SN", "TF", "JP", "AT"];

  const defaultPreset = {
    typeCode: "ENFP-A",
    palette: ["#DDEEE6", "#E8E3F4", "#2F8F72", "#6F5FA8"],
    motifs: ["mirror", "signal", "field"],
    temperament: "warm exploratory",
    dotMatrixParams: { baseDensity: 0.64, contrast: 0.58, softness: 0.74 },
    animeInspiredParams: { silhouetteType: "soft-forward", eyeEnergy: 0.66, posture: "leaning toward signal" },
    backgroundFieldParams: { drift: 0.26, refraction: 0.38 },
    iconography: ["lens", "ray", "field"],
    resultCardLayoutHints: { emphasis: "portrait-first" }
  };

  function nowIso(){
    return new Date().toISOString();
  }

  function clamp01(value){
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  function dimensionFromDetail(dim, detail){
    const side = detail?.dominant || dim.slice(0, 1);
    const score = Number(detail?.dom_pct || 50);
    return {
      side,
      score,
      confidence: clamp01(Math.abs(score - 50) / 50),
      source: "scale"
    };
  }

  function buildDeterministicResult(traditional, sessionId){
    const details = traditional?.details || {};
    const type = traditional?.type || "ENFP";
    const identity = traditional?.identity || "A";
    const dimensions = {};
    const uncertainDimensions = [];
    DIMENSIONS.forEach(dim => {
      dimensions[dim] = dimensionFromDetail(dim, details[dim]);
      if (dimensions[dim].score < 62) uncertainDimensions.push(dim);
    });
    return {
      sessionId: sessionId || null,
      typeCode: `${type}-${identity}`,
      dimensions,
      uncertainty: {
        uncertainDimensions,
        conflictDimensions: []
      },
      labels: {
        family: traditional?.family || "",
        shortName: traditional?.nickname || ""
      },
      computedAt: nowIso()
    };
  }

  function familyFromType(typeCode){
    var fams={分析家:['INTJ','INTP','ENTJ','ENTP'],外交家:['INFJ','INFP','ENFJ','ENFP'],守卫者:['ISTJ','ISFJ','ESTJ','ESFJ'],探险家:['ISTP','ISFP','ESTP','ESFP']};
    var base=(typeCode||'').split('-')[0];
    for(var k in fams)if(fams[k].indexOf(base)>=0)return k;
    return '分析家';
  }

  function buildMockAnalysisPack(typeCode){
    var family=familyFromType(typeCode);
    var toneMap={
      '外交家':{tone:'warm reflective',keywords:['soft field','open signal','connection'],conflict:'在渴望被理解和害怕过度暴露之间犹豫',inner:'你倾向于先通过关系温度理解处境，再回头核对是否与自己的价值一致'},
      '分析家':{tone:'sharp calm',keywords:['precision field','clear line','signal structure'],conflict:'思维走得比情绪快，容易忽略直觉信号',inner:'你习惯用逻辑框架整理一切，但有些判断需要的不是更多信息，而是信任身体的信号'},
      '守卫者':{tone:'steady grounded',keywords:['stable field','solid root','quiet trust'],conflict:'在秩序与变化之间寻找平衡点时容易自我质疑',inner:'你为周围构建稳定感的方式是默默承担责任，但很少检查自己是否也需要被承接'},
      '探险家':{tone:'fluid alert',keywords:['moving field','reflex','practical pulse'],conflict:'追逐新鲜感的同时害怕错过真正重要的东西',inner:'你擅长在行动中快速读取环境，但停下来整理内在声音反而比动手更难'}
    };
    var t=toneMap[family]||toneMap['分析家'];
    var ident=(typeCode||'').indexOf('A')>=0?'A':'T';
    var isA=ident==='A';
    var whisper=isA?'表面上你显得坚定清晰，但真正驱动你的往往是那些没有被说出口的直觉和关系温度。':'你对自己的判断常常持有保留态度，这种不确信不是弱点，而是对复杂性的尊重。';
    return {
      whisper:'给 '+(typeCode||'----')+' 的你：'+whisper,
      portrait:['你给人的感觉更像是一',['片移动的光场','段有待解读的频率','种安静的在场','个不断调整焦点的镜头'][{分析家:1,外交家:0,守卫者:2,探险家:3}[family]||0]+'——轮廓清晰，但内容永远比第一眼看到的要复杂。'][0],
      coreConflict:t.conflict,
      innerPattern:t.inner,
      blindSpot:'你为自己建立了顺畅的解释系统，但这个系统也可能把陌生的情绪排除在外。',
      growthVector:'练习在行动之前停顿片刻，问自己：这个选择是我的意愿，还是对环境的惯性回应。',
      evidence:[
        {label:'认知信号',quoteOrSignal:'分析速度快于情绪识别',interpretation:'你的判断先经过思维而非感受过滤。'},
        {label:'关系信号',quoteOrSignal:isA?'倾向于主动组织关系':'在关系中倾向于观察后再参与',interpretation:'社交对你来说不是本能而是可管理的策略。'},
        {label:'压力信号',quoteOrSignal:isA?'外部期待不太容易打乱你的节奏':'他人的反馈对你的状态有明显影响',interpretation:isA?'身份稳定感主要来自内部确认。':'身份感和外界回应有一定联动。'}
      ],
      visualKeywords:t.keywords,
      personaTone:t.tone,
      imagePromptSeed:'liquid mirror portrait, dot matrix, '+t.keywords.join(' ')+', calm atmosphere'
    };
  }

  function buildPersonaVisualInstance(deterministicResult, aiPack, preset){
    const p = preset || defaultPreset;
    const dims = deterministicResult?.dimensions || {};
    const avgConfidence = DIMENSIONS.reduce((sum, dim) => sum + clamp01(dims[dim]?.confidence || 0), 0) / DIMENSIONS.length;
    const openness = clamp01((dims.SN?.side === "N" ? dims.SN.score : 100 - (dims.SN?.score || 50)) / 100);
    const softness = clamp01(0.52 + ((dims.TF?.side === "F" ? dims.TF.score : 100 - (dims.TF?.score || 50)) - 50) / 130);
    return {
      sessionId: deterministicResult?.sessionId || null,
      typeCode: deterministicResult?.typeCode || p.typeCode,
      palette: p.palette,
      dotDensity: clamp01((p.dotMatrixParams.baseDensity || 0.62) + avgConfidence * 0.14),
      noise: clamp01(0.18 + (1 - avgConfidence) * 0.22),
      glow: clamp01(0.24 + openness * 0.22),
      fragmentation: clamp01(0.12 + (deterministicResult?.uncertainty?.uncertainDimensions?.length || 0) * 0.055),
      symmetry: clamp01(0.48 + avgConfidence * 0.28),
      softness,
      motionLevel: clamp01(p.backgroundFieldParams.drift || 0.22),
      silhouetteType: p.animeInspiredParams.silhouetteType,
      motifs: [...new Set([...(p.motifs || []), ...((aiPack?.visualKeywords || []).slice(0, 3))])],
      caption: aiPack?.coreConflict || "signals forming a mirrored persona field"
    };
  }

  function validateAIAnalysisPack(pack){
    const required = ["whisper", "portrait", "coreConflict", "innerPattern", "blindSpot", "growthVector"];
    const missing = required.filter(key => typeof pack?.[key] !== "string" || !pack[key].trim());
    if (!Array.isArray(pack?.evidence) || !pack.evidence.length) missing.push("evidence");
    if (!Array.isArray(pack?.visualKeywords) || !pack.visualKeywords.length) missing.push("visualKeywords");
    return { ok: missing.length === 0, missing };
  }

  window.PersonaV2Schemas = {
    DIMENSIONS,
    defaultPreset,
    buildDeterministicResult,
    buildMockAnalysisPack,
    buildPersonaVisualInstance,
    validateAIAnalysisPack
  };
})();
