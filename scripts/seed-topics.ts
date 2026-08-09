/**
 * P7 种子话题迁移脚本
 * 运行: npx tsx scripts/seed-topics.ts
 *
 * 72 个种子话题 × 3 种语言（zh-CN / zh-HK / en）= 216 行 topic_catalog
 * 仅在 topic_catalog 表为空时插入（幂等保护）
 */

import { getDb } from "../lib/db/index";

interface SeedTopic {
  id: string;
  category: string;
  age_group: string;
  interest_tag: string | null;
  zhCN: { title: string; summary: string; cover_image: string };
  zhHK: { title: string; summary: string; cover_image: string };
  en: { title: string; summary: string; cover_image: string };
}

const SEED_TOPICS: SeedTopic[] = [
  // ═══════ 🔬 探索创造 · 自然科学 ═══════
  {
    id: "seed-nature-01", category: "自然科学", age_group: "6-9", interest_tag: "恐龙",
    zhCN: { title: "恐龙世界", summary: "探索远古巨兽的奇妙世界，认识不同种类的恐龙", cover_image: "🦕" },
    zhHK: { title: "恐龍世界", summary: "探索遠古巨獸的奇妙世界，認識不同種類的恐龍", cover_image: "🦕" },
    en: { title: "Dinosaur World", summary: "Explore the amazing world of prehistoric giants and meet different kinds of dinosaurs", cover_image: "🦕" },
  },
  {
    id: "seed-nature-02", category: "自然科学", age_group: "6-9", interest_tag: null,
    zhCN: { title: "神奇的动物", summary: "从会变色的章鱼到会飞的松鼠，探索动物王国的神奇本领", cover_image: "🐙" },
    zhHK: { title: "神奇的動物", summary: "從會變色的八爪魚到會飛的松鼠，探索動物王國的神奇本領", cover_image: "🐙" },
    en: { title: "Amazing Animals", summary: "From color-changing octopuses to flying squirrels — discover nature's superpowers", cover_image: "🐙" },
  },
  {
    id: "seed-nature-03", category: "自然科学", age_group: "6-9", interest_tag: null,
    zhCN: { title: "天气魔法", summary: "为什么会下雨？彩虹是怎么来的？一起探索天气的奥秘", cover_image: "🌈" },
    zhHK: { title: "天氣魔法", summary: "為什麼會下雨？彩虹是怎樣來的？一起探索天氣的奧秘", cover_image: "🌈" },
    en: { title: "Weather Magic", summary: "Why does it rain? How do rainbows form? Explore the secrets of weather together", cover_image: "🌈" },
  },
  {
    id: "seed-nature-04", category: "自然科学", age_group: "10-12", interest_tag: "太空",
    zhCN: { title: "太阳系漫游", summary: "从水星到海王星，带你游历太阳系八大行星", cover_image: "🪐" },
    zhHK: { title: "太陽系漫遊", summary: "從水星到海王星，帶你遊歷太陽系八大行星", cover_image: "🪐" },
    en: { title: "Solar System Tour", summary: "Journey through all eight planets from Mercury to Neptune", cover_image: "🪐" },
  },
  {
    id: "seed-nature-05", category: "自然科学", age_group: "10-12", interest_tag: null,
    zhCN: { title: "人体奥秘", summary: "你的身体是一座精密的工厂——了解器官如何协作维持生命", cover_image: "🫀" },
    zhHK: { title: "人體奧秘", summary: "你的身體是一座精密的工廠——了解器官如何協作維持生命", cover_image: "🫀" },
    en: { title: "Human Body Mysteries", summary: "Your body is a precision factory — learn how organs work together to keep you alive", cover_image: "🫀" },
  },
  {
    id: "seed-nature-06", category: "自然科学", age_group: "10-12", interest_tag: "海洋",
    zhCN: { title: "海洋深处", summary: "探索深海热泉、发光的生物，以及人类尚未完全了解的神秘世界", cover_image: "🌊" },
    zhHK: { title: "海洋深處", summary: "探索深海熱泉、發光的生物，以及人類尚未完全了解的神秘世界", cover_image: "🌊" },
    en: { title: "Deep Ocean", summary: "Explore hydrothermal vents, glowing creatures, and a mysterious world not yet fully known", cover_image: "🌊" },
  },
  {
    id: "seed-nature-07", category: "自然科学", age_group: "13-15", interest_tag: null,
    zhCN: { title: "量子世界入门", summary: "从双缝实验到量子纠缠，了解微观世界的奇异法则", cover_image: "⚛️" },
    zhHK: { title: "量子世界入門", summary: "從雙縫實驗到量子糾纏，了解微觀世界的奇異法則", cover_image: "⚛️" },
    en: { title: "Intro to Quantum World", summary: "From the double-slit experiment to quantum entanglement — the strange rules of the microscopic", cover_image: "⚛️" },
  },
  {
    id: "seed-nature-08", category: "自然科学", age_group: "13-15", interest_tag: null,
    zhCN: { title: "基因的秘密", summary: "DNA 如何决定你的眼睛颜色？基因编辑技术 CRISPR 又将改变什么？", cover_image: "🧬" },
    zhHK: { title: "基因的秘密", summary: "DNA 如何決定你的眼睛顏色？基因編輯技術 CRISPR 又將改變什麼？", cover_image: "🧬" },
    en: { title: "Secrets of Genes", summary: "How does DNA determine your eye colour? What will gene editing technology CRISPR change?", cover_image: "🧬" },
  },
  {
    id: "seed-nature-09", category: "自然科学", age_group: "13-15", interest_tag: null,
    zhCN: { title: "气候变化", summary: "全球变暖的科学原理、影响，以及我们可以做些什么", cover_image: "🌍" },
    zhHK: { title: "氣候變化", summary: "全球暖化的科學原理、影響，以及我們可以做些什麼", cover_image: "🌍" },
    en: { title: "Climate Change", summary: "The science of global warming, its impacts, and what we can do about it", cover_image: "🌍" },
  },

  // ═══════ 🔬 探索创造 · 技术编程 ═══════
  {
    id: "seed-tech-01", category: "技术编程", age_group: "6-9", interest_tag: null,
    zhCN: { title: "机器人朋友", summary: "认识不同类型的机器人，了解它们如何帮助人类工作与生活", cover_image: "🤖" },
    zhHK: { title: "機械人朋友", summary: "認識不同類型的機械人，了解它們如何幫助人類工作與生活", cover_image: "🤖" },
    en: { title: "Robot Friends", summary: "Meet different types of robots and learn how they help humans work and live", cover_image: "🤖" },
  },
  {
    id: "seed-tech-02", category: "技术编程", age_group: "6-9", interest_tag: null,
    zhCN: { title: "指令游戏", summary: "像给机器人下指令一样思考——学习顺序思维的基础", cover_image: "🎮" },
    zhHK: { title: "指令遊戲", summary: "像給機械人下指令一樣思考——學習順序思維的基礎", cover_image: "🎮" },
    en: { title: "Command Games", summary: "Think like giving instructions to a robot — learn the basics of sequential thinking", cover_image: "🎮" },
  },
  {
    id: "seed-tech-03", category: "技术编程", age_group: "10-12", interest_tag: "编程",
    zhCN: { title: "Scratch大冒险", summary: "用 Scratch 创作你的第一个动画、游戏和互动故事", cover_image: "🐱" },
    zhHK: { title: "Scratch大冒險", summary: "用 Scratch 創作你的第一個動畫、遊戲和互動故事", cover_image: "🐱" },
    en: { title: "Scratch Adventures", summary: "Create your first animations, games, and interactive stories with Scratch", cover_image: "🐱" },
  },
  {
    id: "seed-tech-04", category: "技术编程", age_group: "10-12", interest_tag: "编程",
    zhCN: { title: "APP怎么来的", summary: "从想法到上架——揭秘手机应用是如何被创造出来的", cover_image: "📱" },
    zhHK: { title: "APP點樣嚟", summary: "從想法到上架——揭秘手機應用程式是如何被創造出來的", cover_image: "📱" },
    en: { title: "How Apps Are Made", summary: "From idea to app store — reveal how mobile apps are created", cover_image: "📱" },
  },
  {
    id: "seed-tech-05", category: "技术编程", age_group: "13-15", interest_tag: "编程",
    zhCN: { title: "网页是怎样建成的", summary: "HTML、CSS、JavaScript——构建互联网的三块基石", cover_image: "🌐" },
    zhHK: { title: "網頁是怎樣建成的", summary: "HTML、CSS、JavaScript——構建互聯網的三塊基石", cover_image: "🌐" },
    en: { title: "How Websites Are Built", summary: "HTML, CSS, JavaScript — the three building blocks of the internet", cover_image: "🌐" },
  },
  {
    id: "seed-tech-06", category: "技术编程", age_group: "13-15", interest_tag: null,
    zhCN: { title: "AI是什么", summary: "从图灵测试到大语言模型，理解人工智能的核心概念与发展历程", cover_image: "🧠" },
    zhHK: { title: "AI係咩", summary: "從圖靈測試到大語言模型，理解人工智能的核心概念與發展歷程", cover_image: "🧠" },
    en: { title: "What Is AI", summary: "From the Turing Test to large language models — understand the core concepts and evolution of AI", cover_image: "🧠" },
  },

  // ═══════ 🔬 探索创造 · 视觉艺术 ═══════
  {
    id: "seed-art-01", category: "视觉艺术", age_group: "6-9", interest_tag: "绘画",
    zhCN: { title: "颜色魔法", summary: "红加蓝变紫？探索颜色混合的奇妙世界", cover_image: "🎨" },
    zhHK: { title: "顏色魔法", summary: "紅加藍變紫？探索顏色混合的奇妙世界", cover_image: "🎨" },
    en: { title: "Color Magic", summary: "Red plus blue makes purple? Explore the wonderful world of colour mixing", cover_image: "🎨" },
  },
  {
    id: "seed-art-02", category: "视觉艺术", age_group: "6-9", interest_tag: null,
    zhCN: { title: "泥巴大变身", summary: "用黏土和橡皮泥创造属于你的小世界", cover_image: "🏺" },
    zhHK: { title: "泥巴大變身", summary: "用黏土和橡皮泥創造屬於你的小世界", cover_image: "🏺" },
    en: { title: "Clay Creations", summary: "Use clay and playdough to create your own little world", cover_image: "🏺" },
  },
  {
    id: "seed-art-03", category: "视觉艺术", age_group: "10-12", interest_tag: "绘画",
    zhCN: { title: "漫画入门", summary: "从分镜到角色设计，学习创作属于你自己的漫画", cover_image: "📖" },
    zhHK: { title: "漫畫入門", summary: "從分鏡到角色設計，學習創作屬於你自己的漫畫", cover_image: "📖" },
    en: { title: "Intro to Comics", summary: "From storyboarding to character design — learn to create your own comics", cover_image: "📖" },
  },
  {
    id: "seed-art-04", category: "视觉艺术", age_group: "10-12", interest_tag: null,
    zhCN: { title: "摄影构图", summary: "学会用镜头讲故事——三分法、引导线和光线运用", cover_image: "📷" },
    zhHK: { title: "攝影構圖", summary: "學會用鏡頭講故事——三分法、引導線和光線運用", cover_image: "📷" },
    en: { title: "Photo Composition", summary: "Learn to tell stories with your lens — rule of thirds, leading lines, and lighting", cover_image: "📷" },
  },
  {
    id: "seed-art-05", category: "视觉艺术", age_group: "13-15", interest_tag: null,
    zhCN: { title: "设计思维", summary: "从用户需求到产品原型，学习设计师如何解决问题", cover_image: "💡" },
    zhHK: { title: "設計思維", summary: "從用戶需求到產品原型，學習設計師如何解決問題", cover_image: "💡" },
    en: { title: "Design Thinking", summary: "From user needs to product prototypes — learn how designers solve problems", cover_image: "💡" },
  },
  {
    id: "seed-art-06", category: "视觉艺术", age_group: "13-15", interest_tag: null,
    zhCN: { title: "动画原理", summary: "从翻页动画到 CGI——理解运动影像背后的核心技术", cover_image: "🎬" },
    zhHK: { title: "動畫原理", summary: "從翻頁動畫到CGI——理解運動影像背後的核心技術", cover_image: "🎬" },
    en: { title: "Animation Principles", summary: "From flipbooks to CGI — understand the core techniques behind moving images", cover_image: "🎬" },
  },

  // ═══════ 🔬 探索创造 · 音乐表演 ═══════
  {
    id: "seed-music-01", category: "音乐表演", age_group: "6-9", interest_tag: null,
    zhCN: { title: "声音的秘密", summary: "声音是怎么产生的？为什么不同的乐器有不同的音色？", cover_image: "🔊" },
    zhHK: { title: "聲音的秘密", summary: "聲音是怎樣產生的？為什麼不同的樂器有不同的音色？", cover_image: "🔊" },
    en: { title: "Secrets of Sound", summary: "How is sound produced? Why do different instruments have different timbres?", cover_image: "🔊" },
  },
  {
    id: "seed-music-02", category: "音乐表演", age_group: "6-9", interest_tag: null,
    zhCN: { title: "身体打击乐", summary: "用拍手、跺脚、打响指创造节奏——你的身体就是乐器", cover_image: "👏" },
    zhHK: { title: "身體打擊樂", summary: "用拍手、跺腳、打響指創造節奏——你的身體就是樂器", cover_image: "👏" },
    en: { title: "Body Percussion", summary: "Create rhythms with claps, stomps, and snaps — your body is the instrument", cover_image: "👏" },
  },
  {
    id: "seed-music-03", category: "音乐表演", age_group: "10-12", interest_tag: null,
    zhCN: { title: "认识乐器家族", summary: "弦乐、管乐、打击乐——了解交响乐团里的四个乐器家族", cover_image: "🎻" },
    zhHK: { title: "認識樂器家族", summary: "弦樂、管樂、打擊樂——了解交響樂團裏的四個樂器家族", cover_image: "🎻" },
    en: { title: "Meet the Instrument Families", summary: "Strings, winds, percussion — discover the four instrument families of an orchestra", cover_image: "🎻" },
  },
  {
    id: "seed-music-04", category: "音乐表演", age_group: "10-12", interest_tag: null,
    zhCN: { title: "节奏创作", summary: "学习节拍基础，创作你自己的节奏模式", cover_image: "🥁" },
    zhHK: { title: "節奏創作", summary: "學習節拍基礎，創作你自己的節奏模式", cover_image: "🥁" },
    en: { title: "Rhythm Crafting", summary: "Learn the basics of beat and create your own rhythm patterns", cover_image: "🥁" },
  },
  {
    id: "seed-music-05", category: "音乐表演", age_group: "13-15", interest_tag: null,
    zhCN: { title: "音乐制作入门", summary: "用免费数字音频工作站 DAW 创作你的第一首电子音乐", cover_image: "🎹" },
    zhHK: { title: "音樂製作入門", summary: "用免費數碼音頻工作站 DAW 創作你的第一首電子音樂", cover_image: "🎹" },
    en: { title: "Intro to Music Production", summary: "Create your first electronic track with free digital audio workstations", cover_image: "🎹" },
  },
  {
    id: "seed-music-06", category: "音乐表演", age_group: "13-15", interest_tag: null,
    zhCN: { title: "歌曲结构分析", summary: "主歌、副歌、桥段——解构流行歌曲的创作公式", cover_image: "🎵" },
    zhHK: { title: "歌曲結構分析", summary: "主歌、副歌、橋段——解構流行歌曲的創作公式", cover_image: "🎵" },
    en: { title: "Song Structure Analysis", summary: "Verse, chorus, bridge — deconstruct the formula behind pop songs", cover_image: "🎵" },
  },

  // ═══════ 📚 文化根基 · 历史长廊 ═══════
  {
    id: "seed-history-01", category: "历史长廊", age_group: "6-9", interest_tag: null,
    zhCN: { title: "如果生活在古代", summary: "没有手机、没有电的古代，小朋友的一天是怎么过的？", cover_image: "🏛️" },
    zhHK: { title: "如果生活在古代", summary: "沒有手機、沒有電的古代，小朋友的一天是怎樣過的？", cover_image: "🏛️" },
    en: { title: "Life in Ancient Times", summary: "No phones, no electricity — what was a child's day like in ancient times?", cover_image: "🏛️" },
  },
  {
    id: "seed-history-02", category: "历史长廊", age_group: "6-9", interest_tag: null,
    zhCN: { title: "四大发明", summary: "造纸术、指南针、火药、印刷术——改变世界的四个中国发明", cover_image: "📜" },
    zhHK: { title: "四大發明", summary: "造紙術、指南針、火藥、印刷術——改變世界的四個中國發明", cover_image: "📜" },
    en: { title: "The Four Great Inventions", summary: "Paper, compass, gunpowder, printing — four Chinese inventions that changed the world", cover_image: "📜" },
  },
  {
    id: "seed-history-03", category: "历史长廊", age_group: "10-12", interest_tag: null,
    zhCN: { title: "丝绸之路", summary: "跟随商队的足迹，穿越连接东方与西方千年的贸易网络", cover_image: "🐪" },
    zhHK: { title: "絲綢之路", summary: "跟隨商隊的足跡，穿越連接東方與西方千年的貿易網絡", cover_image: "🐪" },
    en: { title: "The Silk Road", summary: "Follow the footsteps of caravans across the millennium-old trade network linking East and West", cover_image: "🐪" },
  },
  {
    id: "seed-history-04", category: "历史长廊", age_group: "10-12", interest_tag: null,
    zhCN: { title: "古罗马兴衰", summary: "从一个城邦到庞大帝国——罗马如何崛起，又为何衰落？", cover_image: "🏟️" },
    zhHK: { title: "古羅馬興衰", summary: "從一個城邦到龐大帝國——羅馬如何崛起，又為何衰落？", cover_image: "🏟️" },
    en: { title: "Rise and Fall of Rome", summary: "From city-state to vast empire — how did Rome rise and why did it fall?", cover_image: "🏟️" },
  },
  {
    id: "seed-history-05", category: "历史长廊", age_group: "13-15", interest_tag: null,
    zhCN: { title: "文明的碰撞", summary: "哥伦布抵达美洲后——两种文明的相遇如何重塑了世界格局", cover_image: "⛵" },
    zhHK: { title: "文明的碰撞", summary: "哥倫布抵達美洲後——兩種文明的相遇如何重塑了世界格局", cover_image: "⛵" },
    en: { title: "Clash of Civilisations", summary: "After Columbus reached the Americas — how two worlds collided and reshaped the globe", cover_image: "⛵" },
  },
  {
    id: "seed-history-06", category: "历史长廊", age_group: "13-15", interest_tag: null,
    zhCN: { title: "二十世纪改变世界的十件事", summary: "从世界大战争到互联网——回顾塑造现代世界的十个关键事件", cover_image: "📰" },
    zhHK: { title: "二十世紀改變世界的十件事", summary: "從世界大戰到互聯網——回顧塑造現代世界的十個關鍵事件", cover_image: "📰" },
    en: { title: "10 Events That Changed the 20th Century", summary: "From world wars to the internet — ten key events that shaped the modern world", cover_image: "📰" },
  },

  // ═══════ 📚 文化根基 · 国学经典 ═══════
  {
    id: "seed-guoxue-01", category: "国学经典", age_group: "6-9", interest_tag: null,
    zhCN: { title: "成语里的故事", summary: "每个成语背后都藏着一个精彩的故事——一起来成语王国探险", cover_image: "📚" },
    zhHK: { title: "成語裏的故事", summary: "每個成語背後都藏着一個精彩的故事——一起來成語王國探險", cover_image: "📚" },
    en: { title: "Stories Behind Chinese Idioms", summary: "Every Chinese idiom hides a wonderful story — let's explore the idiom kingdom", cover_image: "📚" },
  },
  {
    id: "seed-guoxue-02", category: "国学经典", age_group: "6-9", interest_tag: null,
    zhCN: { title: "孔子的智慧", summary: "两千多年前的老师孔子，说了哪些至今仍有用的话？", cover_image: "🎓" },
    zhHK: { title: "孔子的智慧", summary: "兩千多年前的老師孔子，說了些至今仍有用的話？", cover_image: "🎓" },
    en: { title: "Wisdom of Confucius", summary: "What did the great teacher Confucius say over 2,000 years ago that is still useful today?", cover_image: "🎓" },
  },
  {
    id: "seed-guoxue-03", category: "国学经典", age_group: "10-12", interest_tag: null,
    zhCN: { title: "三十六计", summary: "从\"瞒天过海\"到\"走为上计\"——古代兵法的智慧在今天的应用", cover_image: "⚔️" },
    zhHK: { title: "三十六計", summary: "從「瞞天過海」到「走為上計」——古代兵法的智慧在今天的應用", cover_image: "⚔️" },
    en: { title: "The 36 Stratagems", summary: "From 'Deceive the Heavens' to 'Retreat Is the Best Option' — ancient strategic wisdom for modern life", cover_image: "⚔️" },
  },
  {
    id: "seed-guoxue-04", category: "国学经典", age_group: "10-12", interest_tag: null,
    zhCN: { title: "古文小故事", summary: "阅读短小精悍的古文名篇，感受文言文的韵律之美", cover_image: "📖" },
    zhHK: { title: "古文小故事", summary: "閱讀短小精悍的古文名篇，感受文言文的韻律之美", cover_image: "📖" },
    en: { title: "Classical Chinese Tales", summary: "Read short and elegant classical Chinese texts and appreciate the beauty of literary rhythm", cover_image: "📖" },
  },
  {
    id: "seed-guoxue-05", category: "国学经典", age_group: "13-15", interest_tag: null,
    zhCN: { title: "老庄哲学入门", summary: "无为而治、逍遥游——理解道家思想的核心主张", cover_image: "☯️" },
    zhHK: { title: "老莊哲學入門", summary: "無為而治、逍遙遊——理解道家思想的核心主張", cover_image: "☯️" },
    en: { title: "Intro to Daoist Philosophy", summary: "Wu Wei, the Carefree Journey — understand the core ideas of Daoist thought", cover_image: "☯️" },
  },
  {
    id: "seed-guoxue-06", category: "国学经典", age_group: "13-15", interest_tag: null,
    zhCN: { title: "资治通鉴选读", summary: "从三家分晋到安史之乱——历史长河中的治理智慧", cover_image: "📜" },
    zhHK: { title: "資治通鑑選讀", summary: "從三家分晉到安史之亂——歷史長河中的治理智慧", cover_image: "📜" },
    en: { title: "Zizhi Tongjian Selections", summary: "From the Partition of Jin to the An Lushan Rebellion — governance wisdom across history", cover_image: "📜" },
  },

  // ═══════ 📚 文化根基 · 诗词歌赋 ═══════
  {
    id: "seed-poetry-01", category: "诗词歌赋", age_group: "6-9", interest_tag: null,
    zhCN: { title: "跟着唐诗去旅行", summary: "读一首诗，看一处风景——唐诗里的山水和远方", cover_image: "⛰️" },
    zhHK: { title: "跟着唐詩去旅行", summary: "讀一首詩，看一處風景——唐詩裏的山水和遠方", cover_image: "⛰️" },
    en: { title: "Travel with Tang Poems", summary: "Read a poem, see a landscape — mountains, rivers, and faraway places in Tang Dynasty poetry", cover_image: "⛰️" },
  },
  {
    id: "seed-poetry-02", category: "诗词歌赋", age_group: "6-9", interest_tag: null,
    zhCN: { title: "宋词里的四季", summary: "春天花开、夏夜蝉鸣——宋词怎样描绘大自然的四季变化", cover_image: "🌸" },
    zhHK: { title: "宋詞裏的四季", summary: "春天花開、夏夜蟬鳴——宋詞怎樣描繪大自然的四季變化", cover_image: "🌸" },
    en: { title: "Four Seasons in Song Lyrics", summary: "Spring blossoms, summer cicadas — how Song Dynasty lyrics depict nature's four seasons", cover_image: "🌸" },
  },
  {
    id: "seed-poetry-03", category: "诗词歌赋", age_group: "10-12", interest_tag: null,
    zhCN: { title: "李白与杜甫", summary: "诗仙与诗圣——两位最伟大的唐代诗人，他们的人生与作品", cover_image: "🍶" },
    zhHK: { title: "李白與杜甫", summary: "詩仙與詩聖——兩位最偉大的唐代詩人，他們的人生與作品", cover_image: "🍶" },
    en: { title: "Li Bai and Du Fu", summary: "The Immortal Poet and the Sage Poet — the lives and works of Tang's two greatest poets", cover_image: "🍶" },
  },
  {
    id: "seed-poetry-04", category: "诗词歌赋", age_group: "10-12", interest_tag: null,
    zhCN: { title: "词牌里的故事", summary: "水调歌头、蝶恋花——每个词牌名背后都有动人的故事", cover_image: "🎶" },
    zhHK: { title: "詞牌裏的故事", summary: "水調歌頭、蝶戀花——每個詞牌名背後都有動人的故事", cover_image: "🎶" },
    en: { title: "Stories of Ci Tune Names", summary: "Each classical Chinese lyric tune name holds a moving story behind it", cover_image: "🎶" },
  },
  {
    id: "seed-poetry-05", category: "诗词歌赋", age_group: "13-15", interest_tag: null,
    zhCN: { title: "古典诗词鉴赏", summary: "学习格律、意象与用典——掌握深度赏析古诗词的方法", cover_image: "📝" },
    zhHK: { title: "古典詩詞鑒賞", summary: "學習格律、意象與用典——掌握深度賞析古詩詞的方法", cover_image: "📝" },
    en: { title: "Classical Poetry Appreciation", summary: "Learn metre, imagery, and allusion — master the art of deep poetry analysis", cover_image: "📝" },
  },
  {
    id: "seed-poetry-06", category: "诗词歌赋", age_group: "13-15", interest_tag: null,
    zhCN: { title: "现代诗创作", summary: "打破格律的束缚——用自由诗表达属于我们这个时代的声音", cover_image: "✒️" },
    zhHK: { title: "現代詩創作", summary: "打破格律的束縛——用自由詩表達屬於我們這個時代的聲音", cover_image: "✒️" },
    en: { title: "Writing Modern Poetry", summary: "Break free from metre — use free verse to express the voice of our time", cover_image: "✒️" },
  },

  // ═══════ 📚 文化根基 · 中医智慧 ═══════
  {
    id: "seed-tcm-01", category: "中医智慧", age_group: "6-9", interest_tag: null,
    zhCN: { title: "身体里的小卫士", summary: "中医说身体里有\"正气\"保护我们——它和免疫力是什么关系？", cover_image: "🛡️" },
    zhHK: { title: "身體裏的小衞士", summary: "中醫說身體裏有「正氣」保護我們——它和免疫力是什麼關係？", cover_image: "🛡️" },
    en: { title: "Your Body's Little Guardians", summary: "Chinese medicine says 'Zheng Qi' protects us — how does it relate to immunity?", cover_image: "🛡️" },
  },
  {
    id: "seed-tcm-02", category: "中医智慧", age_group: "6-9", interest_tag: null,
    zhCN: { title: "神奇的中草药", summary: "薄荷清凉、生姜温热——认识身边常见中草药的性味与功用", cover_image: "🌿" },
    zhHK: { title: "神奇的中草藥", summary: "薄荷清涼、生薑溫熱——認識身邊常見中草藥的性味與功用", cover_image: "🌿" },
    en: { title: "Magical Chinese Herbs", summary: "Mint is cooling, ginger is warming — discover the properties and uses of common herbs", cover_image: "🌿" },
  },
  {
    id: "seed-tcm-03", category: "中医智慧", age_group: "10-12", interest_tag: null,
    zhCN: { title: "经络与穴位", summary: "人体内的\"高速公路\"——认识经络系统和重要保健穴位", cover_image: "🔬" },
    zhHK: { title: "經絡與穴位", summary: "人體內的「高速公路」——認識經絡系統和重要保健穴位", cover_image: "🔬" },
    en: { title: "Meridians and Acupoints", summary: "The 'highways' inside your body — discover the meridian system and key health points", cover_image: "🔬" },
  },
  {
    id: "seed-tcm-04", category: "中医智慧", age_group: "10-12", interest_tag: null,
    zhCN: { title: "饮食与节气", summary: "为什么冬天要吃萝卜，夏天要喝绿豆汤？——节气饮食的科学", cover_image: "🍲" },
    zhHK: { title: "飲食與節氣", summary: "為什麼冬天要吃蘿蔔，夏天要喝綠豆湯？——節氣飲食的科學", cover_image: "🍲" },
    en: { title: "Food and the Solar Terms", summary: "Why eat radish in winter and mung bean soup in summer? The science of seasonal eating", cover_image: "🍲" },
  },
  {
    id: "seed-tcm-05", category: "中医智慧", age_group: "13-15", interest_tag: null,
    zhCN: { title: "中医基础理论", summary: "阴阳、五行、藏象——理解中医认识人体的独特框架", cover_image: "☯️" },
    zhHK: { title: "中醫基礎理論", summary: "陰陽、五行、藏象——理解中醫認識人體的獨特框架", cover_image: "☯️" },
    en: { title: "Fundamentals of Chinese Medicine", summary: "Yin-Yang, Five Elements, Organ Systems — the unique framework for understanding the human body", cover_image: "☯️" },
  },
  {
    id: "seed-tcm-06", category: "中医智慧", age_group: "13-15", interest_tag: null,
    zhCN: { title: "中西医对话", summary: "同一个疾病，两种不同的诊断思路——比较中西医的思维方式", cover_image: "🏥" },
    zhHK: { title: "中西醫對話", summary: "同一個疾病，兩種不同的診斷思路——比較中西醫的思維方式", cover_image: "🏥" },
    en: { title: "East-West Medical Dialogue", summary: "Same illness, two diagnostic approaches — comparing Chinese and Western medical thinking", cover_image: "🏥" },
  },

  // ═══════ 🎯 学业赋能 · 中文精进 ═══════
  {
    id: "seed-chinese-01", category: "中文精进", age_group: "6-9", interest_tag: null,
    zhCN: { title: "汉字的故事", summary: "每个汉字都是一幅画——从甲骨文到楷书的演变之旅", cover_image: "🔤" },
    zhHK: { title: "漢字的故事", summary: "每個漢字都是一幅畫——從甲骨文到楷書的演變之旅", cover_image: "🔤" },
    en: { title: "Stories of Chinese Characters", summary: "Every character is a picture — a journey from oracle bone script to regular script", cover_image: "🔤" },
  },
  {
    id: "seed-chinese-02", category: "中文精进", age_group: "6-9", interest_tag: null,
    zhCN: { title: "有趣的部首", summary: "\"氵\"和\"火\"——认识偏旁部首，轻松猜汉字的意思", cover_image: "🔍" },
    zhHK: { title: "有趣的部首", summary: "「氵」和「火」——認識偏旁部首，輕鬆估漢字的意思", cover_image: "🔍" },
    en: { title: "Fun with Radicals", summary: "Water radical and fire radical — learn character components to guess meanings easily", cover_image: "🔍" },
  },
  {
    id: "seed-chinese-03", category: "中文精进", age_group: "6-9", interest_tag: null,
    zhCN: { title: "看图说故事", summary: "观察图片细节，组织语言——培养口语表达和叙事能力", cover_image: "🖼️" },
    zhHK: { title: "看圖說故事", summary: "觀察圖片細節，組織語言——培養口語表達和敘事能力", cover_image: "🖼️" },
    en: { title: "Picture Storytelling", summary: "Observe details in pictures and organise your thoughts — build oral expression and narrative skills", cover_image: "🖼️" },
  },
  {
    id: "seed-chinese-04", category: "中文精进", age_group: "10-12", interest_tag: null,
    zhCN: { title: "阅读理解大揭秘", summary: "找主旨、理结构、抓细节——掌握阅读理解的关键策略", cover_image: "📖" },
    zhHK: { title: "閱讀理解大揭秘", summary: "找主旨、理結構、抓細節——掌握閱讀理解的關鍵策略", cover_image: "📖" },
    en: { title: "Reading Comprehension Secrets", summary: "Find the main idea, map the structure, catch the details — key strategies for reading comprehension", cover_image: "📖" },
  },
  {
    id: "seed-chinese-05", category: "中文精进", age_group: "10-12", interest_tag: null,
    zhCN: { title: "作文小达人", summary: "从写清楚到写精彩——掌握记叙文、说明文的写作技巧", cover_image: "✏️" },
    zhHK: { title: "作文小達人", summary: "從寫清楚到寫精彩——掌握記敘文、說明文的寫作技巧", cover_image: "✏️" },
    en: { title: "Young Writing Pro", summary: "From clear to compelling — master narrative and expository writing techniques", cover_image: "✏️" },
  },
  {
    id: "seed-chinese-06", category: "中文精进", age_group: "10-12", interest_tag: null,
    zhCN: { title: "成语活用术", summary: "不只背诵成语，更学会在说话和写作中灵活运用成语", cover_image: "📝" },
    zhHK: { title: "成語活用術", summary: "不只背誦成語，更學會在說話和寫作中靈活運用成語", cover_image: "📝" },
    en: { title: "Idiom Mastery", summary: "Beyond memorisation — learn to use Chinese idioms naturally in speech and writing", cover_image: "📝" },
  },

  // ═══════ 🎯 学业赋能 · 英文探索 ═══════
  {
    id: "seed-english-01", category: "英文探索", age_group: "6-9", interest_tag: null,
    zhCN: { title: "My First Story", summary: "用简单的英文句子创作属于你的第一本英文绘本故事", cover_image: "📕" },
    zhHK: { title: "My First Story", summary: "用簡單的英文句子創作屬於你的第一本英文繪本故事", cover_image: "📕" },
    en: { title: "My First Story", summary: "Create your very first English picture book story with simple sentences", cover_image: "📕" },
  },
  {
    id: "seed-english-02", category: "英文探索", age_group: "6-9", interest_tag: null,
    zhCN: { title: "Fun with Phonics", summary: "通过好玩的发音游戏，掌握英语自然拼读的规律", cover_image: "🔊" },
    zhHK: { title: "Fun with Phonics", summary: "通過好玩的發音遊戲，掌握英語自然拼讀的規律", cover_image: "🔊" },
    en: { title: "Fun with Phonics", summary: "Master English phonics patterns through playful sound games", cover_image: "🔊" },
  },
  {
    id: "seed-english-03", category: "英文探索", age_group: "10-12", interest_tag: null,
    zhCN: { title: "Reading Detectives", summary: "像侦探一样阅读——学会预测、推断和归纳英文文章内容", cover_image: "🔎" },
    zhHK: { title: "Reading Detectives", summary: "像偵探一樣閱讀——學會預測、推斷和歸納英文文章內容", cover_image: "🔎" },
    en: { title: "Reading Detectives", summary: "Read like a detective — learn to predict, infer, and summarise English texts", cover_image: "🔎" },
  },
  {
    id: "seed-english-04", category: "英文探索", age_group: "10-12", interest_tag: null,
    zhCN: { title: "Creative Writing", summary: "从日记到短篇故事——用英文表达你的想象力和观点", cover_image: "✍️" },
    zhHK: { title: "Creative Writing", summary: "從日記到短篇故事——用英文表達你的想像力和觀點", cover_image: "✍️" },
    en: { title: "Creative Writing", summary: "From journal entries to short stories — express your imagination and opinions in English", cover_image: "✍️" },
  },
  {
    id: "seed-english-05", category: "英文探索", age_group: "10-12", interest_tag: null,
    zhCN: { title: "Speak & Shine", summary: "克服开口恐惧——实用的英语口语练习和演讲技巧", cover_image: "🎤" },
    zhHK: { title: "Speak & Shine", summary: "克服開口恐懼——實用的英語口語練習和演講技巧", cover_image: "🎤" },
    en: { title: "Speak & Shine", summary: "Overcome the fear of speaking — practical oral English practice and presentation skills", cover_image: "🎤" },
  },

  // ═══════ 🎯 学业赋能 · 数学思维 ═══════
  {
    id: "seed-math-01", category: "数学思维", age_group: "6-9", interest_tag: null,
    zhCN: { title: "生活中的数学", summary: "超市购物、搭积木、分糖果——数学就在你身边", cover_image: "🛒" },
    zhHK: { title: "生活中的數學", summary: "超市購物、砌積木、分糖果——數學就在你身邊", cover_image: "🛒" },
    en: { title: "Math in Everyday Life", summary: "Supermarket shopping, building blocks, sharing sweets — maths is all around you", cover_image: "🛒" },
  },
  {
    id: "seed-math-02", category: "数学思维", age_group: "6-9", interest_tag: null,
    zhCN: { title: "图形魔法师", summary: "认识三角形、正方形和圆——用几何图形拼出无限创意", cover_image: "🔺" },
    zhHK: { title: "圖形魔法師", summary: "認識三角形、正方形和圓——用幾何圖形拼出無限創意", cover_image: "🔺" },
    en: { title: "Shape Wizard", summary: "Meet triangles, squares, and circles — create infinite designs with geometric shapes", cover_image: "🔺" },
  },
  {
    id: "seed-math-03", category: "数学思维", age_group: "10-12", interest_tag: null,
    zhCN: { title: "应用题解密", summary: "把文字变成算式——学会用画图、列表、倒推等方法拆解应用题", cover_image: "🧩" },
    zhHK: { title: "應用題解密", summary: "把文字變成算式——學會用畫圖、列表、倒推等方法拆解應用題", cover_image: "🧩" },
    en: { title: "Word Problem Decoder", summary: "Turn words into equations — learn to break down word problems with diagrams, tables, and working backwards", cover_image: "🧩" },
  },
  {
    id: "seed-math-04", category: "数学思维", age_group: "10-12", interest_tag: null,
    zhCN: { title: "速算与估算", summary: "巧算技巧和估算方法——让计算更快，让检查更容易", cover_image: "⚡" },
    zhHK: { title: "速算與估算", summary: "巧算技巧和估算方法——讓計算更快，讓檢查更容易", cover_image: "⚡" },
    en: { title: "Speed and Estimation", summary: "Clever calculation tricks and estimation methods — compute faster, check easier", cover_image: "⚡" },
  },
  {
    id: "seed-math-05", category: "数学思维", age_group: "10-12", interest_tag: null,
    zhCN: { title: "逻辑推理训练", summary: "数独、逻辑谜题、推理游戏——锻炼你的逻辑思维能力", cover_image: "🧠" },
    zhHK: { title: "邏輯推理訓練", summary: "數獨、邏輯謎題、推理遊戲——鍛煉你的邏輯思維能力", cover_image: "🧠" },
    en: { title: "Logic Training", summary: "Sudoku, logic puzzles, deduction games — train your logical thinking skills", cover_image: "🧠" },
  },

  // ═══════ 🎯 学业赋能 · 综合能力 ═══════
  {
    id: "seed-study-01", category: "综合能力", age_group: "6-9", interest_tag: null,
    zhCN: { title: "我的时间我做主", summary: "学会用时间表安排一天的活动——培养时间管理好习惯", cover_image: "⏰" },
    zhHK: { title: "我的時間我做主", summary: "學會用時間表安排一天的活動——培養時間管理好習慣", cover_image: "⏰" },
    en: { title: "My Time, My Plan", summary: "Learn to schedule your day with a timetable — build good time management habits", cover_image: "⏰" },
  },
  {
    id: "seed-study-02", category: "综合能力", age_group: "6-9", interest_tag: null,
    zhCN: { title: "专注力训练营", summary: "通过好玩的注意力游戏，提升听课和做事的专注力", cover_image: "🎯" },
    zhHK: { title: "專注力訓練營", summary: "通過好玩的注意力遊戲，提升聽課和做事的專注力", cover_image: "🎯" },
    en: { title: "Focus Training Camp", summary: "Boost concentration in class and tasks through fun attention games", cover_image: "🎯" },
  },
  {
    id: "seed-study-03", category: "综合能力", age_group: "10-12", interest_tag: null,
    zhCN: { title: "考试不发慌", summary: "考前紧张很正常——学会管理考试焦虑，从容面对测验", cover_image: "😌" },
    zhHK: { title: "考試唔會慌", summary: "考前緊張好正常——學會管理考試焦慮，從容面對測驗", cover_image: "😌" },
    en: { title: "Stay Cool for Exams", summary: "Pre-exam nerves are normal — learn to manage test anxiety and stay confident", cover_image: "😌" },
  },
  {
    id: "seed-study-04", category: "综合能力", age_group: "10-12", interest_tag: null,
    zhCN: { title: "笔记术入门", summary: "康奈尔笔记法、思维导图——学会高效整理和复习课堂知识", cover_image: "📒" },
    zhHK: { title: "筆記術入門", summary: "康奈爾筆記法、思維導圖——學會高效整理和複習課堂知識", cover_image: "📒" },
    en: { title: "Intro to Note-Taking", summary: "Cornell method, mind maps — learn to organise and review class knowledge efficiently", cover_image: "📒" },
  },
  {
    id: "seed-study-05", category: "综合能力", age_group: "10-12", interest_tag: null,
    zhCN: { title: "错题本管理", summary: "把做错的题变成进步的阶梯——建立和管理你的错题本", cover_image: "📊" },
    zhHK: { title: "錯題本管理", summary: "把做錯的題變成進步的階梯——建立和管理你的錯題本", cover_image: "📊" },
    en: { title: "Error Log Mastery", summary: "Turn mistakes into stepping stones — build and manage your error logbook", cover_image: "📊" },
  },
];

// ─── 执行迁移 ───────────────────────────────────────────────────

function seedTopics(): void {
  const db = getDb();

  const row = db.prepare("SELECT COUNT(*) as count FROM topic_catalog").get() as { count: number };
  if (row.count > 0) {
    console.log(`topic_catalog 已有 ${row.count} 条记录，跳过种子数据插入（幂等保护）`);
    return;
  }

  const now = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const insert = db.prepare(`
    INSERT INTO topic_catalog (id, title, summary, cover_image, category, age_group, language, interest_tag, source, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed', 0, 1, ?, ?)
  `);

  const insertMany = db.transaction((topics: typeof SEED_TOPICS) => {
    const languages = ["zhCN", "zhHK", "en"] as const;
    const langCodes: Record<string, string> = { zhCN: "zh-CN", zhHK: "zh-HK", en: "en" };

    let count = 0;
    for (const t of topics) {
      for (const langKey of languages) {
        const locale = t[langKey];
        insert.run(
          `${t.id}-${langCodes[langKey]}`,
          locale.title,
          locale.summary,
          locale.cover_image,
          t.category,
          t.age_group,
          langCodes[langKey],
          t.interest_tag,
          now,
          now,
        );
        count++;
      }
    }
    return count;
  });

  const inserted = insertMany(SEED_TOPICS);
  console.log(`种子话题导入完成：${inserted} 条记录（${SEED_TOPICS.length} 话题 × 3 种语言）`);
}

seedTopics();
