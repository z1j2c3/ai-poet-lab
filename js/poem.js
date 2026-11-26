/* AI 诗人 · 生成与评估引擎
 * 流程：图片 → 色调分析 → 意象关键词 → 初稿 → 形式修订 → 表达修订 → 双轨评估 */

/* 可复现的伪随机数生成器 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 尾字 → 韵组映射，用于自动押韵检查 */
const RHYME_CHAR_GROUP = {};
Object.keys(RHYME_GROUPS).forEach(function (key) {
  RHYME_GROUPS[key].tails.forEach(function (tail) {
    RHYME_CHAR_GROUP[tail.charAt(tail.length - 1)] = key;
  });
});

function pickOne(arr, rnd) {
  return arr[Math.floor(rnd() * arr.length)];
}

/* 从图片像素的主色调推断场景（轻量、无需后端与模型） */
function detectSceneFromTone(tone) {
  const r = tone.r, g = tone.g, b = tone.b, lum = tone.lum;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (sat < 24 && lum > 160) return 'snow';
  if (g > r * 1.07 && g > b * 1.04) return 'spring';
  if (lum < 108 && b >= r * 0.95) return 'night';
  if (r > g * 1.05 && lum > 100) return 'autumn';
  if (b > r * 1.04) return 'mountain';
  return 'spring';
}

/* 读取图片主色调，返回统计值与预览 dataURL */
function analyzeImage(file) {
  return new Promise(function (resolve, reject) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      reject(new Error('请选择图片文件'));
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 64, 64);
        const d = ctx.getImageData(0, 0, 64, 64).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i + 1]; b += d[i + 2];
        }
        const n = d.length / 4;
        r /= n; g /= n; b /= n;
        const tone = { r: r, g: g, b: b, lum: 0.299 * r + 0.587 * g + 0.114 * b };
        resolve({
          tone: tone,
          scene: detectSceneFromTone(tone),
          preview: dataUrl
        });
      };
      img.onerror = function () { reject(new Error('图片解析失败')); };
      img.src = dataUrl;
    };
    reader.onerror = function () { reject(new Error('图片读取失败')); };
    reader.readAsDataURL(file);
  });
}

/* 构造一句七言：2 字起 + 2 字承接 + 3 字落脚（含韵脚） */
function makeLine(scene, head, middle, tail) {
  return head + middle + tail;
}

/* 生成一首七言绝句，返回三轮稿件与修订说明 */
function generatePoem(sceneId, seed) {
  const rnd = mulberry32(seed);
  const scene = SCENES[sceneId] || SCENES.spring;
  const rhymeKeys = Object.keys(RHYME_GROUPS);
  const mainRhyme = pickOne(rhymeKeys, rnd);
  const mainTails = RHYME_GROUPS[mainRhyme].tails;

  let otherRhyme = mainRhyme;
  while (otherRhyme === mainRhyme) otherRhyme = pickOne(rhymeKeys, rnd);
  let thirdRhyme = mainRhyme;
  while (thirdRhyme === mainRhyme || thirdRhyme === otherRhyme) thirdRhyme = pickOne(rhymeKeys, rnd);

  /* 初稿：第 2、4 句尾字分属不同韵组 —— 故意留下形式问题 */
  const draftTails = [
    pickOne(mainTails, rnd),
    pickOne(RHYME_GROUPS[otherRhyme].tails, rnd),
    pickOne(COUNTER_TAILS, rnd),
    pickOne(RHYME_GROUPS[thirdRhyme].tails, rnd)
  ];

  /* 形式修订：第 1、2、4 句统一押主韵，第 3 句「转」而不押 */
  const formTails = [
    pickOne(mainTails, rnd),
    pickOne(mainTails, rnd),
    pickOne(COUNTER_TAILS, rnd),
    pickOne(mainTails, rnd)
  ];

  const draftHeads = [], draftMiddles = [], finalHeads = [], finalMiddles = [];
  for (let i = 0; i < 4; i++) {
    draftHeads.push(pickOne(scene.heads, rnd));
    draftMiddles.push(pickOne(scene.middles, rnd));
    finalHeads.push(pickOne(scene.heads, rnd));
    finalMiddles.push(pickOne(scene.middles, rnd));
  }

  /* 表达修订：去掉重复用词，把通用词替换为场景专属词 */
  const generic = ['一夜', '春风', '初绽', '又起', '暗长', '微度'];
  const revisedHeads = finalHeads.slice();
  const revisedMiddles = finalMiddles.slice();
  const seenHeads = {}, seenMiddles = {};
  /* 替换用池必须都是 2 字，否则七言句式会被破坏 */
  const headPool = scene.heads.filter(function (w) { return w.length === 2; });
  const middlePool = scene.middles.filter(function (w) { return w.length === 2; });
  let replaceCount = 0;
  for (let i = 0; i < 4; i++) {
    if (seenHeads[revisedHeads[i]] || generic.indexOf(revisedHeads[i]) >= 0) {
      const candidates = headPool.filter(function (w) { return !seenHeads[w]; });
      revisedHeads[i] = pickOne(candidates.length ? candidates : headPool, rnd);
      replaceCount++;
    }
    seenHeads[revisedHeads[i]] = true;
    if (seenMiddles[revisedMiddles[i]] || generic.indexOf(revisedMiddles[i]) >= 0) {
      const candidatesM = middlePool.filter(function (w) { return !seenMiddles[w]; });
      revisedMiddles[i] = pickOne(candidatesM.length ? candidatesM : middlePool, rnd);
      replaceCount++;
    }
    seenMiddles[revisedMiddles[i]] = true;
  }

  const draft = draftTails.map(function (t, i) {
    return makeLine(scene, draftHeads[i], draftMiddles[i], t);
  });
  const formRevised = formTails.map(function (t, i) {
    return makeLine(scene, finalHeads[i], finalMiddles[i], t);
  });
  const final = formTails.map(function (t, i) {
    return makeLine(scene, revisedHeads[i], revisedMiddles[i], t);
  });

  return {
    sceneId: sceneId,
    sceneName: scene.name,
    mood: scene.mood,
    rhyme: mainRhyme,
    rhymeLabel: RHYME_GROUPS[mainRhyme].label,
    keywords: scene.words.slice(0, 6),
    draft: draft,
    formRevised: formRevised,
    final: final,
    notes: [
      '初稿：按七言句式拼接，但第 2、4 句尾字不同韵 —— 形式尚未过关。',
      '第一轮（形式修订）：把第 1、2、4 句尾字统一为「' + RHYME_GROUPS[mainRhyme].label + '」，第 3 句保持不押以形成转折。',
      '第二轮（表达修订）：替换了 ' + replaceCount + ' 处重复或过于通用的用词，让意象更贴近「' + scene.name + '」。'
    ]
  };
}

/* 形式检查：字数、句数、押韵（可逐项核对） */
function checkForm(lines) {
  const details = [];
  const lineCountOk = lines.length === 4;
  details.push({
    item: '句数',
    pass: lineCountOk,
    text: lineCountOk ? '4 句，符合七言绝句' : lines.length + ' 句，不符合七言绝句'
  });

  let charOk = true;
  lines.forEach(function (line, idx) {
    if (line.length !== 7) charOk = false;
    details.push({
      item: '第 ' + (idx + 1) + ' 句字数',
      pass: line.length === 7,
      text: line.length + ' 字' + (line.length === 7 ? '（合格）' : '（应为 7 字）')
    });
  });
  details[0].pass = lineCountOk && charOk;
  details[0].text = details[0].text + (charOk ? '；每句 7 字，共 28 字' : '；存在字数不合格的句子');

  const tailChars = lines.map(function (l) { return l.charAt(l.length - 1); });
  const rhyme2 = RHYME_CHAR_GROUP[tailChars[1]];
  const rhyme4 = RHYME_CHAR_GROUP[tailChars[3]];
  const rhymeOk = !!rhyme2 && rhyme2 === rhyme4;
  details.push({
    item: '押韵（第 2、4 句）',
    pass: rhymeOk,
    text: rhymeOk
      ? '「' + tailChars[1] + '」「' + tailChars[3] + '」同属 ' + rhyme2 + ' 韵'
      : '「' + tailChars[1] + '」「' + tailChars[3] + '」不同韵，需修订'
  });

  return {
    pass: details.every(function (d) { return d.pass; }),
    details: details
  };
}

/* 内容检查：给出提示而非分数（对应课件「没有替代文学判断的统一分数」） */
function checkContent(result, lines) {
  const joined = lines.join('');
  const uniqueChars = new Set(joined.split('')).size;
  const scene = SCENES[result.sceneId];
  const sceneHit = scene.words.filter(function (w) { return joined.indexOf(w) >= 0; });
  return [
    {
      item: '主题贴合',
      pass: sceneHit.length > 0,
      text: sceneHit.length > 0
        ? '命中「' + result.sceneName + '」意象：' + sceneHit.join('、')
        : '未明显命中场景意象，建议人工判断'
    },
    {
      item: '意象连贯',
      pass: uniqueChars >= 16,
      text: '用字多样性 ' + uniqueChars + '/28，' + (uniqueChars >= 16 ? '未出现明显机械重复' : '重复偏多，需人工判断')
    },
    {
      item: '套用风险',
      pass: null,
      text: '自动工具难以识别是否拼接现成诗句，请读者对照经典名句判断'
    },
    {
      item: '整体意境',
      pass: null,
      text: '「' + result.mood + '」——意境与情绪是否成立，仍需读者判断'
    }
  ];
}

/* 组装成带标点的展示文本 */
function toPoemText(lines) {
  return lines.map(function (l, i) {
    return l + (i === lines.length - 1 ? '。' : i % 2 === 0 ? '，' : '。');
  }).join('\n');
}
