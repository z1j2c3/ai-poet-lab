/* AI 诗人 · 交互层 */
(function () {
  'use strict';

  const state = {
    sceneId: 'spring',
    tone: null,
    preview: null,
    result: null,
    seed: 20261126,
    blindPair: null,
    vote: null
  };

  const $ = function (id) { return document.getElementById(id); };

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- 知识模块渲染 ---------- */
  function renderKnowledge() {
    $('categoryGrid').innerHTML = POETRY_CATEGORIES.map(function (c) {
      let body = '';
      if (c.children) {
        body = '<ul>' + c.children.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
      } else {
        body = c.groups.map(function (g) {
          return '<div class="nested"><span>' + g.label + '</span>：' + g.items.join(' / ') + '</div>';
        }).join('');
      }
      return '<div class="category-card ' + c.tone + '"><h4>' + c.name + '</h4>' + body + '<p>' + c.note + '</p></div>';
    }).join('');

    $('timeline').innerHTML = METHOD_TIMELINE.map(function (m) {
      return '<div class="time-item"><span class="time-year">' + m.year + '</span>' +
        '<h4>' + m.name + '</h4><p>' + m.desc + '</p>' +
        '<span class="time-tag">' + m.tag + '</span></div>';
    }).join('');

    $('pointGrid').innerHTML = KEY_POINTS.map(function (p) {
      return '<div class="point-card ' + p.tone + '"><div class="point-icon">' + p.icon + '</div>' +
        '<div><h4>' + p.kind + '</h4><p>' + p.text + '</p></div></div>';
    }).join('');

    $('classicGrid').innerHTML = CLASSIC_LINES.map(function (c) {
      return '<div class="classic-item"><p>' + c.text + '</p><small>' + c.from + '</small></div>';
    }).join('');
  }

  /* ---------- 场景选择区 ---------- */
  function renderScenePickers() {
    $('sceneThumbs').innerHTML = Object.keys(SCENES).map(function (id) {
      return '<div class="thumb' + (id === state.sceneId ? ' active' : '') + '" data-scene="' + id + '">' +
        '<img src="' + makeSceneSVG(id) + '" alt="' + SCENES[id].name + '" />' +
        '<span>' + SCENES[id].name + '</span></div>';
    }).join('');

    $('sceneChips').innerHTML = Object.keys(SCENES).map(function (id) {
      return '<span class="chip' + (id === state.sceneId ? ' active' : '') + '" data-scene="' + id + '">' +
        SCENES[id].name + '</span>';
    }).join('');
  }

  function setScene(id) {
    state.sceneId = id;
    document.querySelectorAll('[data-scene]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-scene') === id);
    });
    if (state.preview) showInsight();
  }

  function showInsight() {
    const scene = SCENES[state.sceneId];
    const t = state.tone;
    $('imageInsight').hidden = false;
    $('toneText').textContent = t
      ? 'R' + Math.round(t.r) + ' G' + Math.round(t.g) + ' B' + Math.round(t.b) + ' · 亮度 ' + Math.round(t.lum)
      : '示例图（未做像素采样）';
    $('sceneText').textContent = scene.name;
    $('keywordText').textContent = scene.words.slice(0, 6).join('、');
    $('generateBtn').disabled = false;
  }

  function svgDataUriToBlob(uri) {
    const svg = decodeURIComponent(uri.split(',')[1]);
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  /* ---------- 生成流程 ---------- */
  function renderRounds(result) {
    $('rounds').innerHTML =
      '<div class="round"><div class="round-head"><span>初稿</span><small>拼贴拼接</small></div>' +
      '<pre>' + toPoemText(result.draft) + '</pre><p class="round-note">' + result.notes[0] + '</p></div>' +
      '<div class="round round-form"><div class="round-head"><span>第一轮 · 形式修订</span><small>押韵修正</small></div>' +
      '<pre>' + toPoemText(result.formRevised) + '</pre><p class="round-note">' + result.notes[1] + '</p></div>' +
      '<div class="round"><div class="round-head"><span>第二轮 · 表达修订</span><small>意象整理</small></div>' +
      '<p class="round-note">' + result.notes[2] + '</p></div>';

    $('finalMeta').textContent = result.rhymeLabel + ' · ' + result.sceneName;
    $('finalPoem').textContent = toPoemText(result.final);
  }

  function renderEvaluation(result) {
    $('evaluationEmpty').hidden = true;
    $('evaluationPanel').hidden = false;

    const form = checkForm(result.final);
    $('formChecks').innerHTML = form.details.map(function (d) {
      const cls = d.pass ? 'ok' : 'no';
      const mark = d.pass ? '✓' : '✕';
      return '<div class="check-item"><span class="check-icon ' + cls + '">' + mark + '</span>' +
        '<div><b>' + d.item + '</b>' + d.text + '</div></div>';
    }).join('');
    $('formVerdict').textContent = form.pass
      ? '形式逐项合格。但满足格律并不自动得到好诗。'
      : '形式仍有不达标项，应继续修订，不能只凭优美语句过关。';

    const content = checkContent(result, result.final);
    $('contentChecks').innerHTML = content.map(function (d) {
      const cls = d.pass === null ? 'manual' : d.pass ? 'ok' : 'no';
      const mark = d.pass === null ? '?' : d.pass ? '✓' : '!';
      return '<div class="check-item"><span class="check-icon ' + cls + '">' + mark + '</span>' +
        '<div><b>' + d.item + '</b>' + d.text + '</div></div>';
    }).join('');
  }

  function setupBlind(result) {
    const classic = CLASSIC_QUATRAINS[Math.floor(Math.random() * CLASSIC_QUATRAINS.length)];
    const flip = Math.random() < 0.5;
    state.blindPair = {
      machineText: toPoemText(result.final),
      classicText: toPoemText(classic.lines),
      classic: classic,
      flip: flip,
      aIsMachine: flip
    };
    $('blindA').querySelector('pre').textContent = flip ? state.blindPair.machineText : state.blindPair.classicText;
    $('blindB').querySelector('pre').textContent = flip ? state.blindPair.classicText : state.blindPair.machineText;
    $('voteResult').hidden = true;
    state.vote = null;
  }

  function generate() {
    state.seed += 13;
    const result = generatePoem(state.sceneId, state.seed + Date.now() % 997);
    state.result = result;
    renderRounds(result);
    renderEvaluation(result);
    setupBlind(result);
    $('generationResult').hidden = false;
    toast('已生成：' + result.sceneName + ' · ' + result.rhymeLabel);
  }

  /* ---------- 盲评投票 ---------- */
  let pendingVote = null;
  function initVote() {
    document.querySelectorAll('[data-vote]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pendingVote = btn.getAttribute('data-vote');
        $('blindA').classList.toggle('selected', pendingVote === 'A');
        $('blindB').classList.toggle('selected', pendingVote === 'B');
      });
    });
    $('voteSubmit').addEventListener('click', function () {
      if (!pendingVote || !state.blindPair) { toast('请先选一首诗'); return; }
      const reason = $('voteReason').value.trim();
      const pair = state.blindPair;
      const machineChosen = (pendingVote === 'A') === pair.aIsMachine;
      const record = {
        choice: pendingVote,
        reason: reason || '（未填写理由）',
        aIsMachine: pair.aIsMachine,
        time: new Date().toLocaleString('zh-CN')
      };
      let logs = [];
      try { logs = JSON.parse(localStorage.getItem('ai-poet-votes') || '[]'); } catch (e) { logs = []; }
      logs.unshift(record);
      localStorage.setItem('ai-poet-votes', JSON.stringify(logs.slice(0, 20)));

      const machineLabel = pair.aIsMachine ? 'A' : 'B';
      const classicLabel = pair.aIsMachine ? 'B' : 'A';
      $('voteResult').hidden = false;
      $('voteResult').innerHTML =
        '<b>已记录你的选择：' + pendingVote + '</b><br />' +
        '揭晓：作品 ' + machineLabel + ' 是规则生成的诗，作品 ' + classicLabel + ' 是《' + pair.classic.title +
        '》（' + pair.classic.author + '）。你选中的是' + (machineChosen ? '机器生成' : '经典诗作') + '。<br />' +
        '<span style="color:#6d645a">注意：盲评的目的不是统计「喜欢率」，而是记录你判断的理由。同一幅画本就可以写出多首合理诗。</span>';
      renderVoteLog(logs);
      toast('盲评已记录');
    });
  }

  function renderVoteLog(logs) {
    $('voteLog').innerHTML = logs.slice(0, 5).map(function (r) {
      return '<div>' + r.time + ' · 选 ' + r.choice + '（' + (r.reason.length > 28 ? r.reason.slice(0, 28) + '…' : r.reason) + '）</div>';
    }).join('');
  }

  /* ---------- 事件绑定 ---------- */
  function initEvents() {
    const uploadBox = $('uploadBox');
    const input = $('imageInput');

    uploadBox.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      analyzeImage(file).then(function (data) {
        state.tone = data.tone;
        state.preview = data.preview;
        $('imagePreview').src = data.preview;
        $('imagePreview').hidden = false;
        $('uploadPlaceholder').hidden = true;
        setScene(data.scene);
        showInsight();
        toast('已从图片推断场景：' + SCENES[data.scene].name);
      }).catch(function (err) { toast(err.message); });
    });

    $('sceneThumbs').addEventListener('click', function (e) {
      const thumb = e.target.closest('[data-scene]');
      if (!thumb) return;
      const id = thumb.getAttribute('data-scene');
      state.preview = makeSceneSVG(id);
      state.tone = null;
      $('imagePreview').src = state.preview;
      $('imagePreview').hidden = false;
      $('uploadPlaceholder').hidden = true;
      setScene(id);
      showInsight();
    });

    $('sceneChips').addEventListener('click', function (e) {
      const chip = e.target.closest('[data-scene]');
      if (chip) setScene(chip.getAttribute('data-scene'));
    });

    $('analyzeBtn').addEventListener('click', function () {
      if (!state.preview) { toast('请先上传或选择一张图片'); return; }
      showInsight();
      toast('已提取意象：' + SCENES[state.sceneId].words.slice(0, 3).join('、'));
    });

    $('generateBtn').addEventListener('click', generate);
    $('againBtn').addEventListener('click', generate);
    $('copyBtn').addEventListener('click', function () {
      if (!state.result) return;
      const text = 'AI 诗人 · ' + state.result.sceneName + '\n' + toPoemText(state.result.final);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('诗句已复制'); });
      } else { toast('当前浏览器不支持自动复制'); }
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderKnowledge();
    renderScenePickers();
    initEvents();
    initVote();
    let logs = [];
    try { logs = JSON.parse(localStorage.getItem('ai-poet-votes') || '[]'); } catch (e) { logs = []; }
    renderVoteLog(logs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
