/* ── CURSOR ── */
const cur = document.getElementById('cursor');
document.addEventListener('mousemove', e => { cur.style.left=e.clientX+'px'; cur.style.top=e.clientY+'px'; });
document.querySelectorAll('a,button,input').forEach(el => {
  el.addEventListener('mouseenter',()=>{ cur.style.width='28px';cur.style.height='28px'; });
  el.addEventListener('mouseleave',()=>{ cur.style.width='12px';cur.style.height='12px'; });
});

/* ── ENTER KEY ── */
document.getElementById('gh-input').addEventListener('keydown', e => { if(e.key==='Enter') startStalk(); });

/* ── STATE ── */
let lastData = null;
let lastUsername = '';

/* ── LANG COLORS ── */
const LANG_COLORS = {
  JavaScript:'#f1e05a',TypeScript:'#3178c6',Python:'#3572A5',
  Java:'#b07219',C:'#555555','C++':'#f34b7d',HTML:'#e34c26',
  CSS:'#563d7c',Ruby:'#701516',Go:'#00ADD8',Rust:'#dea584',
  Swift:'#ffac45',Kotlin:'#A97BFF',Shell:'#89e051',
  PHP:'#4F5D95',Dart:'#00B4AB',Vue:'#41b883',
  Jupyter:'#DA5B0B',R:'#198CE7',default:'#cc0000'
};

/* ── LOADING STEPS ── */
const STEPS = [
  { icon:'fa-satellite-dish', text:'Locating target on GitHub servers...' },
  { icon:'fa-database',       text:'Extracting repository intelligence...' },
  { icon:'fa-code-branch',    text:'Analyzing commit patterns...' },
  { icon:'fa-brain',          text:'Running psychological profiling AI...' },
  { icon:'fa-file-shield',    text:'Compiling classified dossier...' },
];

let stepInterval;
function startLoadingSteps() {
  const container = document.getElementById('loading-steps');
  container.innerHTML = '';
  let i = 0;
  const bar = document.getElementById('load-fill');
  const addStep = () => {
    if (i >= STEPS.length) return;
    const s = STEPS[i];
    const div = document.createElement('div');
    div.className = 'loading-step';
    div.innerHTML = `<i class="fa-solid ${s.icon}"></i><span>${s.text}</span>`;
    container.appendChild(div);
    bar.style.width = ((i+1)/STEPS.length*100) + '%';
    i++;
  };
  addStep();
  stepInterval = setInterval(addStep, 900);
}
function stopLoadingSteps() {
  clearInterval(stepInterval);
  document.querySelectorAll('.loading-step').forEach(s => s.classList.add('done'));
}

/* ── TAB SWITCHER ── */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id==='tab-'+name));
}

/* ── MAIN STALK FUNCTION ── */
async function startStalk() {
  const raw = document.getElementById('gh-input').value.trim();
  if (!raw) { alert('Enter a GitHub username first.'); return; }

  // Strip any format the user might paste:
  // https://github.com/instai4  →  instai4
  // github.com/instai4          →  instai4
  // @instai4                    →  instai4
  // instai4                     →  instai4
  const username = raw
    .replace(/https?:\/\//i, '')
    .replace(/github\.com\//i, '')
    .replace(/^@/, '')
    .split('/')[0]   // drop any trailing path like /repos
    .split('?')[0]   // drop query strings
    .trim();

  if (!username) { alert('Could not extract a username. Try just: instai4'); return; }

  lastUsername = username;
  document.getElementById('file-wrap').classList.remove('show');
  document.getElementById('loading-wrap').classList.add('show');
  document.getElementById('load-fill').style.width = '0%';
  document.getElementById('stalk-btn').disabled = true;
  startLoadingSteps();

  try {
    // 1. Fetch GitHub user
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
    if (!userRes.ok) throw new Error(userRes.status === 404 ? 'User not found on GitHub.' : 'GitHub API error.');
    const user = await userRes.json();

    // 2. Fetch repos
    const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`);
    const repos = reposRes.ok ? await reposRes.json() : [];

    // 3. Build language map
    const langMap = {};
    repos.forEach(r => { if(r.language) langMap[r.language] = (langMap[r.language]||0) + 1; });
    const totalLangCount = Object.values(langMap).reduce((a,b)=>a+b,0) || 1;
    const langsSorted = Object.entries(langMap).sort((a,b)=>b[1]-a[1]).slice(0,8);

    // 4. Build data object for API
    const profileData = {
      username: user.login,
      name: user.name || user.login,
      bio: user.bio || '',
      location: user.location || '',
      company: user.company || '',
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      createdAt: user.created_at,
      topLanguages: langsSorted.map(([l,c])=>({ lang:l, pct:Math.round(c/totalLangCount*100) })),
      topRepos: repos.slice(0,6).map(r=>({
        name: r.name,
        desc: r.description || '',
        stars: r.stargazers_count,
        forks: r.forks_count,
        lang: r.language || ''
      })),
      totalStars: repos.reduce((a,r)=>a+r.stargazers_count,0),
    };

    // 5. Call AI
    const aiRes = await fetch('/api/stalk', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ profileData })
    });
    if (!aiRes.ok) throw new Error('AI profiling failed.');
    const aiData = await aiRes.json();

    stopLoadingSteps();
    setTimeout(() => {
      document.getElementById('loading-wrap').classList.remove('show');
      renderProfile(user, profileData, aiData);
    }, 500);

  } catch(err) {
    stopLoadingSteps();
    document.getElementById('loading-wrap').classList.remove('show');
    alert('Error: ' + err.message);
  } finally {
    document.getElementById('stalk-btn').disabled = false;
  }
}

/* ── RENDER ── */
function renderProfile(user, data, ai) {
  lastData = { user, data, ai };

  // Header
  document.getElementById('fh-name').textContent = (data.name || data.username).toUpperCase();
  document.getElementById('fh-case').textContent = 'CASE #' + Math.random().toString(36).substr(2,6).toUpperCase();

  // Subject card
  document.getElementById('subj-avatar').src = user.avatar_url;
  document.getElementById('subj-name').textContent = data.name || data.username;

  const meta = document.getElementById('subj-meta');
  meta.innerHTML = [
    data.location && `<span class="subject-tag"><i class="fa-solid fa-location-dot"></i>${data.location}</span>`,
    data.company  && `<span class="subject-tag"><i class="fa-solid fa-building"></i>${data.company}</span>`,
    `<span class="subject-tag"><i class="fa-brands fa-github"></i>@${data.username}</span>`,
    data.bio      && `<span class="subject-tag"><i class="fa-solid fa-quote-left"></i>${data.bio.slice(0,50)}${data.bio.length>50?'...':''}</span>`,
  ].filter(Boolean).join('');

  document.getElementById('subj-links').innerHTML = `
    <a class="subject-link" href="https://github.com/${data.username}" target="_blank"><i class="fa-brands fa-github"></i>github.com/${data.username}</a>
  `;

  // Stats
  const accountAge = Math.floor((Date.now()-new Date(data.createdAt))/(1000*60*60*24*365));
  document.getElementById('gh-stats').innerHTML = [
    { val: data.publicRepos, lbl:'Repos' },
    { val: data.followers,   lbl:'Followers' },
    { val: data.following,   lbl:'Following' },
    { val: data.totalStars,  lbl:'Total Stars' },
    { val: accountAge+'y',   lbl:'Account Age' },
    { val: data.topLanguages[0]?.lang || 'N/A', lbl:'Top Language' },
  ].map(s=>`<div class="stat-box"><span class="stat-val">${s.val}</span><span class="stat-lbl">${s.lbl}</span></div>`).join('');

  // Traits
  const traits = ai.traits || [];
  document.getElementById('trait-grid').innerHTML = traits.map(t=>`
    <div class="trait">
      <div class="trait-name">${t.name}<span class="trait-score">${t.score}/10</span></div>
      <div class="trait-bar"><div class="trait-fill" style="width:0%" data-w="${t.score*10}%"></div></div>
      <div class="trait-desc">${t.desc}</div>
    </div>`).join('');

  // Personality text
  const pt = (ai.personality||'').split('\n').filter(l=>l.trim());
  document.getElementById('personality-text').innerHTML = pt.map(l=>`<p>${l}</p>`).join('');

  // Dark side
  const dt = (ai.darkside||'').split('\n').filter(l=>l.trim());
  document.getElementById('darkside-text').innerHTML = dt.map(l=>`<p>${l}</p>`).join('');

  const dangerScore = Math.min(10, Math.max(1, ai.dangerScore||5));
  document.getElementById('danger-val').textContent = dangerScore+'/10';
  document.getElementById('threat-text').innerHTML = `<p>${ai.threat||''}</p>`;

  // Stack
  const ll = document.getElementById('lang-list');
  ll.innerHTML = data.topLanguages.map(({lang,pct})=>`
    <div class="lang-row">
      <span class="lang-name">${lang}</span>
      <div class="lang-bar-wrap">
        <div class="lang-bar-fill" style="width:0%;background:${LANG_COLORS[lang]||LANG_COLORS.default}" data-w="${pct}%"></div>
      </div>
      <span class="lang-pct">${pct}%</span>
    </div>`).join('');

  const rl = document.getElementById('repo-list');
  rl.innerHTML = data.topRepos.map(r=>`
    <a class="repo-item" href="https://github.com/${data.username}/${r.name}" target="_blank" style="text-decoration:none">
      <div>
        <div class="repo-name"><i class="fa-solid fa-folder" style="margin-right:.35rem;font-size:.6rem"></i>${r.name}</div>
        ${r.desc?`<div class="repo-desc">${r.desc.slice(0,80)}${r.desc.length>80?'...':''}</div>`:''}
      </div>
      <div class="repo-meta">
        ${r.lang?`<span class="repo-badge" style="color:${LANG_COLORS[r.lang]||LANG_COLORS.default}">${r.lang}</span>`:''}
        <span class="repo-badge"><i class="fa-solid fa-star"></i>${r.stars}</span>
        <span class="repo-badge"><i class="fa-solid fa-code-branch"></i>${r.forks}</span>
      </div>
    </a>`).join('');

  const st = (ai.stackAnalysis||'').split('\n').filter(l=>l.trim());
  document.getElementById('stack-text').innerHTML = st.map(l=>`<p>${l}</p>`).join('');

  // Prediction
  const prt = (ai.prediction||'').split('\n').filter(l=>l.trim());
  document.getElementById('prediction-text').innerHTML = prt.map(l=>`<p>${l}</p>`).join('');
  const alt = (ai.alternate||'').split('\n').filter(l=>l.trim());
  document.getElementById('alternate-text').innerHTML = alt.map(l=>`<p>${l}</p>`).join('');

  // Verdict
  document.getElementById('verdict-stamp').textContent = ai.verdictStamp || 'ANALYZED';
  document.getElementById('verdict-title').textContent = ai.verdictTitle || 'FINAL VERDICT';
  document.getElementById('verdict-text').textContent = ai.verdictText || '';

  // Show file
  document.getElementById('file-wrap').classList.add('show');
  document.getElementById('file-wrap').scrollIntoView({behavior:'smooth',block:'start'});

  // Animate bars after render
  setTimeout(() => {
    document.querySelectorAll('.trait-fill[data-w],.lang-bar-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w;
    });
    document.getElementById('danger-fill').style.width = (dangerScore*10)+'%';
  }, 200);
}

/* ── COPY ── */
function copyProfile() {
  if (!lastData) return;
  const { data, ai } = lastData;
  const text = `STALK.exe — GitHub Psychological Profile
Subject: @${data.username} (${data.name})
Repos: ${data.publicRepos} | Followers: ${data.followers} | Stars: ${data.totalStars}
Top Language: ${data.topLanguages[0]?.lang || 'N/A'}

PERSONALITY:
${ai.personality || ''}

DARK SIDE:
${ai.darkside || ''}

VERDICT: ${ai.verdictTitle}
${ai.verdictText}

— Profiled by STALK.exe | github.com/instai4`;
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.currentTarget;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    btn.style.color = 'var(--amber2)';
    btn.style.borderColor = 'var(--amber2)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color=''; btn.style.borderColor=''; }, 2000);
  });
}

/* ── SHARE X ── */
function shareX() {
  if (!lastData) return;
  const { data, ai } = lastData;
  const text = encodeURIComponent(
    `I just ran @${data.username} through STALK.exe — the AI GitHub profiler.\n\nVerdict: "${ai.verdictTitle}"\n\nDanger Score: ${ai.dangerScore}/10\n\nTry it yourself 👇\n— by @instai4`
  );
  window.open('https://x.com/intent/tweet?text='+text, '_blank');
}

/* ── NEW TARGET ── */
function stalkAnother() {
  document.getElementById('file-wrap').classList.remove('show');
  document.getElementById('gh-input').value = '';
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(() => document.getElementById('gh-input').focus(), 400);
}
