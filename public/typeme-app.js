(function () {
  "use strict";

  const families = {
    analysts: { label: "分析家", types: ["INTJ", "INTP", "ENTJ", "ENTP"] },
    diplomats: { label: "外交家", types: ["INFJ", "INFP", "ENFJ", "ENFP"] },
    sentinels: { label: "守卫者", types: ["ISTJ", "ISFJ", "ESTJ", "ESFJ"] },
    explorers: { label: "探索家", types: ["ISTP", "ISFP", "ESTP", "ESFP"] },
  };

  const familyNotes = {
    analysts: { tone: "结构 / 远景 / 推演", copy: "更容易先看系统、策略和长期代价。卡片里的角色槽未来适合偏冷静、锋利、几何感的资产。" },
    diplomats: { tone: "关系 / 意义 / 感受", copy: "更容易从人的需要、价值和氛围里理解选择。角色资产可以更柔和、流动、带一点情绪光。" },
    sentinels: { tone: "秩序 / 责任 / 稳定", copy: "更在意可靠性、承诺和生活结构。未来资产适合稳定、清晰、有日常守护感的形象。" },
    explorers: { tone: "行动 / 体验 / 现场", copy: "更相信现场判断、身体感和即时反馈。角色资产可以更轻快、机动、带一点工具感。" },
  };

  const axisWords = {
    E: "外向能量", I: "内向能量",
    S: "现实感知", N: "直觉联想",
    T: "逻辑决策", F: "价值决策",
    J: "计划推进", P: "开放应变",
  };

  let activeFamily = "all";
  let typeMeQuestions = null;
  const typeThemeClasses = ["typeme-theme-analysts", "typeme-theme-diplomats", "typeme-theme-sentinels", "typeme-theme-explorers"];
  const TYPEME_LOCALE_KEY = "typeme_locale";
  const TYPEME_LOCALES = new Set(["zh-CN", "en"]);
  let typeMeLocale = (() => {
    try {
      const saved = localStorage.getItem(TYPEME_LOCALE_KEY);
      return TYPEME_LOCALES.has(saved) ? saved : "zh-CN";
    } catch {
      return "zh-CN";
    }
  })();
  let typeMeCurrentRoute = "home";

  const uiText = {
    "zh-CN": {
      navHome: "首页",
      navGuide: "说明",
      navLibrary: "类型库",
      langCurrent: "简体中文",
      brandSubtitle: "MBTI 人格测试",
      homeAria: "TypeMe 首页",
      navAria: "TypeMe 导航",
      pageTitle: "TypeMe 人格测试",
      homeKicker: "TypeMe · MBTI 人格测试",
      homeTitle: "找到更接近你的 16 型人格画像。",
      homeLead: "先回答一组量表题，再写几道贴近生活的开放题。TypeMe 会结合你的选择和真实经历，给出更贴近你的测试结果。",
      startTest: "开始测试",
      browseTypes: "浏览类型库",
      readGuide: "了解说明",
      processScale: "50 道量表题",
      processPrompt: "5 道开放题",
      processCheck: "结合回答分析",
      processProfile: "完整结果",
      summaryCoordinateKicker: "维度",
      summaryEvidenceKicker: "证据",
      summaryProfileKicker: "结果",
      summaryCoordinateTitle: "查看五个维度",
      summaryCoordinateCopy: "E/I、S/N、T/F、J/P、A/T 都会留下百分比，不急着把你压成四个字母。",
      summaryEvidenceTitle: "看具体场景",
      summaryEvidenceCopy: "开放题会追问压力、关系和选择。很多误判，都是在这些地方露出来的。",
      summaryProfileTitle: "得到完整结果",
      summaryProfileCopy: "你会看到最接近的类型、相邻可能，以及这些判断来自哪些回答。",
      guideKicker: "说明",
      guideTitle: "测试前，你可以先知道这些。",
      guideLead: "TypeMe 是一个 16 型人格测试工具，不是临床诊断。它先用量表建立初始坐标，再用开放题补充真实场景里的选择、犹豫和压力反应。",
      guideAsideTitle: "你会得到什么",
      guideAsideStrong: "最接近的类型 · 维度比例 · 回答依据 · 后续建议",
      guideAsideCopy: "结果会给出一个明确的类型，同时保留那些接近边界的可能性。",
      guideCards: [
        ["01", "先做量表", "50 道题负责建立初始类型坐标。它看的是倾向的相对强弱，不是给你打分。"],
        ["02", "再写开放题", "开放题会落在更具体的生活场景里：压力、关系、冲突、临时变化和自我评价。"],
        ["03", "看接近度", "百分比表示当前资料对某个类型的接近程度。候选比例接近时，说明某些维度还没有明显拉开。"],
        ["04", "查看完整结果", "最终结果会告诉你最接近的类型、相邻可能和回答中透露出的个人特点。"],
      ],
      guideNotes: [
        ["怎么读结果", "先看类型落点，再看哪些维度接近中线。越接近中线，越适合回到开放题里看真实场景。"],
        ["隐私与样本", "答题内容默认保存在本机。只有你主动点击“提交样本（匿名）”时，才会用于帮助改进。"],
        ["什么时候重测", "生活阶段、压力来源或关系模式明显变化后，再测一次通常比连续刷题更有意义。"],
      ],
      dimsTitle: "五个维度",
      libraryKicker: "类型库",
      libraryTitle: "浏览 TypeMe 使用的 16 种人格类型。",
      libraryLead: "这里用于快速了解每种类型的倾向、家族、关键词和基础描述。正式测试结果会叠加 A/T 身份维度、接近度和开放题证据。",
      filterAll: "全部",
      typesCount: (count) => `${count} 个类型`,
      typeLandingTitle: "最接近的类型",
      typeLandingCopy: (full) => `你的类型气质更接近 ${full}。百分比表示当前资料对该类型的接近程度；如果下方出现比例相近的候选落点，说明某些维度还没有明显拉开，结果会把这些临近可能一起保留下来。`,
      coordinatesTitle: "维度比例",
      coordinatesCopyVerified: "量表给出初始比例，开放题负责观察其中的吻合与张力。",
      coordinatesCopyFallback: "这里保留量表结果。开放题分析未完成，因此暂不显示进一步解读。",
      restoredCopy: "这是本机保存的上次结果。",
      navCoordinates: "坐标",
      navEvidence: "证据",
      navStatus: "状态",
      navAfterword: "悄悄话",
      afterwordLabel: "写在最后",
      afterwordTitle: (type) => `给 ${type} 型的你的悄悄话`,
      navTop: "顶部",
      credibilityTitle: "结果可信度",
      credibilityReviewed: "开放题已纳入分析",
      credibilityFallback: "开放题分析未完成，仅展示量表结果",
      credibilitySignal: "回答信息量",
      credibilityValid: (valid, total) => `${valid}/${total} 道回答信息充足`,
      credibilityFlags: "回答中包含",
      qualityFlagLabels: {
        scene: "具体场景",
        cause: "因果",
        choice: "选择",
        emotion: "情绪",
        time: "时间线",
        sentence: "完整句子",
        repeated_pattern: "重复模式",
        long_repeat: "长重复",
        character_dominance: "字符单一",
        single_token_text: "单词块",
      },
      exportReport: "导出报告",
      backInitial: "返回初步结果",
      submitSample: "提交样本（匿名）",
      improve: "帮助改进",
      continueAnalysis: "继续完善结果",
      retryAnalysis: "重新分析",
      returnOpen: "返回补写开放题",
      restart: "重新测试",
      reference16p: "参考 16Personalities",
      ok: "确定",
      cancel: "取消",
      testLabel: "量表测试",
      pageProgress: (page, total) => `第 ${page}/${total} 页`,
      answeredProgress: (answered, total) => `已答 ${answered}/${total}`,
      previousPage: "上一页",
      nextPage: "下一页",
      viewResult: "查看结果",
      pageComplete: "本页已完成",
      pageIncomplete: "请完成本页所有题目",
      agree: "同意",
      disagree: "不同意",
      initialCoordinate: "初步结果",
      bridgeCopy: "量表已经完成。再回答 5 道贴近生活的问题，可以帮助 TypeMe 看清那些容易摇摆或被误判的部分。",
      continueDeepAnalysisTitle: "继续完善结果",
      continueDeepAnalysisCopy: "结合你的真实经历，得到更具体的解读和建议",
      traditionalOnlyTitle: "直接看传统结果",
      traditionalOnlyCopy: "只查看量表分布、类型速览和基础建议",
      reviseAnswersTitle: "返回修改答案",
      reviseAnswersCopy: "回到最后一页检查你的选择",
      openAnalysis: "开放题",
      interview: (n) => `第 ${n} 题`,
      openAnswerAria: "开放题回答",
      previousPrompt: "上一题",
      nextPrompt: "下一题",
      submitAnalysis: "提交分析",
      openSkippable: "开放题可跳过，但至少 2 题更可靠",
      qualityHigh: "细节充足，这段回答很有参考价值。",
      qualityMedium: "还不错，再补一个具体场景会更准。",
      qualityLow: "信息偏少，建议写发生了什么、你怎么想、最后怎么选。",
      qualityEmpty: "先写下真实场景，越具体越有价值。",
      scaleLoadingTitle: "正在整理量表结果",
      scaleLoadingCopy: "正在整理维度分布和接下来的开放题。",
      aiLoadingTitle: "正在分析你的回答",
      aiLoadingCopy: "这通常需要一点时间。请先留在本页，已填写的内容会保存在本机。",
      restoreLoadingTitle: "正在恢复 TypeMe 结果",
      restoreLoadingCopy: "正在读取本地结果，不会重新提交答案。",
      questionLoadTitle: "无法加载题库",
      questionLoadCopyFile: "题目暂时没有加载出来。请从 TypeMe 网站进入，或稍后刷新重试。",
      questionLoadCopyServer: "题目暂时没有加载出来，请检查网络后重试。",
      modalTitle: "提示",
      noFinalResultTitle: "没有可恢复的最终结果",
      noFinalResultCopyScale: "目前只保存了量表结果。完成开放题后，才能查看完整结果。",
      noFinalResultCopyEmpty: "还没有找到可恢复的最终结果。需要先完成量表，再填写开放题生成结果。",
      goOpenPrompts: "去开放题",
      openMinimumCopy: "至少认真回答 2 道开放题，分析结果才更有参考价值。仍要继续吗？",
      continueSubmit: "继续提交",
      openQualityGateTitle: "开放题信息还不够",
      openQualityGateCopy: "请至少补充 2 道有具体场景的回答：发生了什么、你当时怎么想、最后怎么选。重复、乱码或过于笼统的内容无法帮助判断。",
      qualityNeedScene: "具体场景",
      qualityNeedCause: "前因后果",
      qualityNeedChoice: "选择过程",
      qualityNeedEmotion: "情绪或压力信号",
      qualityMissingSummary: "目前更需要补充：",
      submitFailed: (message) => `提交失败：${message}`,
      scoreFailedTitle: "量表结果暂未生成",
      scoreFailedCopy: "50 道答案仍完整保留在本页。请检查网络后重新提交，不需要重新作答。",
      retryScore: "重新提交量表",
      missingQuestions: (count) => `还有 ${count} 题未完成。`,
      aiUnavailableTitle: "开放题暂未完成分析",
      aiUnavailableCopy: "本次没有得到完整分析，因此这里只展示量表结果。你的回答仍保存在本机，稍后可以直接重试。",
      aiFallbackInsight: "分析服务暂时不可用，以下内容仅根据量表结果生成。你可以稍后重新提交开放题。",
      aiFallbackSummary: "量表结果已经生成，开放题分析暂未完成。",
      retryOpen: "重新提交开放题",
      resumeFinished: "检测到上次完成的 TypeMe 结果",
      resumeProgress: (answered) => `检测到未完成测试：${answered}/50`,
      resumeScale: (answered, total, page) => `未完成量表：${answered}/${total}，继续第 ${page} 页`,
      resumeScaleDone: "量表已完成，等待继续开放题",
      resumeOpenDraft: (answered, total) => `开放题草稿：已填写 ${answered}/${total}`,
      resumeFinal: "上次测试结果已保存在本机",
      resumeScaleCopy: "继续会回到保存的页码和当前题目。",
      resumeScaleDoneCopy: "继续会回到初步坐标，再选择是否进入开放题。",
      resumeOpenCopy: "继续会回到上次停下的开放题，草稿不会丢失。",
      resumeFinalCopy: "继续可直接查看上次结果，不会重新发起分析。",
      continue: "继续",
      discard: "丢弃",
      discardConfirm: "确定丢弃上次保存的答题进度吗？",
      restartConfirm: "开始新测试会清空当前进度，确定继续吗？",
      restartConfirmOk: "重新开始",
      unsupportedTitle: "暂不支持切换",
      unsupportedCopy: "这一部分内容由上一次生成结果保存而来，暂时不会自动翻译。切换语言后重新生成结果，可以得到对应语言的分析。",
      exportErrorTitle: "无法导出",
      printErrorTitle: "无法打印",
      printPopupBlocked: "浏览器拦截了打印窗口，请允许弹窗后重试。",
      sampleConsentTitle: "匿名提交这次样本？",
      sampleConsentCopy: "这会匿名保存本次量表答案、开放题回答和分析结果，用于改进题目和结果表达。不会保存姓名、邮箱、IP 地址或浏览器身份。",
      sampleConsentOk: "确认提交",
      sampleSaveFailed: "样本保存失败",
      sampleSavedTitle: "已保存",
      sampleSavedDb: "样本已匿名保存到数据库。",
      sampleSavedLocal: "样本已匿名保存到本地样本目录；数据库配置完成后可再同步。",
      sampleFailedTitle: "提交失败",
      savedLocalToast: "已保存到本机",
      savingStatus: "保存中",
      savedStatus: "已保存到本机",
      saveFailedStatus: "本次未保存",
      saveFailedToast: "浏览器未能保存进度，本次页面内仍可继续。",
      scaleSavedToast: "量表结果已保存",
      processing: "处理中",
      submittingAnalysis: "提交中",
      savingSample: "保存中",
      sampleSubmitted: "已提交",
      aiLoadingSavedCopy: "回答已保存到本机，正在生成结果。请先留在本页。",
      aiUnloadWarning: "结果仍在生成，离开会中断本次分析，但已填写内容会保存在本机。",
      aiCompleteToast: "分析完成",
      aiFallbackToast: "分析服务暂时不可用，已保留量表结果",
      localeChangedToast: "语言已切换",
      feedbackPrompt: "写下你遇到的问题、卡顿、看不懂的地方，或希望改进的体验。",
      feedbackBodyLabel: "反馈内容：",
      feedbackPageLabel: "页面信息：",
      feedbackTypeLabel: "类型：",
      feedbackTimeLabel: "时间：",
      feedbackBrowserLabel: "浏览器：",
      feedbackUnknown: "未知",
      feedbackSubject: "TypeMe 反馈",
      feedbackDoneTitle: "帮助改进",
      feedbackDoneCopy: "已尝试打开邮件反馈，同时也把反馈草稿复制到了剪贴板。",
      resultNavAria: "结果页目录",
      typeProfileMissing: "这份类型说明还没有写完。",
      readingNote: "阅读提示",
      scaleStart: "量表结果",
    },
    en: {
      navHome: "Home",
      navGuide: "Guide",
      navLibrary: "Type Library",
      langCurrent: "English",
      brandSubtitle: "MBTI TEST",
      homeAria: "TypeMe home",
      navAria: "TypeMe navigation",
      pageTitle: "TypeMe Personality Test",
      homeKicker: "TypeMe · MBTI Test",
      homeTitle: "Find the 16-type result that feels closer to you.",
      homeLead: "Answer a scale first, then a few questions about everyday life. TypeMe combines your choices and experiences into a clearer result.",
      startTest: "Start test",
      browseTypes: "Browse types",
      readGuide: "Read guide",
      processScale: "50 scale items",
      processPrompt: "5 open questions",
      processCheck: "Answer analysis",
      processProfile: "Full result",
      summaryCoordinateKicker: "Dimensions",
      summaryEvidenceKicker: "Evidence",
      summaryProfileKicker: "Result",
      summaryCoordinateTitle: "See all five dimensions",
      summaryCoordinateCopy: "E/I, S/N, T/F, J/P, and A/T stay visible as proportions instead of being flattened into four letters.",
      summaryEvidenceTitle: "Read real scenes",
      summaryEvidenceCopy: "Open questions look at pressure, relationships, and choices, where mistyped patterns often become clearer.",
      summaryProfileTitle: "Get the full result",
      summaryProfileCopy: "See your closest type, nearby possibilities, and which answers shaped the result.",
      guideKicker: "Guide",
      guideTitle: "Before the test, here is what to expect.",
      guideLead: "TypeMe is a 16-type personality assessment tool, not a clinical diagnosis. It starts with scale coordinates, then adds real-life choices, hesitation, and pressure responses through open questions.",
      guideAsideTitle: "What you get",
      guideAsideStrong: "Type landing · Dimension ratios · Answer evidence · Next steps",
      guideAsideCopy: "The result gives one clear landing while keeping nearby possibilities when the evidence is close.",
      guideCards: [
        ["01", "Start with the scale", "50 items establish an initial type coordinate. The scale reads relative tendency, not personal worth."],
        ["02", "Answer open questions", "These questions move into real situations: pressure, relationships, conflict, sudden change, and self-evaluation."],
        ["03", "Read closeness", "Percentages show how close the current evidence is to a type. Close candidates mean some dimensions are still near the border."],
        ["04", "Read the full result", "The final result brings together your closest type, nearby possibilities, answer evidence, and a personal closing note."],
      ],
      guideNotes: [
        ["How to read results", "Start with the type landing, then look at dimensions near the center. Borderline dimensions are best understood through open-answer evidence."],
        ["Privacy and samples", "Answers are stored locally by default. They help improve TypeMe only if you choose to submit an anonymous sample."],
        ["When to retest", "Retesting is more meaningful after a real shift in life stage, pressure source, or relationship pattern."],
      ],
      dimsTitle: "Five dimensions",
      libraryKicker: "Type Library",
      libraryTitle: "Browse the 16 types used by TypeMe.",
      libraryLead: "This page gives a quick read on each type’s family, keywords, and basic description. Test results also include A/T identity, closeness, and open-answer evidence.",
      filterAll: "All",
      typesCount: (count) => `${count} types`,
      typeLandingTitle: "Closest type",
      typeLandingCopy: (full) => `Your answers lean closest to ${full}. The percentage shows how close the current evidence is to this type; when nearby candidates are close, TypeMe keeps those possibilities visible instead of forcing a false certainty.`,
      coordinatesTitle: "Dimension scores",
      coordinatesCopyVerified: "The scale gives initial proportions, while open answers show where they match or create tension.",
      coordinatesCopyFallback: "Your scale result is kept here. Open-answer analysis was not completed, so further interpretation is not shown yet.",
      restoredCopy: "This is the last result saved on this device.",
      navCoordinates: "Dimensions",
      navEvidence: "Evidence",
      navStatus: "Status",
      navAfterword: "Afterword",
      afterwordLabel: "Afterword",
      afterwordTitle: (type) => `A note for you as ${type}`,
      navTop: "Top",
      credibilityTitle: "Result reliability",
      credibilityReviewed: "Open answers included in the result",
      credibilityFallback: "Open-answer analysis incomplete; showing the scale result",
      credibilitySignal: "Answer detail",
      credibilityValid: (valid, total) => `${valid}/${total} answers have enough detail`,
      credibilityFlags: "Your answers include",
      qualityFlagLabels: {
        scene: "Scene",
        cause: "Cause",
        choice: "Choice",
        emotion: "Emotion",
        time: "Timeline",
        sentence: "Complete sentence",
        repeated_pattern: "Repeated pattern",
        long_repeat: "Long repetition",
        character_dominance: "Low variety",
        single_token_text: "Single token",
      },
      exportReport: "Export report",
      backInitial: "Back to initial result",
      submitSample: "Submit sample",
      improve: "Help improve",
      continueAnalysis: "Continue analysis",
      retryAnalysis: "Try analysis again",
      returnOpen: "Edit open answers",
      restart: "Restart",
      reference16p: "Reference 16Personalities",
      ok: "OK",
      cancel: "Cancel",
      testLabel: "Scale test",
      pageProgress: (page, total) => `Page ${page}/${total}`,
      answeredProgress: (answered, total) => `Answered ${answered}/${total}`,
      previousPage: "Previous page",
      nextPage: "Next page",
      viewResult: "View result",
      pageComplete: "This page is complete",
      pageIncomplete: "Please answer every item on this page",
      agree: "Agree",
      disagree: "Disagree",
      initialCoordinate: "Initial result",
      bridgeCopy: "The scale is complete. Five questions about everyday situations can help TypeMe understand the parts that are close or easy to misread.",
      continueDeepAnalysisTitle: "Refine my result",
      continueDeepAnalysisCopy: "Add real experiences for a more specific reading and suggestions",
      traditionalOnlyTitle: "View scale result",
      traditionalOnlyCopy: "See only the scale distribution, type summary, and basic guidance",
      reviseAnswersTitle: "Revise scale answers",
      reviseAnswersCopy: "Return to the last page and check your choices",
      openAnalysis: "Open questions",
      interview: (n) => `Question ${n}`,
      openAnswerAria: "Open-answer response",
      previousPrompt: "Previous question",
      nextPrompt: "Next question",
      submitAnalysis: "Submit analysis",
      openSkippable: "Open questions can be skipped, but at least 2 answers make the result more reliable",
      qualityHigh: "Good detail. This answer adds useful context.",
      qualityMedium: "Good start. One concrete scene would make it clearer.",
      qualityLow: "A little thin. Add what happened, what you thought, and what you chose.",
      qualityEmpty: "Start with a real scene. Specific details matter most.",
      scaleLoadingTitle: "Preparing your scale result",
      scaleLoadingCopy: "Preparing your dimension ratios and open questions.",
      aiLoadingTitle: "Analyzing your answers",
      aiLoadingCopy: "This may take a moment. Please stay on this page; your answers are saved on this device.",
      restoreLoadingTitle: "Restoring TypeMe result",
      restoreLoadingCopy: "Reading the saved local result without resubmitting your answers.",
      questionLoadTitle: "Question bank unavailable",
      questionLoadCopyFile: "The questions did not load. Open the TypeMe website or refresh and try again later.",
      questionLoadCopyServer: "The questions did not load. Check your connection and try again.",
      modalTitle: "Notice",
      noFinalResultTitle: "No final result yet",
      noFinalResultCopyScale: "Only the scale result is saved. Complete the open questions to see the full result.",
      noFinalResultCopyEmpty: "No saved final result was found. Complete the scale and open questions first.",
      goOpenPrompts: "Go to open questions",
      openMinimumCopy: "The result is more useful with at least 2 thoughtful answers. Continue anyway?",
      continueSubmit: "Continue",
      openQualityGateTitle: "Open answers need more signal",
      openQualityGateCopy: "Please add at least 2 concrete answers: what happened, what you thought, and what you chose. Repeated, random, or vague text cannot support a useful result.",
      qualityNeedScene: "concrete scenes",
      qualityNeedCause: "cause and effect",
      qualityNeedChoice: "decision process",
      qualityNeedEmotion: "emotion or pressure signals",
      qualityMissingSummary: "The answers still need:",
      submitFailed: (message) => `Submit failed: ${message}`,
      scoreFailedTitle: "The scale result is not ready yet",
      scoreFailedCopy: "All 50 answers are still kept on this page. Check the connection and retry without answering again.",
      retryScore: "Retry scale submission",
      missingQuestions: (count) => `${count} items are still unanswered.`,
      aiUnavailableTitle: "Open answers were not analyzed",
      aiUnavailableCopy: "The full analysis did not finish, so this page only shows your scale result. Your answers are still saved on this device and you can try again later.",
      aiFallbackInsight: "Analysis is temporarily unavailable. The content below is based on your scale result only.",
      aiFallbackSummary: "Your scale result is ready, but the open-answer analysis did not finish.",
      retryOpen: "Try open answers again",
      resumeFinished: "A previous TypeMe result was found",
      resumeProgress: (answered) => `Unfinished test found: ${answered}/50`,
      resumeScale: (answered, total, page) => `Unfinished scale: ${answered}/${total}. Continue on page ${page}`,
      resumeScaleDone: "Scale complete; open questions are next",
      resumeOpenDraft: (answered, total) => `Open-answer draft: ${answered}/${total} completed`,
      resumeFinal: "Your last result is saved on this device",
      resumeScaleCopy: "Continue returns to the saved page and current question.",
      resumeScaleDoneCopy: "Continue returns to the initial result before the open questions.",
      resumeOpenCopy: "Continue returns to the saved open question without losing the draft.",
      resumeFinalCopy: "Continue opens the saved result without requesting analysis again.",
      continue: "Continue",
      discard: "Discard",
      discardConfirm: "Discard the previously saved progress?",
      restartConfirm: "Starting a new test will clear the current progress. Continue?",
      restartConfirmOk: "Restart",
      unsupportedTitle: "Language switch limited",
      unsupportedCopy: "This saved analysis was generated earlier and will not be machine-translated automatically. Regenerate the result after switching language to receive analysis in that language.",
      exportErrorTitle: "Export unavailable",
      printErrorTitle: "Print unavailable",
      printPopupBlocked: "The browser blocked the print window. Allow pop-ups and try again.",
      sampleConsentTitle: "Submit this sample anonymously?",
      sampleConsentCopy: "This anonymously saves your scale answers, open answers, and result to improve TypeMe's questions and writing. It does not save your name, email, IP address, or browser identity.",
      sampleConsentOk: "Submit sample",
      sampleSaveFailed: "Sample save failed",
      sampleSavedTitle: "Saved",
      sampleSavedDb: "The sample was saved anonymously to the database.",
      sampleSavedLocal: "The sample was saved anonymously to the local sample folder. It can be synced after database configuration is ready.",
      sampleFailedTitle: "Submission failed",
      savedLocalToast: "Saved on this device",
      savingStatus: "Saving",
      savedStatus: "Saved locally",
      saveFailedStatus: "Not saved",
      saveFailedToast: "The browser could not save progress. You can still continue on this page.",
      scaleSavedToast: "Scale result saved",
      processing: "Processing",
      submittingAnalysis: "Submitting",
      savingSample: "Saving",
      sampleSubmitted: "Submitted",
      aiLoadingSavedCopy: "Your answers are saved on this device. The result is being prepared now.",
      aiUnloadWarning: "Your result is still being prepared. Leaving will interrupt this analysis, but your answers are saved on this device.",
      aiCompleteToast: "Analysis complete",
      aiFallbackToast: "Analysis is unavailable; your scale result was kept",
      localeChangedToast: "Language switched",
      feedbackPrompt: "Describe the problem, confusing text, lag, or experience you want improved.",
      feedbackBodyLabel: "Feedback:",
      feedbackPageLabel: "Page info:",
      feedbackTypeLabel: "Type:",
      feedbackTimeLabel: "Time:",
      feedbackBrowserLabel: "Browser:",
      feedbackUnknown: "Unknown",
      feedbackSubject: "TypeMe feedback",
      feedbackDoneTitle: "Help improve",
      feedbackDoneCopy: "TypeMe tried to open an email draft and copied the feedback draft to your clipboard.",
      resultNavAria: "Result navigation",
      typeProfileMissing: "This type description is still being written.",
      readingNote: "Reading note",
      scaleStart: "Scale result",
    },
  };

  function t(key, ...args) {
    const value = uiText[typeMeLocale]?.[key] ?? uiText["zh-CN"][key] ?? key;
    return typeof value === "function" ? value(...args) : value;
  }

  function isEnLocale() {
    return typeMeLocale === "en";
  }

  function hasCjkText(value) {
    return /[\u3400-\u9fff]/.test(String(value || ""));
  }

  function secretLetterTitle(full, savedTitle = "") {
    const fallbackTitle = isEnLocale() ? `A note for you as ${full}` : `给 ${full} 型的你的悄悄话`;
    const title = String(savedTitle || "").trim();
    if (!title) return fallbackTitle;
    if (isEnLocale() && hasCjkText(title)) return fallbackTitle;
    return title;
  }

  const sectionCopy = {
    "zh-CN": {
      typeLanding: ["结果", "最接近的类型"],
      coordinates: ["维度", "维度比例"],
      dimensions: ["维度", "五个维度"],
      index: ["导航", "目录"],
      typeCues: ["线索", "人格线索"],
      nextSteps: ["操作", "后续操作"],
      restored: ["状态", "已恢复"],
      resultHero: ["结果", "你的测试结果"],
      readTip: ["读法", "怎么看"],
      guideOutput: ["结果", "你会得到什么"],
    },
    en: {
      typeLanding: ["READING", "Closest type"],
      coordinates: ["DIMENSIONS", "Dimension scores"],
      dimensions: ["MAP", "Five dimensions"],
      index: ["NAV", "Jump to"],
      typeCues: ["SIGNALS", "Type cues"],
      nextSteps: ["ACTIONS", "Next steps"],
      restored: ["STATUS", "Restored"],
      resultHero: ["RESULT", "Your result"],
      readTip: ["READ", "How to read"],
      guideOutput: ["OUTPUT", "What you get"],
    },
  };

  const dimensionCopy = {
    "zh-CN": {
      EI: ["精力来源", "外向", "内向"],
      SN: ["认知方式", "实感", "直觉"],
      TF: ["决策方式", "理性", "感性"],
      JP: ["生活态度", "判断", "感知"],
      AT: ["身份认同", "坚定", "波动"],
    },
    en: {
      EI: ["Energy source", "Extraversion", "Introversion"],
      SN: ["Perception style", "Sensing", "Intuition"],
      TF: ["Decision style", "Thinking", "Feeling"],
      JP: ["Life rhythm", "Judging", "Prospecting"],
      AT: ["Identity style", "Assertive", "Turbulent"],
    },
  };

  const familyCopy = {
    "zh-CN": {
      analysts: { label: "分析家", tone: "结构 / 远景 / 推演", copy: "更容易先看系统、策略和长期代价。卡片里的角色槽未来适合偏冷静、锋利、几何感的资产。" },
      diplomats: { label: "外交家", tone: "关系 / 意义 / 感受", copy: "更容易从人的需要、价值和氛围里理解选择。角色资产可以更柔和、流动、带一点情绪光。" },
      sentinels: { label: "守卫者", tone: "秩序 / 责任 / 稳定", copy: "更在意可靠性、承诺和生活结构。未来资产适合稳定、清晰、有日常守护感的形象。" },
      explorers: { label: "探索家", tone: "行动 / 体验 / 现场", copy: "更相信现场判断、身体感和即时反馈。角色资产可以更轻快、机动、带一点工具感。" },
    },
    en: {
      analysts: { label: "Analysts", tone: "Structure / Vision / Inference", copy: "Types that tend to read systems, strategy, and long-term tradeoffs first." },
      diplomats: { label: "Diplomats", tone: "Meaning / Values / Feeling", copy: "Types that often understand choices through people, values, and atmosphere." },
      sentinels: { label: "Sentinels", tone: "Order / Duty / Stability", copy: "Types that care about reliability, commitments, and durable routines." },
      explorers: { label: "Explorers", tone: "Action / Experience / Presence", copy: "Types that trust live judgment, practical feedback, and what is happening now." },
    },
  };

  const axisWordsByLocale = {
    "zh-CN": axisWords,
    en: {
      E: "Extraverted energy", I: "Introverted energy",
      S: "Practical sensing", N: "Intuitive patterning",
      T: "Logical judgment", F: "Value judgment",
      J: "Planned rhythm", P: "Adaptive rhythm",
    },
  };

  const typeProfileCopy = {
    en: {
      INTJ: ["Architect", "Strategic, independent, and drawn to long-range systems."],
      INTP: ["Logician", "Curious, analytical, and restless around unfinished ideas."],
      ENTJ: ["Commander", "Direct, organized, and quick to turn vision into structure."],
      ENTP: ["Debater", "Inventive, provocative, and energized by intellectual friction."],
      INFJ: ["Advocate", "Insightful, principled, and protective of deeper meaning."],
      INFP: ["Mediator", "Values-led, sensitive, and quietly persistent about what feels true."],
      ENFJ: ["Protagonist", "Warm, persuasive, and attentive to people’s growth."],
      ENFP: ["Campaigner", "Imaginative, expressive, and pulled toward possibility."],
      ISTJ: ["Logistician", "Reliable, orderly, and grounded in responsibility."],
      ISFJ: ["Defender", "Careful, loyal, and attentive to what people quietly need."],
      ESTJ: ["Executive", "Structured, decisive, and focused on getting things moving."],
      ESFJ: ["Consul", "Socially attentive, practical, and oriented toward care."],
      ISTP: ["Virtuoso", "Hands-on, observant, and calm under practical pressure."],
      ISFP: ["Adventurer", "Sensory, gentle, and guided by personal taste."],
      ESTP: ["Entrepreneur", "Action-oriented, adaptable, and quick in the moment."],
      ESFP: ["Entertainer", "Expressive, present, and responsive to the energy around them."],
    },
  };

  const resultSectionCopy = {
    "zh-CN": {
      tension: ["张力", "内在张力"],
      adjacent: ["相邻", "相邻气质"],
      portrait: ["画像", "整体画像"],
      evidence: ["证据", "开放题证据"],
      strengths: ["资源", "可调动的资源"],
      growth: ["照顾", "需要被照顾的习惯"],
      differences: ["差异", "值得关注的差异"],
    },
    en: {
      tension: ["TENSION", "Inner tension"],
      adjacent: ["ADJACENT", "Adjacent traits"],
      portrait: ["PORTRAIT", "Overall portrait"],
      evidence: ["EVIDENCE", "Open-answer evidence"],
      strengths: ["STRENGTHS", "Usable strengths"],
      growth: ["CARE POINTS", "Habits to care for"],
      differences: ["DIFFERENCES", "Notable differences"],
    },
  };

  const homePreviewCopy = {
    en: {
      "ENFP-A": { title: "Possibility starter", copy: "You bring possibilities into relationships, then learn how to give enthusiasm a quiet landing.", symbols: ["NF", "Inspiration", "A/T"], chips: ["Intuition · 61%", "Extraverted energy", "Evidence cue"] },
      "INTJ-A": { title: "Structure planner", copy: "You tend to turn disorder into paths before letting emotion enter the longer-range judgment.", symbols: ["NT", "Structure", "A/T"], chips: ["Vision · 68%", "Introverted energy", "Strategy cue"] },
      "INFP-T": { title: "Inner pathfinder", copy: "You keep asking whether a choice is faithful to yourself, which can make the pull feel sharper.", symbols: ["NF", "Values", "A/T"], chips: ["Values · 63%", "Introverted energy", "Feeling cue"] },
      "ISFJ-T": { title: "Quiet defender", copy: "You remember many small details for others while also searching for the edge of your own boundary.", symbols: ["SJ", "Care", "A/T"], chips: ["Detail · 64%", "Stable energy", "Care cue"] },
      "ESTP-A": { title: "Present actor", copy: "You trust what is happening now, and often correct direction through action.", symbols: ["SP", "Presence", "A/T"], chips: ["Action · 66%", "Extraverted energy", "Live cue"] },
      "ENTJ-A": { title: "Long-range director", copy: "Once a goal is visible, you naturally begin arranging paths, resources, and tempo.", symbols: ["NT", "Drive", "A/T"], chips: ["Structure · 70%", "Extraverted energy", "Drive cue"] },
    },
  };

  const scaleQuestionTextEn = {
    1: "In unfamiliar settings, if the topic interests me, I usually join the conversation proactively.",
    2: "After a lot of social interaction, I need quiet time to recover my state.",
    3: "I often clarify my thoughts while speaking them out loud.",
    4: "Before saying an important thought, I usually rehearse it in my mind several times.",
    5: "When the group energy drops, I naturally want to bring the interaction back up.",
    6: "Compared with lively gatherings, I prefer deeper conversation with a small number of people.",
    7: "When people pay attention to me, I am more likely to feel energized than drained.",
    8: "For complex thoughts, I prefer writing them down first or expressing them quietly.",
    9: "Interacting with people helps me gain inspiration and momentum faster.",
    10: "If I have no alone time for a whole day, I feel noticeably uncomfortable.",
    11: "When judging something, I first look at what has happened and what can be verified.",
    12: "A small detail often makes me think of larger patterns, metaphors, or future possibilities.",
    13: "When solving a problem, I first confirm the process, limits, and available resources.",
    14: "Compared with following existing steps, I enjoy exploring new explanations or possibilities.",
    15: "I quickly notice details, numbers, or practical conditions that others miss.",
    16: "Abstract ideas, long-term visions, or hidden connections easily attract me.",
    17: "If an idea cannot be put into practice yet, I quickly want to know how it would actually work.",
    18: "Even when the evidence is incomplete, I can form an initial judgment from intuition.",
    19: "I like clear, concrete instructions that I can follow.",
    20: "I often wonder whether things would turn out completely differently if approached another way.",
    21: "When deciding, I first check whether the logic is consistent and the standard is fair.",
    22: "When deciding, I seriously consider how it will affect people's feelings and relationships.",
    23: "When pointing out a problem, I think accuracy matters more than softness.",
    24: "If the truth may hurt someone, I first consider how to express it without damaging the relationship.",
    25: "In arguments, I focus more on whether the point holds up than whether the atmosphere is comfortable.",
    26: "Other people's emotional shifts strongly affect my next judgment and expression.",
    27: "I appreciate people who face problems directly, even if their words are a little sharp.",
    28: "To keep a team harmonious, I adjust my expression or decision.",
    29: "When rules conflict with personal feelings, I tend to protect the rules first.",
    30: "I am more easily persuaded by whether a decision treats people kindly.",
    31: "Before starting something, I like to clarify the goal, steps, and timeline.",
    32: "I prefer keeping options open and dislike fixing a plan too early.",
    33: "Before my to-do items are finished, I find it hard to truly relax.",
    34: "The pressure of an approaching deadline can sometimes make me more efficient.",
    35: "Clear rules and a stable rhythm make me feel more at ease.",
    36: "If plans suddenly change, I can usually adjust my state quickly.",
    37: "I tend to keep life and work well organized.",
    38: "I dislike being restricted by an overly detailed schedule.",
    39: "I actively push vague matters toward a definite state.",
    40: "New opportunities that appear during exploration often attract me more than the original plan.",
    41: "Under pressure, I usually trust that I can handle the situation.",
    42: "Even after something is finished, I easily worry that I did not do well enough.",
    43: "External evaluation does not easily shake my own judgment.",
    44: "One negative comment from someone can stay in my mind for a long time.",
    45: "After failure, I can usually return to action fairly quickly.",
    46: "Before important occasions, I often worry that I will make a mistake.",
    47: "I am usually fairly certain about my choices.",
    48: "I frequently compare my performance with other people's.",
    49: "Even when the result is imperfect, I can accept that it is good enough.",
    50: "I am sensitive to future uncertainty and can become anxious easily.",
  };

  const openQuestionTextEn = {
    ei_recovery_01: "After a social event, you seemed natural on the outside, but felt suddenly exhausted once you got home. Was that tiredness more like physical depletion, emotional emptiness, or replaying what others said?",
    ei_entry_02: "When entering a room full of strangers, if there is a topic you care about, how long do you usually observe before joining? What signal makes you decide to speak?",
    ei_boundary_03: "Have you ever wanted to be alone but stayed because you did not want to spoil the mood? How did you later judge whether staying was worth it?",
    ei_group_04: "When a group discussion is lively and you have a different idea, do you usually jump in or wait until someone asks? Why?",
    ei_closeness_05: "When does connecting with people feel energizing, and when does it feel draining? What is different between those two scenes?",
    ei_silence_06: "Have you ever said very little in a room while still being deeply engaged? What might others have misunderstood about you?",
    ei_initiate_07: "If a relationship requires you to initiate contact, make plans, or start conversations, does that feel natural or like extra effort?",
    ei_after_conflict_08: "After a small conflict, do you want to talk it through immediately or first be alone and sort out your emotions? What happens if the other person asks right away?",
    sn_hunch_01: "Recently, have you sensed that something was wrong without clear evidence? Did you trust the hunch or keep looking for facts? What happened?",
    sn_detail_02: "If one plan is imaginative but incomplete in detail, and another is safe but not very new, which would you move forward first? Why?",
    sn_learning_03: "When learning something new, do you first grasp the overall framework or first understand the steps and examples? Which makes you feel more secure?",
    sn_memory_04: "When recalling an important experience, do concrete images and details come first, or the meaning and direction behind the event?",
    sn_future_05: "When someone proposes a long-term vision, do you first get excited by the possibility or first worry about how it will land? How has that helped or limited you?",
    sn_evidence_06: "If someone disagrees with your judgment but offers no evidence and only says, “I feel it will be this way,” how do you respond?",
    sn_change_07: "When facing a rule that has been running for a long time, do you first try to understand why it exists or first imagine a better possibility?",
    sn_overlook_08: "Have you ever focused so much on direction or meaning that you missed a practical detail and caused a problem? How did you adjust afterward?",
    tf_truth_01: "If you had to choose between “telling the truth and hurting someone” and “telling a kind lie to make them happy,” which way would you lean? Why?",
    tf_feedback_02: "You need to give a friend very negative feedback, but you know they are in a bad state recently. How would you say it? What would you hold back?",
    tf_team_03: "Someone on the team is not very capable but has a good attitude; another person is highly capable but makes everyone uncomfortable. Who would you rather work with, and why?",
    tf_argument_04: "In an argument, you realize your logic is stronger, but the other person is visibly hurt. Do you keep explaining fully or pause to protect the relationship?",
    tf_rule_05: "If a rule is fair in itself, but applying it would make things very hard for a specific person, would you maintain the rule or make an exception?",
    tf_decision_06: "When making a major decision, are you more afraid of being insufficiently rational, or of ignoring your own or others' feelings? Why?",
    tf_comfort_07: "When a friend tells you they are in pain, is your first response to analyze solutions or to help them feel understood?",
    tf_self_08: "Have you ever agreed to something you did not want because you wanted someone else to feel comfortable? How do you see that choice now?",
    jp_disrupt_01: "If your carefully arranged day is suddenly disrupted, what is your first reaction? Do you immediately rearrange things, or first see what the change may bring?",
    jp_deadline_02: "Facing an important deadline, do you usually lock in a plan early or keep flexibility until the last moment? What has that approach cost you?",
    jp_options_03: "When there are many options and all of them seem decent, do you want to decide quickly or keep opening more possibilities? Why?",
    jp_routine_04: "What does your most comfortable week look like: generally predictable, or full of new changes each day? How do you react when either side is out of balance?",
    jp_start_05: "Think of something you have wanted to do but have not started. Is it blocked by lack of plan, motivation, fear of commitment, or waiting for a better moment?",
    jp_commit_06: "When someone asks you for a clear answer right now but you still want to wait and see, how do you respond?",
    jp_mess_07: "When your living or working space becomes messy, do you become noticeably irritated, or is it fine as long as things keep moving?",
    jp_spontaneous_08: "If someone suddenly invites you to an activity that sounds good but you are completely unprepared for, do you feel excited, hesitant, or instinctively resistant?",
    at_criticism_01: "What was the last comment that shook you? How did you interpret it at the time, and how did you recover later?",
    at_mistake_02: "When something important goes wrong, do you more often think “I can adjust next time” or “Maybe I am not good enough”? Describe one specific experience.",
    at_compare_03: "When peers or colleagues seem to progress quickly, do you feel motivated or begin to doubt yourself? How do you usually handle that comparison?",
    at_praise_04: "When someone praises you, do you naturally accept it or immediately think “it was not that good”? Where does that reaction come from?",
    at_confidence_05: "In what situations do you suddenly become very certain? Does that certainty come from preparation, experience, approval, or inner values?",
    at_pressure_06: "Under heavy pressure, do you enter an “I can handle this” mode, or repeatedly check whether you might fail?",
    at_identity_07: "If someone misunderstands your motive, do you rush to explain or feel that “people who understand will understand”? Why?",
    at_rest_08: "When you allow yourself to rest, do you feel guilty? Under what conditions can you truly stop and feel at ease?",
    mixed_values_01: "If someone publicly questions a value you care about deeply, do you want to persuade them, understand them, or end the discussion? Why?",
    mixed_conflict_02: "Have you ever stayed silent in a relationship while feeling unconvinced inside? If you could do it again, would you remain silent or speak directly?",
    mixed_future_03: "Imagine that one decision you make today changes your life a year from now. Would you want that decision to be a safe choice or a risk?",
    mixed_control_04: "When you realize something is no longer under your control, do you first try to regain control or accept the change before acting?",
    mixed_help_05: "When you are not doing well, do you want others to give you space, advice, conversation, or direct practical help?",
    mixed_identity_06: "Is there a version of you that others see which feels very different from how you experience yourself? Does that gap trouble you or protect you?",
    mixed_energy_07: "When do you suddenly become action-oriented? Is it because the goal is clear, emotion is sparked, someone expects something, or an opportunity appears on the spot?",
    mixed_regret_08: "Think of a decision you still revisit. Do you regret not being more rational, or not being more honest with your feelings?",
    mixed_work_09: "In collaboration, are you more afraid that others will think you are unreliable, or that too many rules will trap you? Why?",
    mixed_close_10: "When a relationship becomes close, do you relax more easily, or worry more about disappointing the other person?",
  };

  const openHintTextEn = {
    ei_recovery_01: "Write a concrete scene: where you were, who was there, and what you most wanted to do afterward.",
    ei_entry_02: "Do not just write introverted or extraverted. Describe what you watch for before speaking.",
    ei_boundary_03: "Include your concern, body feeling, and whether you regretted staying.",
    ei_group_04: "Use a real meeting, meal, class, or group chat as the scene.",
    ei_closeness_05: "Give one scene where you move toward people and one where you pull back.",
    ei_silence_06: "Write why you stayed quiet and what was actually happening inside.",
    ei_initiate_07: "Write which relationships you initiate most easily, and which ones you postpone.",
    ei_after_conflict_08: "Describe how you really handle the aftermath of conflict.",
    sn_hunch_01: "Where did the signal come from: detail, atmosphere, experience, or association?",
    sn_detail_02: "Write the questions you would ask first, or the information you would fill in first.",
    sn_learning_03: "Use a learning, handoff, or tutorial experience.",
    sn_memory_04: "Describe the first part that comes back to you.",
    sn_future_05: "Write about a time you supported or questioned a new idea.",
    sn_evidence_06: "What would you ask, and when would you be willing to trust them?",
    sn_change_07: "Use a time when you wanted to change a process, habit, or rule.",
    sn_overlook_08: "Include a concrete detail such as time, budget, person, or execution step.",
    tf_truth_01: "Use a relationship scene you have met or could realistically meet.",
    tf_feedback_02: "What do you protect first: facts, relationship, emotion, or long-term outcome?",
    tf_team_03: "Balance efficiency, fairness, atmosphere, and long-term cost.",
    tf_argument_04: "Write your first honest reaction and whether you would revise it later.",
    tf_rule_05: "When is an exception reasonable, and when is it dangerous?",
    tf_decision_06: "Use a choice where rationality and feeling pulled in different directions.",
    tf_comfort_07: "Write the first sentence you would usually say.",
    tf_self_08: "What were you afraid to lose, and did you repair anything later?",
    jp_disrupt_01: "Use a real time when a plan was interrupted.",
    jp_deadline_02: "Use a deadline, exam, or project experience.",
    jp_options_03: "Describe how you handle “all fine, none perfect.”",
    jp_routine_04: "Write your real need for rhythm and change.",
    jp_start_05: "Name the thing and the reason you give yourself.",
    jp_commit_06: "Describe how you deal with commitment, ambiguity, and change.",
    jp_mess_07: "Where is your tolerance boundary for disorder?",
    jp_spontaneous_08: "What risks or opportunities would you consider?",
    at_criticism_01: "Why did that sentence hit you, not just how sad it felt?",
    at_mistake_02: "Include first reaction, next action, and recovery time.",
    at_compare_03: "Use a recent comparison scene.",
    at_praise_04: "What is the first reaction in your body and mind?",
    at_confidence_05: "Write one moment when you felt most steady.",
    at_pressure_06: "Write your most typical self-talk under pressure.",
    at_identity_07: "Write your real need around being understood or recognized.",
    at_rest_08: "Describe your relationship with “this is already enough.”",
    mixed_values_01: "How do you decide whether the discussion is still worth continuing?",
    mixed_conflict_02: "Why did you hold back then, and how do you see it now?",
    mixed_future_03: "Write the change you want and the price you fear.",
    mixed_control_04: "Use an experience where loss of control was obvious.",
    mixed_help_05: "What help do you really need, and what do you usually ask for?",
    mixed_identity_06: "How do others see you, and how do you explain yourself?",
    mixed_energy_07: "Use a moment when delay turned into action.",
    mixed_regret_08: "Write the emotional aftertaste of that decision.",
    mixed_work_09: "Use one team scene and the evaluation you cared about most.",
    mixed_close_10: "Write the protective move you often make in close relationships.",
  };

  const likertLabelEn = {
    3: "Strongly agree",
    2: "Agree",
    1: "Slightly agree",
    0: "Neutral",
    "-1": "Slightly disagree",
    "-2": "Disagree",
    "-3": "Strongly disagree",
  };

  function sectionMeta(key) {
    const [kicker, title] = sectionCopy[typeMeLocale]?.[key] || sectionCopy["zh-CN"][key] || [key.toUpperCase(), key];
    return { kicker, title };
  }

  function dimensionLabel(dim, fallbackLabels = {}) {
    const localized = dimensionCopy[typeMeLocale]?.[dim] || dimensionCopy["zh-CN"][dim];
    const fallback = fallbackLabels?.[dim] || {};
    return {
      name: localized?.[0] || fallback.name || dim,
      left_label: localized?.[1] || fallback.left_label || fallback.left || "",
      right_label: localized?.[2] || fallback.right_label || fallback.right || "",
    };
  }

  function localizedFamily(fidOrType) {
    const fid = familyId(fidOrType);
    return familyCopy[typeMeLocale]?.[fid] || familyCopy["zh-CN"][fid] || familyNotes[fid] || {};
  }

  function localizedTypeProfile(type, raw = {}) {
    const code = String(type || "").slice(0, 4).toUpperCase();
    if (isEnLocale()) {
      const copy = typeProfileCopy.en[code];
      if (copy) return { ...raw, nickname: copy[0], description: copy[1] };
    }
    return raw;
  }

  function localizedHomePreview(preview) {
    return isEnLocale() ? { ...preview, ...(homePreviewCopy.en[preview.type] || {}) } : preview;
  }

  function resultSectionMeta(key) {
    const [kicker, title] = resultSectionCopy[typeMeLocale]?.[key] || resultSectionCopy["zh-CN"][key] || ["NOTES", key];
    return { kicker, title };
  }

  function candidateReasonText(reason) {
    if (!isEnLocale()) return reason || "";
    const value = String(reason || "");
    if (!value) return "";
    if (value.includes("量表最接近")) return "Closest scale match";
    const midpoint = value.match(/^([A-Z/]+)\s*接近中线/);
    if (midpoint) return `${midpoint[1]} near the midpoint`;
    if (value.includes("低置信")) return "Low-confidence adjacent possibility";
    if (value.includes("相邻")) return "Adjacent type possibility";
    return value;
  }

  function localizedScaleQuestion(question) {
    if (!question) return "";
    return isEnLocale() ? (scaleQuestionTextEn[question.id] || question.text_en || question.text || "") : (question.text || "");
  }

  function localizedOpenQuestion(question) {
    if (!question) return "";
    const id = question.id || question.display_id;
    return isEnLocale() ? (openQuestionTextEn[id] || question.text_en || question.text || "") : (question.text || "");
  }

  function localizedOpenHint(question) {
    if (!question) return "";
    const id = question.id || question.display_id;
    return isEnLocale() ? (openHintTextEn[id] || question.hint_en || question.hint || "") : (question.hint || "");
  }

  function localizedOpenDevMeta(question) {
    const raw = {
      focus_dimension: question?.focus_dimension || "mixed",
      selection_bucket: question?.selection_bucket || "",
      selection_reason: question?.selection_reason || "",
    };
    if (!isEnLocale()) return raw;
    const bucketCopy = {
      borderline: "borderline",
      mixed: "mixed",
      narrative: "narrative",
      stability_check: "stability check",
      fallback: "fallback",
    };
    const reason = String(raw.selection_reason || "");
    let reasonText = reason;
    let match = reason.match(/^([A-Z/]+)\s+接近中线（(\d+)%），优先用现实场景复核$/);
    if (match) {
      reasonText = `${match[1]} near midpoint (${match[2]}%); review with a real scene`;
    } else if ((match = reason.match(/^([A-Z/]+)\s+量表较稳定（(\d+)%），抽样检查压力场景下是否仍一致$/))) {
      reasonText = `${match[1]} stable on the scale (${match[2]}%); sample-check under pressure`;
    } else if (reason === "跨维度困境题，用来观察多个倾向在同一场景里的取舍") {
      reasonText = "Cross-dimension dilemma; observes tradeoffs in one scene";
    } else if (reason === "情绪与自我叙事题，用来补充压力、自责或关系中的真实反应") {
      reasonText = "Emotion and self-narrative; adds real reactions under pressure, self-blame, or relationships";
    } else if (reason === "叙事题，用来补充具体经历而不是抽象自评") {
      reasonText = "Narrative prompt; adds concrete experience instead of abstract self-rating";
    } else if (reason === "补足 5 道开放题") {
      reasonText = "Fills the five open prompts";
    }
    return {
      focus_dimension: raw.focus_dimension,
      selection_bucket: bucketCopy[raw.selection_bucket] || raw.selection_bucket,
      selection_reason: reasonText,
    };
  }

  function localizedLikertLabel(value, fallback = "") {
    return isEnLocale() ? (likertLabelEn[value] || fallback || "") : (fallback || "");
  }

  window.TypeMeI18n = {
    t,
    locale: () => typeMeLocale,
    isEn: isEnLocale,
    hasCjkText,
    scaleQuestionText: localizedScaleQuestion,
    openQuestionText: localizedOpenQuestion,
    openQuestionHint: localizedOpenHint,
    openDevMeta: localizedOpenDevMeta,
    dimensionLabel,
    likertLabel: localizedLikertLabel,
    family: localizedFamily,
    typeProfile: localizedTypeProfile,
    unsupportedNotice() {
      return { title: t("unsupportedTitle"), copy: t("unsupportedCopy") };
    },
  };

  const homePreviewDeck = [
    {
      type: "ENFP-A",
      code: "ENFP",
      family: "diplomats",
      symbols: ["NF", "灵感", "A/T"],
      title: "灵感发起者",
      copy: "把可能性带进关系里，也需要学会给热情一个安静的落点。",
      chips: ["直觉 · 61%", "外向能量", "情绪线索"],
    },
    {
      type: "INTJ-A",
      code: "INTJ",
      family: "analysts",
      symbols: ["NT", "结构", "A/T"],
      title: "结构策划者",
      copy: "你习惯先把混乱拆成路径，再把情绪放进更长远的判断里。",
      chips: ["远景 · 68%", "内向能量", "策略线索"],
    },
    {
      type: "INFP-T",
      code: "INFP",
      family: "diplomats",
      symbols: ["NF", "价值", "A/T"],
      title: "内在寻路者",
      copy: "你会反复确认一件事是否对得起自己，也会因此更敏感地感到拉扯。",
      chips: ["价值 · 63%", "内向能量", "情绪线索"],
    },
    {
      type: "ISFJ-T",
      code: "ISFJ",
      family: "sentinels",
      symbols: ["SJ", "守护", "A/T"],
      title: "安静守护者",
      copy: "你把很多细节记在心里，照顾别人时也在寻找自己的边界。",
      chips: ["细节 · 64%", "稳定能量", "照顾线索"],
    },
    {
      type: "ESTP-A",
      code: "ESTP",
      family: "explorers",
      symbols: ["SP", "现场", "A/T"],
      title: "现场行动者",
      copy: "你更相信正在发生的事，会在行动里迅速修正方向。",
      chips: ["行动 · 66%", "外向能量", "现场线索"],
    },
    {
      type: "ENTJ-A",
      code: "ENTJ",
      family: "analysts",
      symbols: ["NT", "推进", "A/T"],
      title: "远景指挥者",
      copy: "你看见目标后，会自然开始整理路径、资源和节奏。",
      chips: ["结构 · 70%", "外向能量", "推进线索"],
    },
  ];

  function pickHomePreview() {
    return homePreviewDeck[Math.floor(Math.random() * homePreviewDeck.length)] || homePreviewDeck[0];
  }

  const $id = (id) => document.getElementById(id);

  function normalizePersonaQuotes(value) {
    return String(value ?? "")
      .replace(/'([^'\n]{1,160})'/g, (match, inner) => /[\u4e00-\u9fff]/.test(inner) ? `“${inner.trim()}”` : match)
      .replace(/"([^"\n]{1,160})"/g, (match, inner) => /[\u4e00-\u9fff]/.test(inner) ? `“${inner.trim()}”` : match)
      .replace(/‘([^’\n]{1,160})’/g, (match, inner) => /[\u4e00-\u9fff]/.test(inner) ? `“${inner.trim()}”` : match)
      .replace(/“([^”\n]{1,160})”/g, (match, inner) => /[\u4e00-\u9fff]/.test(inner) ? `“${inner.trim()}”` : match);
  }

  const escHtml = (value) => normalizePersonaQuotes(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);

  function familyId(type) {
    const raw = String(type || "").toLowerCase();
    if (families[raw]) return raw;
    const code = String(type || "").toUpperCase().match(/[IE][SN][TF][JP]/)?.[0] || String(type || "").toUpperCase().slice(0, 4);
    return Object.entries(families).find(([, family]) => family.types.includes(code))?.[0] || "analysts";
  }

  function familyName(type) {
    return localizedFamily(type).label || families[familyId(type)].label;
  }

  function applyTypeTheme(typeOrFamily) {
    const fid = familyId(typeOrFamily);
    document.body.classList.remove(...typeThemeClasses);
    document.body.classList.add(`typeme-theme-${fid}`);
    document.body.dataset.typeMeTheme = fid;
    return fid;
  }

  function axisTags(type) {
    const words = axisWordsByLocale[typeMeLocale] || axisWordsByLocale["zh-CN"];
    return type.split("").map((letter) => words[letter] || letter);
  }

  function confidenceLabel(level) {
    if (isEnLocale()) return level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low confidence";
    return level === "high" ? "高置信" : level === "medium" ? "中等置信" : "低置信";
  }

  const afterwordNotes = [
    "反复出现的反应，本身就是线索。它们比标签更接近真实的你。",
    "让人停住的那一段，往往藏着更真实的需要。",
    "不完全贴合的部分，也许正说明你不是单一模式。",
    "这份档案留下的是轮廓，细节会在之后的生活里慢慢显出来。",
    "类型只是入口。更值得看的，是你在关系和压力里反复选择的方式。"
  ];
  const afterwordNotesEn = [
    "A repeated reaction is already evidence. It often tells more than the label.",
    "The moment that makes you pause usually points to a real need.",
    "The parts that do not fit neatly may be where your range begins.",
    "This profile keeps the outline. The finer details will keep appearing in ordinary life.",
    "Type is only the entry point. The deeper pattern is how you choose under pressure and in relationship."
  ];

  function afterwordNote() {
    const list = isEnLocale() ? afterwordNotesEn : afterwordNotes;
    return list[Math.floor(Math.random() * list.length)];
  }

  function personaCandidatePanel(result, compact = false) {
    const meta = sectionMeta("typeLanding");
    const confidence = result?.confidence || {};
    const candidates = Array.isArray(result?.candidate_types) ? result.candidate_types : [];
    const uncertain = Array.isArray(confidence.uncertain_dimensions) ? confidence.uncertain_dimensions : [];
    if (!candidates.length && !uncertain.length) return "";
    const full = `${result.type}-${result.identity}`;
    return `
      <section class="${compact ? "persona-sidebar-card" : "persona-result-block"} persona-candidate-panel">
        <span>${escHtml(meta.title)}</span>
        <p>${escHtml(t("typeLandingCopy", full))}</p>
        ${candidates.length ? `<div class="persona-candidate-list">${candidates.map((item, index) => `
          <article class="${index === 0 ? "is-primary" : ""}">
            <b>${escHtml(item.type)}-${escHtml(item.identity || result.identity)}</b>
            <em>${escHtml(candidateReasonText(item.reason))}</em>
            <span>${escHtml(item.confidence || "")}%</span>
          </article>`).join("")}</div>` : ""}
        ${uncertain.length ? `<div class="persona-tension-list">${uncertain.slice(0, 3).map((item) => {
          const dim = dimensionLabel(item.dim);
          return `<i>${escHtml(item.dim)} · ${escHtml(dim.name)} · ${escHtml(confidenceLabel(item.label))}</i>`;
        }).join("")}</div>` : ""}
      </section>`;
  }

  function assetSlot(type, sizeClass = "") {
    return `
      <div class="persona-asset-slot ${sizeClass}" aria-label="${escHtml(type)} future persona asset slot">
        <span class="persona-asset-symbol">${escHtml(type)}</span>
        <span class="persona-asset-line l1"></span>
        <span class="persona-asset-line l2"></span>
        <span class="persona-asset-line l3"></span>
      </div>`;
  }

  async function ensureTypeMeQuestions() {
    if (typeMeQuestions) return true;
    if (typeof window.load === "function") {
      try {
        const loaded = await window.load();
        const sharedQuestions = window.getTypeMeQuestions?.();
        if (loaded && sharedQuestions) {
          typeMeQuestions = sharedQuestions;
          return true;
        }
      } catch {}
    }
    try {
      const response = await fetch("/api/questions", { cache: "no-store" });
      if (!response.ok) throw new Error("questions unavailable");
      typeMeQuestions = await response.json();
      return true;
    } catch {
      return false;
    }
  }

  function renderHomeTypePreview() {
    const home = $id("screen-home");
    if (!home) return;
    const preview = localizedHomePreview(pickHomePreview());
    applyTypeTheme(preview.family);
    const active = home.classList.contains("active");
    home.className = `screen persona-home-screen${active ? " active" : ""}`;
    home.dataset.personaMounted = "1";
    home.innerHTML = `
      <div class="persona-production persona-home-production">
        <div class="persona-production-hero">
          <section>
          <p class="persona-kicker">${escHtml(t("homeKicker"))}</p>
          <h1>${escHtml(t("homeTitle"))}</h1>
          <p class="persona-lead">${escHtml(t("homeLead"))}</p>
          <div class="persona-resume-slot"><div id="resume" class="resume"></div></div>
          <div class="typeme-actions">
            <button class="typeme-action primary" type="button" data-typeme-route="test">${escHtml(t("startTest"))}</button>
            <button class="typeme-action secondary" type="button" data-typeme-route="library">${escHtml(t("browseTypes"))}</button>
            <button class="typeme-action ghost" type="button" data-typeme-route="theory">${escHtml(t("readGuide"))}</button>
          </div>
          <div class="persona-process" aria-label="${escHtml(isEnLocale() ? "TypeMe process" : "TypeMe 流程")}">
            <span>${escHtml(t("processScale"))}</span><i></i><span>${escHtml(t("processPrompt"))}</span><i></i><span>${escHtml(t("processCheck"))}</span><i></i><span>${escHtml(t("processProfile"))}</span>
          </div>
          </section>
          <aside class="persona-stage persona-family-${escHtml(preview.family)}" aria-label="${escHtml(isEnLocale() ? "Result preview" : "结果预览")}">
            <div class="persona-preview-card">
            <div class="persona-asset-zone">
              ${assetSlot(preview.code)}
              <div class="persona-symbols">${preview.symbols.map((item) => `<span>${escHtml(item)}</span>`).join("")}</div>
            </div>
            <div class="persona-preview-caption">
              <span class="persona-type-code">${escHtml(preview.type)}</span>
              <strong>${escHtml(preview.title)}</strong>
              <p>${escHtml(preview.copy)}</p>
            </div>
            </div>
            <div class="persona-floating-chip chip-a">${escHtml(preview.chips[0])}</div>
            <div class="persona-floating-chip chip-b">${escHtml(preview.chips[1])}</div>
            <div class="persona-floating-chip chip-c">${escHtml(preview.chips[2])}</div>
          </aside>
        </div>
        <section class="persona-summary-grid" aria-label="${escHtml(isEnLocale() ? "TypeMe output summary" : "TypeMe 结果摘要")}">
          <article class="persona-card"><span>${escHtml(t("summaryCoordinateKicker"))}</span><h3>${escHtml(t("summaryCoordinateTitle"))}</h3><p>${escHtml(t("summaryCoordinateCopy"))}</p></article>
          <article class="persona-card"><span>${escHtml(t("summaryEvidenceKicker"))}</span><h3>${escHtml(t("summaryEvidenceTitle"))}</h3><p>${escHtml(t("summaryEvidenceCopy"))}</p></article>
          <article class="persona-card"><span>${escHtml(t("summaryProfileKicker"))}</span><h3>${escHtml(t("summaryProfileTitle"))}</h3><p>${escHtml(t("summaryProfileCopy"))}</p></article>
        </section>
      </div>`;
    if (typeof window.resumeBanner === "function") window.resumeBanner();
  }

  function renderTypeMeMethodPage() {
    if (!typeMeQuestions) return;
    const screen = $id("screen-theory");
    if (!screen) return;
    const dims = window.DIMS || ["EI", "SN", "TF", "JP", "AT"];
    const methodCards = t("guideCards");
    const methodNotes = t("guideNotes");
    const dimsMeta = sectionMeta("dimensions");
    const outputMeta = sectionMeta("guideOutput");
    screen.innerHTML = `
      <div class="persona-production">
        <header class="persona-page-head persona-method-head">
          <div>
            <p class="persona-kicker">${escHtml(t("guideKicker"))}</p>
            <h1>${escHtml(t("guideTitle"))}</h1>
            <p class="persona-lead">${escHtml(t("guideLead"))}</p>
          </div>
          <aside class="persona-method-aside">
            <span>${escHtml(outputMeta.kicker)}</span>
             <strong>${escHtml(t("guideAsideStrong"))}</strong>
             <p>${escHtml(t("guideAsideCopy"))}</p>
          </aside>
        </header>
        <section class="persona-method-flow" aria-label="${escHtml(isEnLocale() ? "TypeMe guide flow" : "TypeMe 说明流程")}">
          ${methodCards.map(([step, title, copy]) => `
            <article class="persona-method-card">
              <span>${step}</span>
              <h3>${title}</h3>
              <p>${copy}</p>
            </article>`).join("")}
        </section>
        <section class="persona-method-note persona-method-note-grid">
          ${methodNotes.map(([title, copy]) => `<div><strong>${escHtml(title)}</strong><span>${escHtml(copy)}</span></div>`).join("")}
        </section>
        <div class="persona-section-label"><span>${escHtml(dimsMeta.title)}</span><i></i></div>
        <section class="persona-dim-grid" id="dim-info">
          ${dims.map((dim) => {
            const item = dimensionLabel(dim);
            return `<article class="persona-dim-card">
              <strong>${escHtml(dim)}</strong>
              <h3>${escHtml(item.name || dim)}</h3>
              <p>${escHtml(item.left_label || item.left || "")} / ${escHtml(item.right_label || item.right || "")}</p>
              <div class="persona-dim-spectrum"><span></span></div>
            </article>`;
          }).join("")}
        </section>
      </div>`;
  }

  function renderFamilyFilter() {
    const total = Object.values(families).reduce((sum, family) => sum + family.types.length, 0);
    const filters = [["all", t("filterAll"), total], ...Object.keys(families).map((id) => [id, localizedFamily(id).label, families[id].types.length])];
    const ariaLabel = isEnLocale() ? "Filter type families" : "筛选类型家族";
    return `<div class="persona-family-filter" role="group" aria-label="${escHtml(ariaLabel)}">${filters.map(([id, label, count]) => `<button type="button" data-persona-family="${id}" class="${id === activeFamily ? "is-active" : ""}" aria-pressed="${id === activeFamily ? "true" : "false"}" aria-label="${escHtml(`${label} · ${t("typesCount", count)}`)}"><span>${escHtml(label)}</span><small aria-hidden="true">${count}</small></button>`).join("")}</div>`;
  }

  function renderTypeLibraryCards(profiles) {
    const allTypes = Object.values(families).flatMap((family) => family.types);
    const visibleTypes = allTypes.filter((type) => activeFamily === "all" || familyId(type) === activeFamily);
    return visibleTypes.map((type) => {
      const profile = localizedTypeProfile(type, profiles[type] || {});
      const fid = familyId(type);
      const tags = axisTags(type);
      const note = localizedFamily(fid);
      return `
        <button class="persona-type-card persona-family-${fid}" type="button" onclick="openType('${type}')">
          <span class="persona-family-badge">${familyName(type)}</span>
          <span class="persona-type-asset"><b>${type.slice(0, 2)}</b><em>${type.slice(2)}</em></span>
          <span class="persona-type-code">${type}</span>
          <h3>${escHtml(profile.nickname || type)}</h3>
          <p>${escHtml(profile.description || "")}</p>
          <div class="persona-type-tags">${tags.slice(0, 3).map((tag) => `<span>${escHtml(tag)}</span>`).join("")}</div>
          <small class="persona-type-note">${escHtml(note.tone || "")}</small>
        </button>`;
    }).join("");
  }

  function renderTypeLibraryPage() {
    if (!typeMeQuestions) return;
    const screen = $id("screen-library");
    if (!screen) return;
    const profiles = typeMeQuestions.type_profiles || {};
    screen.innerHTML = `
      <div class="persona-production">
        <header class="persona-page-head">
          <div>
            <p class="persona-kicker">${escHtml(t("libraryKicker"))}</p>
            <h1>${escHtml(t("libraryTitle"))}</h1>
            <p class="persona-lead">${escHtml(t("libraryLead"))}</p>
          </div>
          ${renderFamilyFilter()}
        </header>
        <section id="types" class="persona-type-grid">
          ${renderTypeLibraryCards(profiles)}
        </section>
      </div>`;
  }

  async function navigateTypeMeRoute(route, options = {}) {
    const target = typeMeHistoryRoutes.has(route) ? route : "home";
    const restoring = options.restoring === true;
    if (!restoring && !(await personaConfirmLeaveFlow(target))) return null;

    if (["theory", "library", "test", "bridge", "open", "results"].includes(target)
      && !(await ensureTypeMeQuestions())) return null;

    const state = personaGlobalState();
    if (target === "test") {
      if (restoring && state?.answers?.length && typeof window.renderPage === "function") {
        window.renderPage(state.page || 0);
      } else if (typeof window.startTest === "function") {
        await window.startTest();
      }
      return "test";
    }
    if (target === "bridge" && state?.traditional && typeof window.renderBridge === "function") {
      window.renderBridge();
      return "bridge";
    }
    if (target === "open" && state?.traditional && typeof window.renderOpen === "function") {
      window.renderOpen(state.openIndex || 0);
      return "open";
    }
    if (target === "results" && state?.traditional && typeof window.renderResults === "function") {
      const verified = typeof window.hasVerifiedAI === "function" ? window.hasVerifiedAI(state.ai) : !!state.ai;
      window.renderResults(verified, restoring);
      return "results";
    }
    if (["bridge", "open", "results"].includes(target)) {
      typeMeGo("home");
      return "home";
    }

    typeMeGo(target);
    return target;
  }

  function personaTransition(work) {
    document.body.classList.add("persona-route-transition");
    return Promise.resolve()
      .then(work)
      .finally(() => {
        window.setTimeout(() => document.body.classList.remove("persona-route-transition"), 520);
      });
  }

  const originalSyncTopChrome = window.syncTopChrome;

  function renderTypeMeChrome(route) {
    document.title = t("pageTitle");
    const topInner = document.querySelector(".top-inner");
    if (!topInner) {
      personaSetActiveRoute(route);
      return;
    }

    const brand = topInner.querySelector(".brand");
    if (brand) {
      brand.className = "brand persona-header-brand";
      brand.setAttribute("data-typeme-route", "home");
      brand.setAttribute("aria-label", t("homeAria"));
      brand.innerHTML = `
        <span class="persona-header-mark">T</span>
        <span class="persona-header-copy"><strong>TypeMe</strong><small>${escHtml(t("brandSubtitle"))}</small></span>`;
    }

    const tabs = topInner.querySelector(".tabs");
    if (tabs) {
      tabs.setAttribute("aria-label", t("navAria"));
      tabs.innerHTML = `
        <button class="tab" type="button" data-route="home" data-typeme-route="home">${escHtml(t("navHome"))}</button>
        <button class="tab" type="button" data-route="theory" data-typeme-route="theory">${escHtml(t("navGuide"))}</button>
        <button class="tab" type="button" data-route="library" data-typeme-route="library">${escHtml(t("navLibrary"))}</button>`;
    }

    topInner.querySelector(".persona-header-action")?.remove();
    let language = topInner.querySelector(".typeme-language-switch");
    if (!language) {
      language = document.createElement("div");
      language.className = "typeme-language-switch";
      topInner.appendChild(language);
    }
    language.innerHTML = `
      <button class="typeme-language-button" type="button" aria-haspopup="menu" aria-expanded="false">
        <span class="typeme-language-globe" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <circle cx="12" cy="12" r="8.25"></circle>
            <path d="M3.75 12h16.5"></path>
            <path d="M12 3.75c2.18 2.08 3.35 4.84 3.35 8.25S14.18 18.17 12 20.25"></path>
            <path d="M12 3.75C9.82 5.83 8.65 8.59 8.65 12s1.17 6.17 3.35 8.25"></path>
          </svg>
        </span>
        <span class="typeme-language-current">${escHtml(t("langCurrent"))}</span>
      </button>
      <div class="typeme-language-menu" role="menu" hidden>
        <button type="button" role="menuitem" data-typeme-locale="zh-CN" class="${typeMeLocale === "zh-CN" ? "is-active" : ""}">简体中文</button>
        <button type="button" role="menuitem" data-typeme-locale="en" class="${typeMeLocale === "en" ? "is-active" : ""}">English</button>
      </div>`;

    topInner.dataset.personaChrome = "1";
    personaSetActiveRoute(route);
  }

  function personaSetActiveRoute(route) {
    const normalized = route === "home" || route === "theory" || route === "library" ? route : "";
    if (route) typeMeCurrentRoute = route;
    document.querySelectorAll(".top-inner .tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.route === normalized);
    });
  }

  async function personaConfirmLeaveFlow(targetRoute) {
    const state = personaGlobalState();
    const route = state?.route || "";
    const isFlow = ["test", "bridge", "open", "loading"].includes(route);
    if (!isFlow || route === targetRoute) return true;
    if (!state?.answers?.length && !state?.traditional) return true;
    if (typeof window.modal !== "function") return true;
    return await window.modal(
      isEnLocale()
        ? "Your current progress is saved on this device. You can continue from the home page without losing your answers."
        : "当前测试进度会保存在本机。离开后可以从首页继续，不会丢失已填写内容。",
      {
        title: isEnLocale() ? "Leave this step?" : "离开当前流程？",
        ok: isEnLocale() ? "Save and leave" : "保存并离开",
      }
    );
  }

  function syncTypeMeTopChrome(route) {
    if (typeof originalSyncTopChrome === "function") originalSyncTopChrome(route);
    const productionTypeMeRoute = ["home", "theory", "library"].includes(String(route || ""));
    document.body.classList.add("typeme-ui-active");
    document.body.classList.toggle("persona-production-route", productionTypeMeRoute);
    const top = document.querySelector(".top");
    if (top) top.hidden = false;
    renderTypeMeChrome(route);
  }
  window.syncTopChrome = syncTypeMeTopChrome;
  try { syncTopChrome = syncTypeMeTopChrome; } catch {}

  const originalRenderBridge = typeof window.renderBridge === "function" ? window.renderBridge : null;
  function personaRenderBridge() {
    const state = personaGlobalState();
    if (state?.traditional?.type) applyTypeTheme(state.traditional.type);
    if (originalRenderBridge) return originalRenderBridge();
  }
  if (originalRenderBridge) {
    window.renderBridge = personaRenderBridge;
    try { renderBridge = personaRenderBridge; } catch {}
  }

  const originalGo = window.go;
  const typeMeHistoryRoutes = new Set(["home", "theory", "library", "test", "bridge", "open", "results"]);
  let typeMeHandlingHistory = false;

  function typeMeUrlForRoute(route) {
    const url = new URL(window.location.href);
    url.hash = route && route !== "home" ? route : "";
    return url;
  }

  function typeMeWriteHistory(route, mode = "auto") {
    if (typeMeHandlingHistory || !typeMeHistoryRoutes.has(route) || !window.history?.pushState) return;
    const nextUrl = typeMeUrlForRoute(route);
    const currentRoute = window.history.state?.typeMeRoute;
    const method = mode === "replace" ? "replaceState" : currentRoute ? "pushState" : "replaceState";
    if (currentRoute === route && window.location.hash === nextUrl.hash) return;
    window.history[method]({ typeMeRoute: route }, "", nextUrl);
  }

  function typeMeActiveScreenRoute() {
    const id = document.querySelector(".screen.active")?.id || "";
    return id.startsWith("screen-") ? id.slice(7) : "";
  }

  function typeMeCanSkipRouteRender(route) {
    if (!["home", "theory", "library"].includes(route)) return false;
    if (typeMeActiveScreenRoute() !== route) return false;
    const screen = $id(`screen-${route}`);
    if (!screen) return false;
    if (route === "home") return screen.dataset.personaMounted === "1";
    return screen.children.length > 0;
  }

  async function typeMeRestoreHistoryRoute(route) {
    const target = typeMeHistoryRoutes.has(route) ? route : "home";
    typeMeHandlingHistory = true;
    try {
      return await navigateTypeMeRoute(target, { restoring: true });
    } finally {
      typeMeHandlingHistory = false;
    }
  }

  function typeMeGo(route) {
    if (typeMeCanSkipRouteRender(route)) {
      personaSetActiveRoute(route);
      typeMeWriteHistory(route);
      return;
    }
    const isTypeMeRoute = ["home", "theory", "library"].includes(route);
    const run = () => {
      if (isTypeMeRoute) {
        document.body.classList.add("persona-production-route");
        document.body.classList.remove("persona-route-transition");
      }
      if (typeof originalGo === "function") originalGo(route);
      if (route === "home") renderHomeTypePreview();
      if (route === "theory") renderTypeMeMethodPage();
      if (route === "library") renderTypeLibraryPage();
      syncTypeMeTopChrome(route);
      typeMeWriteHistory(route);
    };
    run();
  }
  window.go = typeMeGo;
  try { go = typeMeGo; } catch {}

  window.addEventListener("popstate", (event) => {
    typeMeRestoreHistoryRoute(event.state?.typeMeRoute || (window.location.hash || "#home").slice(1));
  });

  function personaRenderTheory() {
    renderTypeMeMethodPage();
  }
  window.renderTheory = personaRenderTheory;
  try { renderTheory = personaRenderTheory; } catch {}

  async function personaShowTheory() {
    await navigateTypeMeRoute("theory");
  }
  window.showTheory = personaShowTheory;
  try { showTheory = personaShowTheory; } catch {}

  async function personaShowLibrary() {
    if (!(await ensureTypeMeQuestions())) return;
    renderTypeLibraryPage();
    window.go("library");
  }
  window.showLibrary = personaShowLibrary;
  try { showLibrary = personaShowLibrary; } catch {}

  const originalResumeBanner = window.resumeBanner;
  function personaResumeBanner() {
    const banner = $id("resume");
    const savedRaw = window.savedRaw;
    if (!banner || typeof savedRaw !== "function") {
      if (typeof originalResumeBanner === "function") originalResumeBanner();
      return;
    }
    const raw = savedRaw();
    if (!raw) {
      banner.classList.remove("active");
      banner.innerHTML = "";
      delete banner.dataset.resumeStage;
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
      if (typeof window.normalizeSaved === "function") data = window.normalizeSaved(data);
    } catch {
      banner.classList.remove("active");
      banner.innerHTML = "";
      delete banner.dataset.resumeStage;
      return;
    }
    if (!(data.answers || []).length) {
      banner.classList.remove("active");
      banner.innerHTML = "";
      delete banner.dataset.resumeStage;
      return;
    }
    const answered = (data.answers || []).length;
    const stage = typeof window.savedJourneyStage === "function"
      ? window.savedJourneyStage(data)
      : { key: data.ai ? "result" : data.traditional ? "scaleDone" : "scale", openCount: 0 };
    const totalOpen = data.traditional?.selected_questions?.length || 5;
    const titleByStage = {
      scale: t("resumeScale", answered, 50, Number(data.page || 0) + 1),
      scaleDone: t("resumeScaleDone"),
      open: t("resumeOpenDraft", stage.openCount, totalOpen),
      result: t("resumeFinal"),
    };
    const copyByStage = {
      scale: t("resumeScaleCopy"),
      scaleDone: t("resumeScaleDoneCopy"),
      open: t("resumeOpenCopy"),
      result: t("resumeFinalCopy"),
    };
    const title = titleByStage[stage.key];
    const copy = copyByStage[stage.key];
    banner.dataset.resumeStage = stage.key;
    banner.innerHTML = `
      <span class="persona-resume-mark">P</span>
      <div class="persona-resume-copy"><strong>${escHtml(title)}</strong><span>${escHtml(copy)}</span></div>
      <div class="persona-resume-actions">
        <button class="persona-resume-btn primary" type="button" onclick="resumeWork()">${escHtml(isEnLocale() ? "Continue" : "继续")}</button>
        <button class="persona-resume-btn secondary" type="button" onclick="discardWork()">${escHtml(isEnLocale() ? "Discard" : "丢弃")}</button>
      </div>`;
    banner.classList.add("active", "persona-resume-card");
  }
  window.resumeBanner = personaResumeBanner;
  try { resumeBanner = personaResumeBanner; } catch {}

  let typeModalReturnFocus = null;

  async function personaOpenType(type) {
    if (!(await ensureTypeMeQuestions())) return;
    const panel = $id("type-panel");
    const modal = $id("type-modal");
    if (!panel || !modal) return;
    const profile = localizedTypeProfile(type, typeMeQuestions.type_profiles?.[type] || {});
    const fid = familyId(type);
    const familyLabel = familyName(type);
    const note = localizedFamily(fid);
    const tags = axisTags(type);
    const strengths = profile.strengths || [];
    const weaknesses = profile.weaknesses || [];
    const careers = profile.careers || [];
    typeModalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.className = `panel persona-type-panel persona-family-${fid}`;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "persona-type-modal-title");
    panel.setAttribute("tabindex", "-1");
    panel.innerHTML = `
      <button class="persona-type-close" type="button" onclick="closeType()" aria-label="${escHtml(isEnLocale() ? "Close type details" : "关闭类型说明")}" title="${escHtml(isEnLocale() ? "Close" : "关闭")}">×</button>
      <header class="persona-type-modal-head">
        <div class="persona-type-modal-asset">${assetSlot(type, "asset-modal")}</div>
        <div>
          <span class="persona-type-code">${escHtml(type)}</span>
          <p class="persona-type-family">${escHtml(familyLabel)}</p>
          <h2 id="persona-type-modal-title">${escHtml(profile.nickname || type)}</h2>
          <p>${escHtml(profile.description || (isEnLocale() ? "This type description is not finished yet." : "这个类型的说明还没有写完。"))}</p>
          <div class="persona-type-modal-tags">${tags.map((tag) => `<span>${escHtml(tag)}</span>`).join("")}</div>
        </div>
      </header>
      <section class="persona-type-modal-note">
        <span>${escHtml(note.tone || "Persona signal")}</span>
        <p>${escHtml(note.copy || (isEnLocale() ? "This card describes a tendency, not a limit on ability." : "这张卡用于说明类型倾向，不代表能力上限。"))}</p>
      </section>
      <div class="persona-type-modal-grid">
        <section>
          <span>${escHtml(isEnLocale() ? "Strengths that may come easily" : "容易用上的能力")}</span>
          <ul>${strengths.length ? strengths.map((item) => `<li>${escHtml(item)}</li>`).join("") : `<li>${escHtml(isEnLocale() ? "No details yet." : "暂无内容。")}</li>`}</ul>
        </section>
        <section>
          <span>${escHtml(isEnLocale() ? "Habits to watch" : "需要留意的习惯")}</span>
          <ul>${weaknesses.length ? weaknesses.map((item) => `<li>${escHtml(item)}</li>`).join("") : `<li>${escHtml(isEnLocale() ? "No details yet." : "暂无内容。")}</li>`}</ul>
        </section>
      </div>
      ${careers.length ? `<section class="persona-type-modal-careers"><span>${escHtml(isEnLocale() ? "Possible fitting directions" : "可能舒服的方向")}</span><div>${careers.map((item) => `<b>${escHtml(item)}</b>`).join("")}</div></section>` : ""}`;
    modal.classList.add("active", "persona-type-modal");
    document.body.classList.add("persona-modal-open");
    requestAnimationFrame(() => panel.focus({ preventScroll: true }));
  }
  window.openType = personaOpenType;
  try { openType = personaOpenType; } catch {}

  function personaCloseType(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = $id("type-modal");
    if (!modal || !modal.classList.contains("active")) return;
    modal.classList.remove("active", "persona-type-modal");
    document.body.classList.remove("persona-modal-open");
    const returnFocus = typeModalReturnFocus;
    typeModalReturnFocus = null;
    requestAnimationFrame(() => returnFocus?.focus({ preventScroll: true }));
  }
  window.closeType = personaCloseType;
  try { closeType = personaCloseType; } catch {}

  function personaGlobalState() {
    try { return typeof S !== "undefined" ? S : null; } catch { return null; }
  }

  function personaGlobalDims() {
    try { return typeof DIMS !== "undefined" ? DIMS : ["EI", "SN", "TF", "JP", "AT"]; } catch { return ["EI", "SN", "TF", "JP", "AT"]; }
  }

  function personaVerifiedAI(ai, hasAI) {
    if (!hasAI || !ai || ai.ai_available === false || ai.is_fallback) return false;
    return !!(ai.dimension_analysis && Object.keys(ai.dimension_analysis).some((dim) => ai.dimension_analysis[dim] && Object.keys(ai.dimension_analysis[dim]).length));
  }

  function personaDimensionRows(result, labels, ai, verified) {
    const readMeta = sectionMeta("readTip");
    const rows = personaGlobalDims().map((dim) => {
      const item = result.details?.[dim] || {};
      const label = dimensionLabel(dim, labels);
      const verdict = verified ? ai?.dimension_analysis?.[dim]?.verdict : "";
      const pct = Math.max(0, Math.min(100, Number(item.dom_pct || 0)));
      const verdictLabel = isEnLocale()
        ? (verdict === "confirmed" ? "Matched" : verdict === "tension" ? "Tension" : verdict === "flipped" ? "Adjusted" : verdict ? "Needs more" : "")
        : (verdict === "confirmed" ? "吻合" : verdict === "tension" ? "张力" : verdict === "flipped" ? "已修正" : verdict ? "待补充" : "");
      return `
        <article class="persona-coordinate-card">
          <div class="persona-coordinate-head">
            <strong>${escHtml(dim)}</strong>
            <span>${escHtml(label.name || dim)}</span>
          </div>
          <div class="persona-coordinate-meta">
            <b>${escHtml(item.dominant || "")} ${item.dom_pct ?? ""}%</b>
            <b>${escHtml(item.other || "")} ${item.other_pct ?? ""}%</b>
          </div>
          <div class="persona-coordinate-line"><span style="--pct:${pct}%"></span></div>
          <p>${escHtml(label.left_label || "")} / ${escHtml(label.right_label || "")}</p>
           ${verdict ? `<small class="persona-verdict persona-verdict-${escHtml(verdict)}">${verdictLabel}</small>` : ""}
         </article>`;
    }).join("");
    return `${rows}
        <article class="persona-coordinate-card persona-coordinate-tip">
          <div class="persona-coordinate-head">
            <strong>${escHtml(readMeta.kicker)}</strong>
            <span>${escHtml(readMeta.title)}</span>
          </div>
          <p>${escHtml(isEnLocale() ? "The closer a dimension is to 50%, the more useful the open answers become. A far-end value means the scale signal is clearer." : "越接近 50%，越需要结合开放题看；极端比例代表量表倾向更稳定。")}</p>
          <small class="persona-verdict">${escHtml(t("readingNote"))}</small>
        </article>`;
  }

  function personaListBlock(title, items, tone = "", kicker = "NOTES") {
    const list = Array.isArray(items) && items.length ? items : [isEnLocale() ? "Not enough information yet." : "暂无足够信息。"];
    return `
      <section class="persona-result-block ${tone}">
        <span>${escHtml(title || kicker)}</span>
        <ul>${list.map((item) => `<li>${escHtml(item)}</li>`).join("")}</ul>
      </section>`;
  }

  function personaTextBlock(kicker, title, text, tone = "", id = "") {
    if (!text) return "";
    return `
      <section ${id ? `id="${escHtml(id)}"` : ""} class="persona-result-block persona-narrative-block ${tone}">
        <span>${escHtml(title || kicker)}</span>
        <p>${escHtml(text)}</p>
      </section>`;
  }

  function personaWhisper(result, ai) {
    const full = `${result.type}-${result.identity}`;
    if (ai?.secret_letter) {
      return `
        <section class="persona-whisper">
          <span class="persona-whisper-label"><i>♡</i> ${escHtml(t("afterwordLabel"))}</span>
          <h3>${escHtml(secretLetterTitle(full, ai.secret_letter_title))}</h3>
          <div class="persona-whisper-body">
            ${String(ai.secret_letter).split(/\n+/).filter(Boolean).map((line) => `<p>${escHtml(line)}</p>`).join("")}
          </div>
          <small>${escHtml(afterwordNote())}</small>
        </section>`;
    }
    const joiner = isEnLocale() ? ", " : "、";
    const strengths = (ai?.strengths || []).slice(0, 2).join(joiner);
    const growth = (ai?.growth_areas || []).slice(0, 2).join(joiner);
    if (isEnLocale()) {
      return `
        <section class="persona-whisper">
          <span class="persona-whisper-label"><i>♡</i> ${escHtml(t("afterwordLabel"))}</span>
          <h3>A note for you as ${escHtml(full)}</h3>
          <div class="persona-whisper-body">
            <p>This result does not define you. It highlights the reactions, pressures, and choices that appeared most clearly in your answers.</p>
            <p>${strengths ? `Available resources include: ${escHtml(strengths)}.` : "Some strengths need more specific open answers before they can be read well."}</p>
            <p>${growth ? `The parts that may need care include: ${escHtml(growth)}.` : "When a dimension sits near the middle, it usually means your strategy changes with context."}</p>
          </div>
          <small>${escHtml(afterwordNote())}</small>
        </section>`;
    }
    return `
      <section class="persona-whisper">
        <span class="persona-whisper-label"><i>♡</i> ${escHtml(t("afterwordLabel"))}</span>
        <h3>${escHtml(secretLetterTitle(full))}</h3>
        <div class="persona-whisper-body">
          <p>这份结果不是给你贴标签。它只是把你在关系、压力和选择里的习惯，整理成更容易读懂的语言。</p>
          <p>${strengths ? `你已经能调动的资源包括：${escHtml(strengths)}。` : "有些优势需要更具体的开放题才能被准确看见。"}</p>
          <p>${growth ? `需要被温柔照顾的地方包括：${escHtml(growth)}。` : "如果某些维度接近中间，不必急着修正自己；那通常意味着你会随场景切换策略。"}</p>
        </div>
        <small>${escHtml(afterwordNote())}</small>
      </section>`;
  }

  function personaFallbackBlock(hasFallback) {
    const kicker = hasFallback
      ? (isEnLocale() ? "REVIEW STATUS" : "复核状态")
      : (isEnLocale() ? "SCALE RESULT" : "量表结果");
    const title = hasFallback
      ? t("aiUnavailableTitle")
      : (isEnLocale() ? "Your scale result" : "你的量表结果");
    const copy = hasFallback
      ? t("aiUnavailableCopy")
      : (isEnLocale() ? "The scale has produced an initial type. After open answers, TypeMe can compare your real-life choices with the scale coordinates." : "量表已经给出初始类型。继续回答开放题后，系统会把真实场景里的选择和量表坐标放在一起对照。");
    return `
      <section class="persona-result-block persona-result-warning">
        <span>${escHtml(title || kicker)}</span>
        <p>${escHtml(copy)}</p>
      </section>`;
  }

  function personaQualityFlagLabels(flags = {}) {
    const labels = t("qualityFlagLabels") || {};
    return Object.entries(flags)
      .filter(([, count]) => Number(count) > 0)
      .slice(0, 6)
      .map(([flag, count]) => `<span>${escHtml(labels[flag] || flag)} · ${escHtml(count)}</span>`)
      .join("");
  }

  function personaQualitySummaryFromOpenAnswers(openAnswers = {}) {
    const items = Object.values(openAnswers || {});
    const scores = items.map((item) => Number(item?.quality_score || 0)).filter((score) => score > 0);
    const flagCounts = {};
    items.forEach((item) => {
      (item?.quality_flags || []).forEach((flag) => {
        flagCounts[flag] = (flagCounts[flag] || 0) + 1;
      });
    });
    return {
      total_count: items.length,
      valid_count: items.filter((item) => Number(item?.quality_score || 0) >= 45).length,
      average_score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      flag_counts: flagCounts,
    };
  }

  function personaQualityFlags(ai, state) {
    const direct = ai?.quality_flags;
    if (direct?.flag_counts || direct?.items) return direct;
    return personaQualitySummaryFromOpenAnswers(state?.openAnswers || {});
  }

  function personaQualityStatusBlock(ai, verified, state) {
    const flags = personaQualityFlags(ai, state);
    const avg = Number(ai?.answer_quality_score || flags.average_score || 0);
    const valid = Number(flags.valid_count || 0);
    const total = Number(flags.total_count || Object.keys(state?.openAnswers || {}).length || 0);
    const flagChips = personaQualityFlagLabels(flags.flag_counts || {});
    const statusText = verified ? t("credibilityReviewed") : t("credibilityFallback");
    return `
      <section class="persona-sidebar-card persona-quality-status">
        <span>${escHtml(t("credibilityTitle"))}</span>
        <div class="persona-quality-meter" aria-label="${escHtml(t("credibilitySignal"))}">
          <b style="width:${Math.max(0, Math.min(100, avg))}%"></b>
        </div>
        <p><strong>${escHtml(avg ? `${avg}%` : "-")}</strong> · ${escHtml(statusText)}</p>
        <small>${escHtml(t("credibilityValid", valid, total))}</small>
        ${flagChips ? `<div class="persona-quality-flags" aria-label="${escHtml(t("credibilityFlags"))}">${flagChips}</div>` : ""}
      </section>`;
  }

  function personaBuildSamplePayload() {
    const state = personaGlobalState();
    if (!state?.traditional) throw new Error(isEnLocale() ? "There is no result to export yet." : "当前没有可导出的结果");
    const ai = state.ai || {};
    const finalType = ai.final_type || ai.ai_type || `${state.traditional.type}-${state.traditional.identity}`;
    const qualityFlags = personaQualityFlags(ai, state);
    return {
      schema_version: "persona_sample_v1",
      app_version: "persona-reflection-v2",
      client_version: "typeme-web-2026-07",
      question_version: "questions_v2",
      prompt_version: ai.prompt_version || ai.model || "",
      source_locale: typeMeLocale,
      analysis_status: ai.analysis_status || (personaVerifiedAI(ai, !!ai) ? "ai_reviewed" : "fallback"),
      quality_flags: qualityFlags,
      client_sample_id: window.crypto?.randomUUID ? window.crypto.randomUUID() : String(Date.now()),
      created_at: new Date().toISOString(),
      consent: {
        scope: "anonymous_research",
        raw_open_answers: true,
        note: "User explicitly chose to export or contribute this sample.",
      },
      final_type: finalType,
      traditional: state.traditional,
      ai,
      answers: state.answers || [],
      open_answers: state.openAnswers || {},
      selected_questions: state.traditional.selected_questions || [],
      feedback: {},
    };
  }

  function personaDownloadJSON(name, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function personaReportHTML() {
    const state = personaGlobalState();
    if (!state?.traditional) throw new Error(isEnLocale() ? "There is no report to export yet." : "当前没有可导出的报告");
    const result = state.traditional;
    const ai = state.ai || {};
    const verified = personaVerifiedAI(ai, !!ai);
    const finalType = ai.final_type || ai.ai_type || `${result.type}-${result.identity}`;
    const profile = state.questions?.type_profiles?.[String(finalType).slice(0, 4)] || state.questions?.type_profiles?.[result.type] || {};
    const lines = isEnLocale()
      ? [
        ["Type", finalType],
        ["Type note", profile.nickname || ""],
        ["Portrait", ai.portrait || profile.description || ""],
        ["Core tension", ai.core_tension || ""],
        ["Reading", ai.insight || ""],
        ["Afterword", ai.secret_letter || ""],
        [t("scaleStart"), `${result.type}-${result.identity}`],
        ["Analysis status", verified ? "Complete" : "Incomplete"],
      ]
      : [
        ["类型", finalType],
        ["类型说明", profile.nickname || ""],
        ["整体画像", ai.portrait || profile.description || ""],
        ["核心张力", ai.core_tension || ""],
        ["解读", ai.insight || ""],
        ["悄悄话", ai.secret_letter || ""],
        [t("scaleStart"), `${result.type}-${result.identity}`],
        ["分析状态", verified ? "已完成" : "未完成"],
      ];
    const sections = lines
      .filter(([, value]) => String(value || "").trim())
      .map(([label, value]) => `<section><span>${escHtml(label)}</span><p>${escHtml(value)}</p></section>`)
      .join("");
    return `<!doctype html><html lang="${isEnLocale() ? "en" : "zh-CN"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TypeMe ${isEnLocale() ? "Report" : "报告"} ${escHtml(finalType)}</title><style>
      body{margin:0;background:#f5efe5;color:#24211d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif;line-height:1.8}
      main{max-width:880px;margin:0 auto;padding:56px 24px 72px}
      header{padding:36px 0 28px;border-bottom:1px solid rgba(36,33,29,.12)}
      h1{margin:0;font-size:64px;line-height:.95;letter-spacing:-.05em}
      h2{margin:14px 0 0;font-size:22px}
      .meta{margin-top:16px;color:#776f63;font-size:14px}
      section{padding:28px 0;border-bottom:1px solid rgba(36,33,29,.1)}
      span{display:block;margin-bottom:10px;color:#4f9b89;letter-spacing:.02em;font-size:14px;font-weight:700}
      p{margin:0;white-space:pre-wrap;font-size:16px}
      @media print{body{background:#fff}main{padding:28px 0}a{display:none}}
    </style></head><body><main><header><h1>${escHtml(finalType)}</h1><h2>${escHtml(profile.nickname || (isEnLocale() ? "Your result" : "你的测试结果"))}</h2><div class="meta">${escHtml(isEnLocale() ? "Generated by TypeMe" : "由 TypeMe 生成")} · ${new Date().toLocaleString(isEnLocale() ? "en-US" : "zh-CN")}</div></header>${sections}</main></body></html>`;
  }

  function personaDownloadHTML(name, html) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function personaExportReport() {
    try {
      const state = personaGlobalState();
      const finalType = state?.ai?.final_type || state?.ai?.ai_type || `${state?.traditional?.type || "persona"}-${state?.traditional?.identity || ""}`;
      personaDownloadHTML(`persona-report-${String(finalType).toLowerCase()}-${Date.now()}.html`, personaReportHTML());
    } catch (error) {
      if (typeof window.modal === "function") await window.modal(error.message, { title: t("exportErrorTitle"), only: true, ok: t("ok") });
      else alert(error.message);
    }
  }

  async function personaPrintReport() {
    try {
      const html = personaReportHTML();
      const win = window.open("", "_blank", "noopener,noreferrer");
      if (!win) throw new Error(t("printPopupBlocked"));
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.setTimeout(() => win.print(), 350);
    } catch (error) {
      if (typeof window.modal === "function") await window.modal(error.message, { title: t("printErrorTitle"), only: true, ok: t("ok") });
      else alert(error.message);
    }
  }

  async function personaExportSample() {
    try {
      const payload = personaBuildSamplePayload();
      const type = String(payload.final_type || "persona").toLowerCase();
      personaDownloadJSON(`persona-sample-${type}-${Date.now()}.json`, payload);
    } catch (error) {
      if (typeof window.modal === "function") await window.modal(error.message, { title: t("exportErrorTitle"), only: true, ok: t("ok") });
      else alert(error.message);
    }
  }

  async function personaContributeSample() {
    const button = document.querySelector(".persona-result-actions button[onclick='contributePersonaSample()']");
    if (button?.dataset.submitted === "1" || button?.classList.contains("is-busy")) return;
    const oldText = button?.textContent || "";
    try {
      const ok = typeof window.modal === "function"
        ? await window.modal(t("sampleConsentCopy"), {
          title: t("sampleConsentTitle"),
          ok: t("sampleConsentOk"),
        })
        : confirm(t("sampleConsentTitle"));
      if (!ok) return;
      if (button) {
        button.classList.add("is-busy");
        button.disabled = true;
        button.textContent = t("savingSample");
      }
      const payload = personaBuildSamplePayload();
      const response = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || t("sampleSaveFailed"));
      const text = data.stored === "supabase"
        ? t("sampleSavedDb")
        : t("sampleSavedLocal");
      if (button) {
        button.dataset.submitted = "1";
        button.classList.remove("is-busy");
        button.disabled = true;
        button.textContent = t("sampleSubmitted");
      }
      if (typeof window.appToast === "function") window.appToast(text);
      if (typeof window.modal === "function") await window.modal(text, { title: t("sampleSavedTitle"), only: true, ok: t("ok") });
      else alert(text);
    } catch (error) {
      if (button) {
        button.classList.remove("is-busy");
        button.disabled = false;
        button.textContent = oldText;
      }
      if (typeof window.modal === "function") await window.modal(error.message, { title: t("sampleFailedTitle"), only: true, ok: t("ok") });
      else alert(error.message);
    }
  }

  async function personaOpenFeedback() {
    const state = personaGlobalState();
    const type = state?.ai?.final_type || state?.traditional?.type || "";
    const message = window.prompt(t("feedbackPrompt"), "");
    if (!message || !message.trim()) return;
    const body = [
      t("feedbackBodyLabel"),
      message.trim(),
      "",
      t("feedbackPageLabel"),
      `URL: ${location.href}`,
      `${t("feedbackTypeLabel")} ${type || t("feedbackUnknown")}`,
      `${t("feedbackTimeLabel")} ${new Date().toISOString()}`,
      `${t("feedbackBrowserLabel")} ${navigator.userAgent}`,
    ].join("\n");
    const mailto = `mailto:shaogersofia@gmail.com?subject=${encodeURIComponent(t("feedbackSubject"))}&body=${encodeURIComponent(body)}`;
    try {
      await navigator.clipboard?.writeText(body);
    } catch {}
    location.href = mailto;
    if (typeof window.modal === "function") {
      await window.modal(t("feedbackDoneCopy"), {
        title: t("feedbackDoneTitle"),
        only: true,
        ok: t("ok"),
      });
    }
  }
  window.exportPersonaSample = personaExportSample;
  window.contributePersonaSample = personaContributeSample;
  window.personaOpenFeedback = personaOpenFeedback;
  window.exportPersonaReport = personaExportReport;
  window.printPersonaReport = personaPrintReport;

  function personaResultActions(type, verified = false) {
    const meta = sectionMeta("nextSteps");
    const base = String(type || "").toLowerCase();
    const state = personaGlobalState();
    const canContinueOpen = !!state?.traditional?.selected_questions?.length;
    const hasFallback = !!(state?.ai && (state.ai.ai_available === false || state.ai.is_fallback));
    const reportActions = verified
      ? `
        <button class="typeme-action secondary" type="button" onclick="exportPersonaReport()">${escHtml(t("exportReport"))}</button>
        <button class="typeme-action secondary" type="button" onclick="renderBridge()">${escHtml(t("backInitial"))}</button>
        ${state?.ai ? `<button class="typeme-action ghost" type="button" onclick="contributePersonaSample()">${escHtml(t("submitSample"))}</button>` : ""}
        <button class="typeme-action ghost" type="button" onclick="personaOpenFeedback()">${escHtml(t("improve"))}</button>
      `
      : hasFallback
        ? `<button class="typeme-action secondary typeme-retry-analysis" type="button" onclick="retryOpenAnalysis(this)">${escHtml(t("retryAnalysis"))}</button><button class="typeme-action ghost" type="button" onclick="returnToOpenAnswers()">${escHtml(t("returnOpen"))}</button>`
        : `${canContinueOpen ? `<button class="typeme-action secondary" type="button" onclick="startOpen()">${escHtml(t("continueAnalysis"))}</button>` : ""}`;
    return `
      <section class="persona-result-actions">
        <span>${escHtml(meta.title)}</span>
        ${reportActions}
        <button class="typeme-action ghost" type="button" onclick="startTest()">${escHtml(t("restart"))}</button>
        <a class="typeme-action ghost" target="_blank" rel="noopener" href="${escHtml(isEnLocale() ? `https://www.16personalities.com/${base}-personality` : `https://www.16personalities.com/ch/${base}-人格`)}">${escHtml(t("reference16p"))}</a>
      </section>`;
  }

  function personaTraitBoard(type, tags, verified) {
    const indexMeta = sectionMeta("index");
    const cuesMeta = sectionMeta("typeCues");
    const code = String(type || "").slice(0, 4).split("");
    const nav = [
      ["#persona-coordinates", t("navCoordinates")],
      [verified ? "#persona-open-evidence" : "#persona-evidence", verified ? t("navEvidence") : t("navStatus")],
      ["#persona-afterword", t("navAfterword")],
      ["#top", t("navTop")],
    ];
    return `
      <section class="persona-sidebar-card persona-report-nav">
        <span>${escHtml(indexMeta.title)}</span>
        <div>${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}</div>
      </section>
      <section class="persona-sidebar-card persona-trait-board">
        <span>${escHtml(cuesMeta.title)}</span>
        <div class="persona-letter-row">${code.map((letter) => `<b>${escHtml(letter)}</b>`).join("")}</div>
        <div class="persona-trait-list">
          ${tags.map((tag, index) => `<i><em>${String(index + 1).padStart(2, "0")}</em>${escHtml(tag)}</i>`).join("")}
        </div>
      </section>`;
  }

  function personaMobileReportNav(verified) {
    const nav = [
      ["#persona-coordinates", t("navCoordinates")],
      [verified ? "#persona-open-evidence" : "#persona-evidence", verified ? t("navEvidence") : t("navStatus")],
      ["#persona-afterword", t("navAfterword")],
      ["#top", t("navTop")],
    ];
    return `
      <nav class="persona-mobile-report-nav" aria-label="${escHtml(t("resultNavAria"))}">
        ${nav.map(([href, label]) => `<a href="${href}">${label}</a>`).join("")}
      </nav>`;
  }

  function personaRenderResults(hasAI, restored = false) {
    const state = personaGlobalState();
    if (!state?.traditional || !state?.questions) return;
    const result = state.traditional;
    const ai = state.ai;
    const verified = personaVerifiedAI(ai, hasAI);
    const finalTypeText = verified && (ai?.final_type || ai?.ai_type) ? String(ai.final_type || ai.ai_type).toUpperCase() : "";
    const aiMatch = finalTypeText.match(/[IE][SN][TF][JP](?:-[AT])?/);
    const type = aiMatch ? aiMatch[0].slice(0, 4) : result.type;
    const identity = aiMatch && aiMatch[0].includes("-") ? aiMatch[0].slice(-1) : result.identity;
    const full = `${type}-${identity}`;
    const originalFull = `${result.type}-${result.identity}`;
    const profile = localizedTypeProfile(type, state.questions.type_profiles?.[type] || {});
    const labels = state.questions.dimension_labels || {};
    const fid = familyId(type);
    applyTypeTheme(type);
    const note = localizedFamily(fid);
    const tags = axisTags(type);
    const hasFallback = !!(ai && (ai.ai_available === false || ai.is_fallback));
    const confidence = verified && ai?.ai_confidence ? `<span class="persona-profile-chip">${escHtml(isEnLocale() ? "Analysis confidence" : "分析可信度")} ${escHtml(ai.ai_confidence)}%</span>` : "";
    const quality = verified && ai?.answer_quality_score ? `<span class="persona-profile-chip">${escHtml(isEnLocale() ? "Answer detail" : "回答信息量")} ${escHtml(ai.answer_quality_score)}%</span>` : "";
    const heroMeta = sectionMeta("resultHero");
    const coordinateMeta = sectionMeta("coordinates");
    const restoredMeta = sectionMeta("restored");
    const tensionMeta = resultSectionMeta("tension");
    const adjacentMeta = resultSectionMeta("adjacent");
    const portraitMeta = resultSectionMeta("portrait");
    const evidenceMeta = resultSectionMeta("evidence");
    const strengthsMeta = resultSectionMeta("strengths");
    const growthMeta = resultSectionMeta("growth");
    const differencesMeta = resultSectionMeta("differences");

    const evidence = verified ? `
      ${personaTextBlock(tensionMeta.kicker, tensionMeta.title, ai?.core_tension, "persona-core-tension")}
      ${personaTextBlock(adjacentMeta.kicker, adjacentMeta.title, ai?.adjacent_type_notes)}
      ${personaTextBlock(portraitMeta.kicker, portraitMeta.title, ai?.portrait)}
      ${personaTextBlock(evidenceMeta.kicker, evidenceMeta.title, ai?.insight, "", "persona-open-evidence")}
      ${personaListBlock(strengthsMeta.title, ai?.strengths, "persona-result-strength", strengthsMeta.kicker)}
      ${personaListBlock(growthMeta.title, ai?.growth_areas, "persona-result-growth", growthMeta.kicker)}
      ${ai?.differences?.length ? personaListBlock(differencesMeta.title, ai.differences, "persona-result-warning", differencesMeta.kicker) : ""}
    ` : personaFallbackBlock(hasFallback);

    $id("results").innerHTML = `
      <article id="top" class="persona-result-profile persona-family-${fid}">
        <header class="persona-profile-hero">
          <div class="persona-profile-copy">
            <p class="persona-kicker">${escHtml(heroMeta.kicker)}</p>
            <h1>${escHtml(full)}</h1>
            <h2>${escHtml(profile.nickname || familyName(type))}</h2>
            <p>${escHtml(profile.description || t("typeProfileMissing"))}</p>
            <div class="persona-profile-tags">
              <span>${escHtml(familyName(type))}</span>
              ${verified && full !== originalFull ? `<span>${escHtml(t("scaleStart"))} ${escHtml(ai?.traditional_type || originalFull)}</span>` : ""}
              ${tags.map((tag) => `<span>${escHtml(tag)}</span>`).join("")}
              ${confidence}
              ${quality}
            </div>
          </div>
          <aside class="persona-profile-asset">
            ${assetSlot(full, "asset-result")}
            <p>${escHtml(note.tone || "Persona signal")}</p>
          </aside>
        </header>
        ${verified ? personaMobileReportNav(verified) : ""}
        <div class="persona-profile-layout">
          <main class="persona-profile-main">
            <section id="persona-coordinates" class="persona-result-block persona-coordinate-block">
              <span>${escHtml(coordinateMeta.title)}</span>
              <p>${verified ? escHtml(t("coordinatesCopyVerified")) : escHtml(t("coordinatesCopyFallback"))}</p>
              <div class="persona-coordinate-grid">${personaDimensionRows(result, labels, ai, verified)}</div>
            </section>
            <div id="persona-evidence" class="persona-evidence-stack">${evidence}</div>
            <div id="persona-afterword">${verified ? personaWhisper(result, ai) : ""}</div>
          </main>
          <aside class="persona-profile-side">
            ${restored ? `<section class="persona-restored-note"><span>${escHtml(restoredMeta.kicker)}</span><p>${escHtml(t("restoredCopy"))}</p></section>` : ""}
            ${personaQualityStatusBlock(ai, verified, state)}
            ${personaCandidatePanel(result, true)}
            ${verified ? personaTraitBoard(type, tags, verified) : ""}
            ${personaResultActions(type, verified)}
          </aside>
        </div>
      </article>`;
    window.go("results");
  }
  window.renderResults = personaRenderResults;
  try { renderResults = personaRenderResults; } catch {}
  function personaFilterFamily(id) {
    const nextFamily = id === "all" || families[id] ? id : "all";
    if (nextFamily === activeFamily) return;
    activeFamily = nextFamily;
    const screen = $id("screen-library");
    const grid = screen?.querySelector("#types");
    if (!screen || !grid || !typeMeQuestions) {
      renderTypeLibraryPage();
      return;
    }
    screen.querySelectorAll("[data-persona-family]").forEach((button) => {
      const selected = button.dataset.personaFamily === activeFamily;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    grid.innerHTML = renderTypeLibraryCards(typeMeQuestions.type_profiles || {});
  }
  window.filterPersonaFamily = personaFilterFamily;

  function scrollTypeMeReportAnchor(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute("href") || "";
    if (!href.startsWith("#")) return false;
    const target = href === "#top" ? document.body : document.querySelector(href);
    if (!target) return false;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth";
    if (href === "#top") {
      window.scrollTo({ top: 0, behavior });
    } else {
      const header = document.querySelector(".top");
      const headerHeight = header?.getBoundingClientRect?.().height || 0;
      const offset = Math.ceil(headerHeight + 18);
      const targetTop = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior });
    }
    if (window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.hash = href === "#top" ? "" : href;
      window.history.replaceState({ typeMeRoute: "results" }, "", url);
    }
    return true;
  }

  function closeTypeMeLanguageMenu() {
    const switcher = document.querySelector(".typeme-language-switch");
    if (!switcher) return;
    switcher.classList.remove("is-open");
    switcher.querySelector(".typeme-language-button")?.setAttribute("aria-expanded", "false");
    const menu = switcher.querySelector(".typeme-language-menu");
    if (menu) menu.hidden = true;
  }

  function toggleTypeMeLanguageMenu() {
    const switcher = document.querySelector(".typeme-language-switch");
    if (!switcher) return;
    const nextOpen = !switcher.classList.contains("is-open");
    switcher.classList.toggle("is-open", nextOpen);
    switcher.querySelector(".typeme-language-button")?.setAttribute("aria-expanded", String(nextOpen));
    const menu = switcher.querySelector(".typeme-language-menu");
    if (menu) menu.hidden = !nextOpen;
  }

  function rerenderTypeMeLocaleSurface() {
    renderTypeMeChrome(typeMeCurrentRoute);
    if (typeMeCurrentRoute === "home") {
      renderHomeTypePreview();
    } else if (typeMeCurrentRoute === "theory") {
      renderTypeMeMethodPage();
    } else if (typeMeCurrentRoute === "library") {
      renderTypeLibraryPage();
    } else if (typeMeCurrentRoute === "results") {
      const state = personaGlobalState();
      if (state?.traditional && typeof window.renderResults === "function") {
        const verified = typeof window.hasVerifiedAI === "function" ? window.hasVerifiedAI(state.ai) : !!state.ai;
        const restored = !!document.querySelector(".persona-restored-note");
        window.renderResults(verified, restored);
      }
    } else if (typeMeCurrentRoute === "test" && typeof window.renderPage === "function") {
      window.renderPage(window.__typemeScalePage || 0);
    } else if (typeMeCurrentRoute === "bridge" && typeof window.renderBridge === "function") {
      window.renderBridge();
    } else if (typeMeCurrentRoute === "open" && typeof window.renderOpen === "function") {
      window.renderOpen(window.__typemeOpenIndex || 0);
    } else if (typeMeCurrentRoute === "loading") {
      const title = $id("loading-title");
      const copy = $id("loading-copy");
      if (title && copy) {
        title.textContent = t("aiLoadingTitle");
        copy.textContent = t("aiLoadingCopy");
      }
    }
  }

  async function warnIfSavedAnalysisNeedsRegeneration() {
    if (typeMeCurrentRoute !== "results") return;
    const state = personaGlobalState();
    const ai = state?.ai;
    if (!ai) return;
    const expected = isEnLocale() ? "en" : "zh-CN";
    const savedLocale = ai.analysis_locale || "";
    if (savedLocale && savedLocale === expected) return;
    if (savedLocale && savedLocale !== expected && typeof window.modal === "function") {
      await window.modal(t("unsupportedCopy"), {
        title: t("unsupportedTitle"),
        only: true,
        ok: t("ok"),
      });
      return;
    }
    const savedText = [
      ai.insight,
      ai.portrait,
      ai.secret_letter,
      ai.core_tension,
      ai.adjacent_type_notes,
      ...(Array.isArray(ai.strengths) ? ai.strengths : []),
      ...(Array.isArray(ai.growth_areas) ? ai.growth_areas : []),
      ...(Array.isArray(ai.differences) ? ai.differences : []),
    ].filter(Boolean).join("\n");
    const looksChinese = hasCjkText(savedText);
    const looksMismatched = isEnLocale() ? looksChinese : (!!savedText.trim() && !looksChinese);
    if (!looksMismatched) return;
    if (typeof window.modal !== "function") return;
    await window.modal(t("unsupportedCopy"), {
      title: t("unsupportedTitle"),
      only: true,
      ok: t("ok"),
    });
  }

  function setTypeMeLocale(locale) {
    if (!TYPEME_LOCALES.has(locale) || locale === typeMeLocale) return;
    typeMeLocale = locale;
    try { localStorage.setItem(TYPEME_LOCALE_KEY, locale); } catch {}
    closeTypeMeLanguageMenu();
    rerenderTypeMeLocaleSurface();
    if (typeof window.appToast === "function") window.appToast(t("localeChangedToast"));
    warnIfSavedAnalysisNeedsRegeneration();
  }
  window.setTypeMeLocale = setTypeMeLocale;

  document.addEventListener("click", (event) => {
    const langButton = event.target.closest(".typeme-language-button");
    if (langButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleTypeMeLanguageMenu();
      return;
    }
    const localeButton = event.target.closest("[data-typeme-locale]");
    if (localeButton) {
      event.preventDefault();
      event.stopPropagation();
      setTypeMeLocale(localeButton.dataset.typemeLocale || localeButton.dataset.typeMeLocale);
      return;
    }
    const reportAnchor = event.target.closest(".persona-report-nav a[href^='#'], .persona-mobile-report-nav a[href^='#']");
    if (reportAnchor && scrollTypeMeReportAnchor(reportAnchor)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const routeButton = event.target.closest("[data-typeme-route], .tab[data-route], .brand");
    if (routeButton) {
      const route = routeButton.dataset.typemeRoute || routeButton.dataset.typeMeRoute || routeButton.dataset.route || "home";
      if (["home", "theory", "library", "test"].includes(route)) {
        event.preventDefault();
        event.stopPropagation();
        navigateTypeMeRoute(route);
        return;
      }
    }
    const button = event.target.closest("[data-persona-family]");
    if (!button) {
      if (!event.target.closest(".typeme-language-switch")) closeTypeMeLanguageMenu();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    personaFilterFamily(button.dataset.personaFamily || "all");
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTypeMeLanguageMenu();
      personaCloseType();
      return;
    }
    if (event.key === "Tab") {
      const modal = $id("type-modal");
      if (!modal?.classList.contains("active")) return;
      const closeButton = modal.querySelector(".persona-type-close");
      if (!closeButton) return;
      event.preventDefault();
      closeButton.focus();
    }
  });

  async function initializeTypeMeApp() {
    document.body.classList.add("typeme-ui-active");
    const state = personaGlobalState();
    const hashRoute = (window.location.hash || "").slice(1);
    const target = typeMeHistoryRoutes.has(hashRoute)
      ? hashRoute
      : state?.route === "results" && state?.traditional ? "results" : "home";
    const renderedRoute = await typeMeRestoreHistoryRoute(target) || "home";
    typeMeWriteHistory(renderedRoute, "replace");
    return renderedRoute;
  }
  window.initializeTypeMeApp = initializeTypeMeApp;
})();
