/* AI 诗人 · 数据层
 * 内容对应课件 Lecture V9 第 30 讲「人工智能诗人」 */

/* 一、古代诗词分类（课件思维导图） */
const POETRY_CATEGORIES = [
  {
    name: '古体诗',
    tone: 'blue',
    children: ['四言', '五言', '六言', '七言', '杂言'],
    note: '形式较自由，不严格要求平仄与对仗。'
  },
  {
    name: '近体诗',
    tone: 'purple',
    groups: [
      { label: '律诗', items: ['五律', '七律'] },
      { label: '绝句', items: ['五绝', '七绝'] }
    ],
    note: '字数、句数、押韵、平仄都有严格规定；本项目的七言绝句即四句 28 字。'
  },
  {
    name: '词',
    tone: 'green',
    children: ['长调', '中调', '小令'],
    note: '依词牌填字，句式长短不一。'
  },
  {
    name: '曲',
    tone: 'orange',
    groups: [
      { label: '散曲', items: ['小令', '套数'] },
      { label: '杂剧', items: ['折子'] }
    ],
    note: '可加衬字，语言更接近口语。'
  }
];

/* 二、方法演进时间线 */
const METHOD_TIMELINE = [
  {
    year: '早期',
    name: '拼贴法',
    desc: '把已有诗句打碎重组。能从旧句里拼出通顺句子，但整首诗的意象常常不连贯。',
    tag: '符号拼接'
  },
  {
    year: '统计法',
    name: '共现统计',
    desc: '利用「春—花」「山—水」等字词共现关系选词。用词相近，不等于整首诗意象连贯。',
    tag: 'n-gram / 共现'
  },
  {
    year: '神经网络',
    name: '条件生成',
    desc: '学习字词的分布式表示与前后搭配，可以根据主题或图片生成诗句。',
    tag: '语言模型'
  },
  {
    year: 'ACL 2025',
    name: 'BIPro：生成后再修改',
    desc: '先生成诗，再针对形式与表达问题多轮修订，而不是一次写完就交卷。人类评价更偏好修订后的传统中文诗。',
    tag: '迭代修订'
  },
  {
    year: 'EMNLP 2026',
    name: 'Honglou-Poem',
    desc: '建立与《红楼梦》相关的诗歌评测，尝试把叙事场景与诗意的符合程度纳入评价。它评的是「怎样判断好坏」，不是新的统一分数。',
    tag: '场景化评测'
  }
];

/* 三、课件要点 */
const KEY_POINTS = [
  {
    kind: '关键思路',
    icon: '思',
    tone: 'teal',
    text: '选字满足格律，机器可以很快；《早发白帝城》说明字数、韵脚、平仄与语句通顺各是不同的条件。评价生成诗也要分别看这些层面。'
  },
  {
    kind: '难点在哪里',
    icon: '难',
    tone: 'amber',
    text: '机械凑出 28 个字不难，难的是主题不断裂、意象有联系、语言不落俗套。押韵分数不能代替人的审美判断。'
  },
  {
    kind: '仍待解决',
    icon: '问',
    tone: 'violet',
    text: '同一幅画可以写出多首合理诗，难以用单一标准答案打分；文化典故、原创性和整体意境仍需人工评价。'
  },
  {
    kind: '评估原则',
    icon: '评',
    tone: 'rose',
    text: '格律逐项核对；意象是否贴合主题、表达是否有新意，还要结合读者判断。盲评时隐去作者，记录评价问题，避免只报「喜欢率」。'
  }
];

/* 四、韵脚库：每组尾字同韵，用于七言绝句的第 1/2/4 句 */
const RHYME_GROUPS = {
  an: {
    label: 'an 韵',
    tails: ['春事晚', '杏花寒', '夜阑干', '意阑珊', '鬓先斑', '柳烟寒']
  },
  ang: {
    label: 'ang 韵',
    tails: ['春意长', '雁声长', '柳色黄', '月如霜', '梦里乡', '柳絮扬']
  },
  ing: {
    label: 'ing 韵',
    tails: ['月正明', '太无情', '梦初醒', '晓星明', '别样情', '夜寒凝']
  },
  ao: {
    label: 'ao 韵',
    tails: ['花落早', '春渐老', '人易老', '归去早', '烟水渺', '燕归早']
  },
  ou: {
    label: 'ou 韵',
    tails: ['一江秋', '载离愁', '水空流', '白了头', '独登楼', '客归舟']
  }
};

/* 不押主韵的第三句尾（造成「转」的效果） */
const COUNTER_TAILS = ['人未归', '风不定', '云自闲', '水东流', '梦难成', '客天涯'];

/* 五、场景词库：看图作诗时按图片色调 + 用户标签选取 */
const SCENES = {
  spring: {
    id: 'spring',
    name: '春景',
    tags: ['春', '花', '雨', '柳'],
    heads: ['燕子', '一汀', '小楼', '深巷', '花间', '柳外', '春风', '细雨'],
    middles: ['不归', '烟雨', '一夜', '初绽', '暗长', '微度', '新绿', '又起'],
    words: ['燕子', '杏花', '烟雨', '芳草', '春风', '小楼', '深巷', '梨花', '柳色', '春事'],
    mood: '明媚、含蓄、带一点闲愁'
  },
  autumn: {
    id: 'autumn',
    name: '秋夜',
    tags: ['秋', '月', '桂', '山'],
    heads: ['人闲', '空山', '夜静', '桂花', '明月', '松间', '清秋', '远山'],
    middles: ['桂花', '落尽', '无声', '初上', '独照', '渐起', '如洗', '暗度'],
    words: ['桂花', '春山', '明月', '松', '清秋', '雁', '霜', '枫', '空山', '夜'],
    mood: '清寂、空灵、略带思念'
  },
  mountain: {
    id: 'mountain',
    name: '山水',
    tags: ['山', '水', '云', '舟'],
    heads: ['两岸', '轻舟', '青山', '孤帆', '远岫', '溪头', '云间', '江上'],
    middles: ['猿声', '已过', '相对', '渐远', '横斜', '初起', '不住', '东流'],
    words: ['青山', '白云', '流水', '孤舟', '层峦', '溪', '烟', '峰', '江', '岸'],
    mood: '开阔、悠远、行旅感'
  },
  snow: {
    id: 'snow',
    name: '雪景',
    tags: ['雪', '寒', '梅', '冬'],
    heads: ['忽如', '千树', '寒梅', '朔风', '琼花', '一枝', '夜来', '窗前'],
    middles: ['一夜', '梨花', '初绽', '乱扑', '飞来', '暗香', '积满', '未消'],
    words: ['雪', '寒', '梅', '冰', '朔风', '琼花', '梨花', '暗香', '枝', '夜'],
    mood: '清冷、纯净，带有比喻式的惊喜'
  },
  night: {
    id: 'night',
    name: '夜雨',
    tags: ['夜', '灯', '窗', '雨'],
    heads: ['小楼', '深巷', '一灯', '窗前', '夜来', '檐下', '孤影', '残更'],
    middles: ['听雨', '明灭', '不眠', '滴碎', '独坐', '初落', '如梦', '暗添'],
    words: ['夜雨', '孤灯', '窗', '檐', '残更', '梦', '影', '秋', '漏', '愁'],
    mood: '幽微、绵长、适合独白'
  }
};

/* 六、经典名句：用作课件示例与盲评对照 */
const CLASSIC_LINES = [
  { text: '燕子不归春事晚，一汀烟雨杏花寒。', from: '戴叔伦《苏溪亭》' },
  { text: '人闲桂花落，夜静春山空。', from: '王维《鸟鸣涧》' },
  { text: '忽如一夜春风来，千树万树梨花开。', from: '岑参《白雪歌送武判官归京》' },
  { text: '小楼一夜听春雨，深巷明朝卖杏花。', from: '陆游《临安春雨初霁》' }
];

const CLASSIC_QUATRAINS = [
  {
    title: '早发白帝城',
    author: '李白',
    lines: ['朝辞白帝彩云间', '千里江陵一日还', '两岸猿声啼不住', '轻舟已过万重山'],
    note: '字数、韵脚、平仄与语句通顺是彼此独立的条件。'
  },
  {
    title: '绝句',
    author: '杜甫',
    lines: ['两个黄鹂鸣翠柳', '一行白鹭上青天', '窗含西岭千秋雪', '门泊东吴万里船'],
    note: '意象并置仍有内在联系，不是简单拼贴。'
  },
  {
    title: '望庐山瀑布',
    author: '李白',
    lines: ['日照香炉生紫烟', '遥看瀑布挂前川', '飞流直下三千尺', '疑是银河落九天'],
    note: '夸张与想象构成意境，形式之外还有表达。'
  }
];

/* 七、内置示例图（SVG，无外部依赖） */
function makeSceneSVG(kind) {
  const palettes = {
    spring: ['#eaf4e2', '#b7d7a8', '#7fae74', '#f6d6df'],
    autumn: ['#e9eef5', '#aebfd1', '#6b7f98', '#d9c7a3'],
    mountain: ['#eef3f5', '#b9cdd6', '#7894a3', '#cfd9d3'],
    snow: ['#f4f6f8', '#d8e1e8', '#9fb2c0', '#ffffff'],
    night: ['#e8ecf3', '#a9b4c8', '#5f6b86', '#d7c9b3']
  };
  const p = palettes[kind] || palettes.spring;
  const detail = {
    spring: '<circle cx="360" cy="80" r="34" fill="#f4c96b" opacity=".75"/><path d="M60 220 Q140 120 220 210" stroke="#6f9c63" stroke-width="5" fill="none"/><path d="M300 230 Q380 130 460 220" stroke="#6f9c63" stroke-width="5" fill="none"/><path d="M180 90 q14 -12 28 0 q-14 -6 -28 0" fill="#5b6b73"/>',
    autumn: '<circle cx="370" cy="86" r="30" fill="#f5e6c0"/><path d="M80 200 l30 -46 l30 46" fill="#7d8fa3"/><path d="M120 205 l40 -64 l40 64" fill="#66798f"/><path d="M210 120 q10 -8 20 0 q-10 -4 -20 0" fill="#5b6b73"/>',
    mountain: '<path d="M40 220 L160 90 L270 220 Z" fill="#8ba3b0"/><path d="M180 220 L320 70 L470 220 Z" fill="#6f8a99"/><path d="M320 70 l22 30 l-22 -8 l-20 8 z" fill="#fff" opacity=".8"/><path d="M60 240 q80 20 160 0 t160 0" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/>',
    snow: '<circle cx="350" cy="80" r="28" fill="#fff" opacity=".9"/><path d="M70 220 L170 110 L260 220 Z" fill="#b9c8d2"/><path d="M190 220 L320 90 L450 220 Z" fill="#9fb2c0"/><g fill="#fff"><circle cx="120" cy="70" r="4"/><circle cx="220" cy="55" r="3"/><circle cx="300" cy="100" r="5"/><circle cx="420" cy="60" r="4"/></g>',
    night: '<circle cx="370" cy="80" r="26" fill="#f7edd0"/><rect x="90" y="120" width="120" height="90" fill="#7d879c"/><rect x="104" y="134" width="34" height="30" fill="#f3dfa8"/><rect x="156" y="134" width="34" height="30" fill="#f3dfa8"/><path d="M0 215 q120 25 240 0 t240 0 v45 H0 Z" fill="#66718a"/>'
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 280"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="500" height="280" fill="url(#g)"/><path d="M0 210 q90 -30 180 0 t180 0 t140 -10 v80 H0 Z" fill="${p[2]}" opacity=".55"/>${detail[kind] || ''}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
