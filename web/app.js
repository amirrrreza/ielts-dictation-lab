const $ = id => document.getElementById(id);
const norm = s => s.toLowerCase().normalize('NFC').replace(/[’‘]/g,"'").replace(/[‐‑–—]/g,'-').trim().replace(/\s+/g,' ');
const state = JSON.parse(localStorage.getItem('ielts-lab-v1') || '{"extra":[],"cards":{},"draft":""}');
state.goals ??= {};
state.learned ??= {};
state.started ??= {};
function dayKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
const save = () => localStorage.setItem('ielts-lab-v1', JSON.stringify(state));
const library = new Map();
for (const word of [...seed,...state.extra]) if (!library.has(norm(word))) library.set(norm(word),word);
const card = key => Object.hasOwn(state.cards,key) ? state.cards[key] : null;
const needs = () => Object.keys(state.cards).filter(k => card(k).review && card(k).streak < 3);
function trackPractice(word) {
  const words = state.started[dayKey()] ??= [];
  if (!words.some(item => norm(item) === norm(word))) words.push(word);
}
function record(word, correct) {
  const k = norm(word), prev = card(k);
  const streak = correct ? Math.min(3,(prev?.streak || 0)+1) : 0;
  Object.defineProperty(state.cards,k,{value:{word,streak,review:!correct || !!prev?.review,due:Date.now()+([0,600000,86400000,0][streak])},enumerable:true,writable:true,configurable:true});
  if (!library.has(k)) { library.set(k,word); state.extra.push(word); }
  if (streak===3 && prev?.streak!==3) {
    const today = dayKey();
    const words = state.learned[today] ??= [];
    if (!words.some(item => norm(item)===k)) words.push(word);
  }
  save();
}
let current, checked, skipped = new Set(), visible = 100;
function counts(){
  const mastered = Object.values(state.cards).filter(c=>c.streak>=3).length;
  $('stats').textContent = mastered+' / '+library.size+' mastered · '+needs().length+' need review';
  $('progress').max = library.size;
  $('progress').value = mastered;
}
function next(){
  const review = $('mode').value==='review';
  const available = (review ? needs() : [...library.keys()]).filter(k => (card(k)?.streak || 0)<3 && (card(k)?.due || 0)<=Date.now());
  current = available.find(k=>!skipped.has(k));
  if (!current && available.length){skipped.clear();current=available[0];}
  checked=false;
  $('answer').value='';
  for (const id of ['answer','check','play','skip','reveal']) $(id).disabled=!current;
  $('check').textContent='Check answer';
  $('feedback').textContent=current?'': 'You’re caught up for now. Come back when your next reviews are due.';
  counts();
}
function play(){
  if (!current) return;
  if (!('speechSynthesis' in window)){ $('feedback').textContent='Audio is unavailable in this browser.';return; }
  speechSynthesis.cancel();
  const prompt = new SpeechSynthesisUtterance(library.get(current));
  prompt.lang='en-GB';prompt.rate=.87;
  prompt.onerror=e=>{if(!['canceled','interrupted'].includes(e.error)) $('feedback').textContent='Audio could not play. Check your browser’s speech settings.';};
  speechSynthesis.speak(prompt);
  if (!checked) {
    trackPractice(library.get(current));
    save();
    $('answer').focus();
  }
}
function score(correct){
  if (!current || checked) return;
  const word=library.get(current);
  trackPractice(word);
  record(word,correct);
  checked=true;
  $('feedback').textContent=correct?'Correct.': 'Expected: '+word;
  $('check').textContent='Next word';
  $('reveal').disabled=true;
  $('check').focus();
  counts();
}
$('drill').onsubmit=e=>{e.preventDefault();if(checked){next();play();}else if($('answer').value.trim())score(norm($('answer').value)===current);};
$('play').onclick=play;
$('reveal').onclick=()=>score(false);
$('skip').onclick=()=>{skipped.add(current);next();play();};
$('mode').onchange=()=>{skipped.clear();next();};
function show(page){
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  for(const b of document.querySelectorAll('nav button')){const active=b.dataset.page===page;b.setAttribute('aria-pressed',active);$(b.dataset.page).hidden=!active;}
  if(page==='review'){
    const all=needs();
    const mastered = Object.values(state.cards).filter(c=>c.streak>=3).map(c=>c.word);
    const learnedToday = state.learned[dayKey()]?.length ?? 0;
    $('learnedSummary').textContent = learnedToday+' learned today · '+mastered.length+' currently mastered';
    list($('masteredWords'),mastered.sort((a,b)=>a.localeCompare(b)));
    $('reviewSummary').textContent=all.length+' words to revisit · '+all.filter(k=>card(k).due<=Date.now()).length+' due now';
    list($('reviewList'),all.map(k=>card(k).word+' · '+card(k).streak+'/3'+(card(k).due>Date.now()?' · due '+new Date(card(k).due).toLocaleString():'')));
  }
  if(page==='goals') renderGoals();
  if(page==='library') renderLibrary();
  if(page==='practice'){if(!current)next();else counts();}
}
function list(target,values){target.replaceChildren(...values.map(value=>{const li=document.createElement('li');li.textContent=value;return li;}));}
for(const b of document.querySelectorAll('nav button')) b.onclick=()=>show(b.dataset.page);
$('train').onclick=()=>{$('mode').value='review';$('mode').onchange();show('practice');};
function renderGoals(){
  const today = dayKey();
  const target = state.goals[today] ?? 20;
  const practiced = day => new Set([...(state.started[day] ?? []), ...(state.learned[day] ?? [])].map(norm));
  const count = practiced(today).size;
  const covered = new Set([...Object.keys(state.cards).filter(key=>card(key).streak>0), ...Object.values(state.learned).flat().map(norm), ...Object.values(state.started).flat().map(norm)]);
  const remaining = [...library.keys()].filter(key => !covered.has(key)).length;
  const days = Math.ceil(remaining/target);
  $('target').value = target;
  $('goalStatus').textContent = count+' of '+target+' words practised today'+(count>=target?' · Goal achieved':'');
  $('goalProgress').max = target;
  $('goalProgress').value = count;
  $('forecast').textContent = remaining
    ? 'At '+target+' new words per day, you could start the remaining '+remaining.toLocaleString()+' entries in about '+days+' '+(days===1?'day':'days')+'.'
    : 'You’ve started every entry in your library.';
  $('history').replaceChildren();
  for(const day of [today,...[...new Set([...Object.keys(state.started), ...Object.keys(state.learned)])].filter(day=>day!==today).sort().reverse()]){
    const words = [...practiced(day)].map(key=>library.get(key) ?? key);
    const group = document.createElement('details');
    const heading = document.createElement('summary');
    const items = document.createElement('ul');
    const label = day===today?'today':new Date(day+'T12:00:00').toLocaleDateString();
    const savedGoal = state.goals[day];
    heading.textContent = words.length+' '+(words.length===1?'word':'words')+' practised '+label+
      (savedGoal ? ' · goal '+savedGoal+(words.length>=savedGoal?' achieved':'') : '');
    list(items,words);
    group.append(heading,items);
    $('history').append(group);
  }
}
$('goalForm').onsubmit = event => {
  event.preventDefault();
  const target = Number($('target').value);
  if (!Number.isInteger(target) || target<1 || target>10000) return;
  state.goals[dayKey()] = target;
  save();
  renderGoals();
};
$('restoreProgress').onchange = async () => {
  const file = $('restoreProgress').files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    const cards = Object.values(backup.cards);
    const days = ['started','learned'];
    const validWords = words => Array.isArray(words) && words.every(word => typeof word === 'string');
    if (!cards.every(c => c && typeof c.word === 'string' && Number.isInteger(c.streak) &&
        c.streak >= 0 && c.streak <= 3 && Number.isFinite(c.due) && typeof c.review === 'boolean') ||
        !validWords(backup.extra ?? []) ||
        !days.every(field => Object.entries(backup[field] ?? {}).every(([date,words]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && validWords(words)))) {
      throw Error('Invalid progress backup');
    }
    for (const word of [...(backup.extra ?? []), ...cards.map(c=>c.word)]) {
      const key = norm(word);
      if (!library.has(key)) {
        library.set(key,word);
        state.extra.push(word);
      }
    }
    for (const item of cards) {
      const key = norm(item.word);
      if (!card(key)) Object.defineProperty(state.cards,key,{value:item,enumerable:true,writable:true,configurable:true});
    }
    for (const field of days) {
      for (const [date,words] of Object.entries(backup[field] ?? {})) {
        state[field][date] = [...new Map([...(state[field][date] ?? []), ...words].map(word=>[norm(word),word])).values()];
      }
    }
    for (const [date,goal] of Object.entries(backup.goals ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isInteger(goal) && goal>=1 && goal<=10000) state.goals[date] ??= goal;
    }
    save();
    next();
    renderGoals();
    $('restoreStatus').textContent = 'Merged backup with '+cards.length+' word records. Existing word progress was kept.';
  } catch {
    $('restoreStatus').textContent = 'Could not read this progress backup.';
  }
  $('restoreProgress').value = '';
};
function renderLibrary(){
  const words=[...library.values()].filter(w=>norm(w).includes(norm($('search').value)));
  $('librarySummary').textContent=library.size+' unique entries · '+seed.length+' rows from your original document';
  list($('wordList'),words.slice(0,visible));$('more').hidden=words.length<=visible;
}
$('search').oninput=()=>{visible=100;renderLibrary();};
$('more').onclick=()=>{visible+=100;renderLibrary();};
async function docx(file){
  const bytes=new Uint8Array(await file.arrayBuffer()), view=new DataView(bytes.buffer);
  const u16=i=>view.getUint16(i,true), u32=i=>view.getUint32(i,true);
  let end=bytes.length-22;
  while(end>=Math.max(0,bytes.length-65557)&&u32(end)!==0x06054b50) end--;
  if(end<0 || u32(end)!==0x06054b50) throw Error('Invalid Word file');
  let i=u32(end+16);
  for(let entry=0;entry<u16(end+10);entry++){
    if(u32(i)!==0x02014b50) break;
    const nameLen=u16(i+28);
    if(new TextDecoder().decode(bytes.slice(i+46,i+46+nameLen))==='word/document.xml'){
      const offset=u32(i+42), start=offset+30+u16(offset+26)+u16(offset+28);
      const data=bytes.slice(start,start+u32(i+20));
      const xml=u16(i+10)===0?new TextDecoder().decode(data):await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const documentXml=new DOMParser().parseFromString(xml,'application/xml');
      const get=(el,tag)=>[...el.getElementsByTagNameNS(ns,tag)];
      const read=el=>get(el,'t').map(t=>t.textContent).join('');
      const rows=get(documentXml,'tr');
      return rows.length?rows.map(row=>get(row,'tc')[0]).filter(Boolean).map(read):get(documentXml,'p').map(read);
    }
    i+=46+nameLen+u16(i+30)+u16(i+32);
  }
  throw Error('No Word text found');
}
$('file').onchange=async()=>{
  const file=$('file').files[0];if(!file)return;
  try{
    let words=/\.docx$/i.test(file.name)?await docx(file):(await file.text()).split(/\r?\n/);
    if(/\.csv$/i.test(file.name)) words=words.map(row=>{const first=row.match(/^"((?:[^"]|"")*)"|^([^,]*)/);return first?.[1]?.replace(/""/g,'"')??first?.[2]??'';});
    let added=0;
    for(const value of words){
      const word=value.trim(), key=norm(word);
      if(!key || /^(word|phrase|word \/ phrase)$/i.test(word) || /^\d+\s*\|/.test(word)||word==='ADDITIONAL VOCABULARY FROM PERSONAL SPELLING LIST'||library.has(key))continue;
      library.set(key,word);state.extra.push(word);added++;
    }
    save();renderLibrary();if(!current)next();
    $('importStatus').textContent=added+' new entries added.';
  }catch(error){$('importStatus').textContent='Could not read this list. Try a plain text file with one entry per line.';}
  $('file').value='';
};
$('draft').value=state.draft;
$('draft').oninput=()=>{state.draft=$('draft').value;save();};
const tokens=s=>s.match(/[\p{L}\p{N}]+(?:['’‐‑–—-][\p{L}\p{N}]+)*/gu)||[];
function distance(a,b){
  let earlier;
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const prev=row;row=[i];
    for(let j=1;j<=b.length;j++){
      row[j]=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]!==b[j-1]));
      if(i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) row[j]=Math.min(row[j],earlier[j-2]+1);
    }
    earlier=prev;
  }
  return row[b.length];
}
function compare(typed,reference){
  const a=typed.map(norm), b=reference.map(norm), width=b.length+1;
  const grid=new Uint32Array((a.length+1)*width);
  for(let i=0;i<=a.length;i++)grid[i*width]=i;
  for(let j=0;j<=b.length;j++)grid[j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
    const p=i*width+j;
    grid[p]=Math.min(grid[p-width]+1,grid[p-1]+1,grid[p-width-1]+(a[i-1]===b[j-1]?0:1));
  }
  const out=[];let i=a.length,j=b.length;
  while(i||j){
    const p=i*width+j;
    if(i&&j&&grid[p]===grid[p-width-1]+(a[i-1]===b[j-1]?0:1)){
      if(a[i-1]!==b[j-1])out.push({raw:typed[i-1],word:reference[j-1]});
      i--;j--;
    }else if(j&&grid[p]===grid[p-1]+1){out.push({raw:'',word:reference[--j]});}
    else {out.push({raw:typed[--i],word:''});}
  }
  return out.reverse();
}
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const fileRecognition = Recognition && Number(navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]) >= 135 &&
  !/Android|Mobile/.test(navigator.userAgent) && window.AudioContext;
let voiceText = '', cancelAudio, player, mediaUrl;
$('showLive').onchange = () => { $('livePanel').hidden = !$('showLive').checked; };
$('speed').onchange = () => { if (player) player.playbackRate = Number($('speed').value); };
function seek(seconds) {
  if (player && Number.isFinite(player.duration)) player.currentTime = Math.min(player.duration, Math.max(0, player.currentTime+seconds));
}
$('backMedia').onclick = () => seek(-5);
$('forwardMedia').onclick = () => seek(5);
if (!fileRecognition) $('voiceStatus').textContent = 'Open this app in desktop Chrome 135 or later to transcribe a file. You can also paste the official transcript.';
$('audioFile').onchange = () => {
  voiceText = '';
  $('liveText').textContent = '';
  $('results').replaceChildren();
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
    player.hidden = true;
  }
  if (mediaUrl) URL.revokeObjectURL(mediaUrl);
  const file = $('audioFile').files[0];
  $('mediaControls').hidden = !file;
  if (file) {
    player = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)
      ? $('videoPlayer') : $('audioPlayer');
    mediaUrl = URL.createObjectURL(file);
    player.src = mediaUrl;
    player.playbackRate = Number($('speed').value);
    player.hidden = false;
  }
  $('listen').disabled = !fileRecognition || !file;
  if (fileRecognition) $('voiceStatus').textContent = '';
};
$('listen').onclick = async () => {
  const file = $('audioFile').files[0];
  if (!fileRecognition || !file || cancelAudio) return;
  voiceText = '';
  $('results').replaceChildren();
  $('listen').disabled = $('analyze').disabled = $('audioFile').disabled = true;
  $('stopListen').disabled = false;
  $('voiceStatus').textContent = 'Preparing audio…';
  $('liveText').textContent = '';

  let context, session, source, track, timer;
  let finished = false, reachedEnd = false, transcript = '';
  const finish = (message, keep = false) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    session?.abort();
    track?.stop();
    context?.close().catch(() => {});
    voiceText = keep ? transcript : '';
    $('liveText').textContent = voiceText;
    cancelAudio = null;
    $('listen').disabled = $('analyze').disabled = $('audioFile').disabled = false;
    $('stopListen').disabled = true;
    $('voiceStatus').textContent = message;
  };
  cancelAudio = () => finish('Transcription cancelled. Your typed draft is saved.');
  try {
    context = new AudioContext();
    await context.resume();
    if (finished) return;
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (finished) return;
    const destination = context.createMediaStreamDestination();
    track = destination.stream.getAudioTracks()[0];
    source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    session = new Recognition();
    session.lang = $('speechLanguage').value;
    session.interimResults = true;
    session.continuous = true;
    session.onstart = () => {
      if (finished) return;
      clearTimeout(timer);
      $('voiceStatus').textContent = 'Transcribing the file. Use the player to listen at your own pace.';
      source.start();
      $('draft').focus();
    };
    session.onresult = event => {
      transcript = Array.from(event.results).filter(result => result.isFinal)
        .map(result => result[0].transcript.trim()).join(' ');
      $('liveText').textContent = Array.from(event.results)
        .map(result => result[0].transcript.trim()).join(' ');
      $('livePanel').scrollTop = $('livePanel').scrollHeight;
    };
    source.onended = () => {
      if (finished) return;
      reachedEnd = true;
      $('voiceStatus').textContent = 'Finishing the transcript…';
      timer = setTimeout(() => finish('Transcription did not finish. Try a shorter clip.'), 15000);
      session.stop();
    };
    session.onerror = event => finish(event.error === 'network'
      ? 'Chrome could not reach its speech service. Check your connection and try again.'
      : 'Chrome could not transcribe this audio. Try another file or paste the official transcript.');
    session.onend = () => {
      if (reachedEnd && transcript) finish('Transcript ready. Select Review transcript when you’re ready.', true);
      else finish('A complete transcript was unavailable. Try a shorter clip with clear speech.');
    };
    timer = setTimeout(() => finish('Chrome could not start file transcription.'), 15000);
    session.start(track);
  } catch {
    finish('Could not read or transcribe this file. Try an MP3, WAV or MP4 file with a supported audio track.');
  }
};
$('stopListen').onclick = () => cancelAudio?.();
function accuracy(guesses, total) {
  const missing = guesses.filter(item => !item.raw).length;
  const extra = guesses.filter(item => !item.word).length;
  const changed = guesses.length - missing - extra;
  return {missing, extra, changed, percent: Math.max(0, Math.round(100 * (total - guesses.length) / total))};
}
$('analyze').onclick=()=>{
  const typed=tokens($('draft').value), official=tokens($('reference').value), target=$('results');
  const ref = official.length ? official : tokens(voiceText);
  const automatic = ref.length > 0 && !official.length;
  target.replaceChildren();
  if(!typed.length && !ref.length){target.textContent='Type or paste your transcript first.';return;}
  if(typed.length>2500 || ref.length>2500){target.textContent='Review one passage at a time, up to 2,500 words per box.';return;}
  const guesses=ref.length?compare(typed,ref):[];
  if(!ref.length){
    const pool=[...library].filter(([k])=>/^[\p{L}]+$/u.test(k)&&k.length>=4);
    for(const raw of new Set(typed.map(norm))){
      if(raw.length<4||library.has(raw)||!/^\p{L}+$/u.test(raw))continue;
      let best=raw.length>=8?3:2;
      let matches=[];
      for(const [key,word] of pool){
        if(Math.abs(key.length-raw.length)>best)continue;
        const d=distance(raw,key);
        if(d<best){best=d;matches=[word];}else if(d===best)matches.push(word);
      }
      if(matches.length===1 && best<=(raw.length>=8?2:1))guesses.push({raw,word:matches[0]});
    }
  }
  if(ref.length){
    const score = accuracy(guesses, ref.length);
    const summary = document.createElement('p');
    summary.textContent = (automatic ? 'Estimated word accuracy: ' : 'Word accuracy: ') + score.percent +
      '% · ' + score.missing + ' missing · ' + score.changed + ' different · ' + score.extra + ' extra';
    target.append(summary);
    if(automatic){
      const details = document.createElement('details');
      const heading = document.createElement('summary');
      const transcript = document.createElement('p');
      heading.textContent = 'Show automatic transcript';
      transcript.textContent = voiceText;
      details.append(heading, transcript);
      target.append(details);
    }
  }
  const unique=[...new Map(guesses.map(g=>[JSON.stringify([norm(g.raw),norm(g.word)]),g])).values()];
  const note=document.createElement('p');
  note.textContent=automatic?'Speech recognition can mishear words or miss part of the audio. Confirm each correction before adding it.':ref.length?'Review the differences and choose which expected words to practise.':'These are spelling guesses based on your library. Check each one before adding it. Use the official transcript to find omissions and wrong words that are spelled correctly.';
  target.append(note);
  if(!unique.length){target.append('No '+(ref.length?'word differences':'close matches')+' found.');return;}
  const options=[];
  for(const {raw,word} of unique){
    const label=document.createElement('label');
    if(!word){label.textContent='Extra word · '+raw;target.append(label);continue;}
    const input=document.createElement('input');input.type='checkbox';input.checked=!!official.length;
    label.append(input,' '+(raw||'Missing word')+' → '+word);
    options.push({input,word});target.append(label);
  }
  if(!options.length)return;
  const add=document.createElement('button');add.textContent='Add selected to needs mastery';
  add.onclick=()=>{
    const selected=new Map(options.filter(o=>o.input.checked).map(o=>[norm(o.word),o.word]));
    for(const word of selected.values())record(word,false);
    if(selected.size){add.disabled=true;add.textContent=selected.size+' added to needs mastery';next();}
  };
  target.append(add);
};
$('manual').onsubmit=e=>{e.preventDefault();const word=$('manualWord').value.trim();if(!word)return;record(word,false);$('manualWord').value='';$('manualStatus').textContent=word+' added to needs mastery.';if(!current)next();};
next();show('practice');
