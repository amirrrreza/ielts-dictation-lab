const guidedAvailable = location.origin === 'http://127.0.0.1:8765';
let guidedSession;
const guidedButton = $('guidedStart');
const fullButton = $('fullTranscript');
let cachedWords;
const guidedStatus = $('guidedStatus');
if (!guidedAvailable) guidedStatus.textContent = 'Open Start IELTS Dictation Lab.command to use guided dictation.';
$('audioFile').addEventListener('change', () => {
  stopGuided();
  cachedWords = null;
  $('fullPanel').hidden = true;
  $('fullPanel').open = false;
  $('fullText').textContent = '';
  fullButton.disabled = guidedButton.disabled = !guidedAvailable || !$('audioFile').files.length;
  if (guidedAvailable) guidedStatus.textContent = '';
});
function stopGuided() {
  if (guidedSession) {
    player?.pause();
    guidedSession.controller.abort();
    cancelAnimationFrame(guidedSession.frame);
  }
  guidedSession = null;
  $('guidedTurn').hidden = true;
  $('guidedResults').hidden = true;
}
function spellingLength(text) {
  const value = text.trim().replace(/[.,;:!?]+$/, '');
  if (/^[a-z]$/i.test(value)) return 1;
  if (/^[a-z](?:[.‐‑–—-][a-z])+$/i.test(value)) return value.replace(/[^a-z]/gi, '').length;
  return 0;
}
function groupWords(words, size) {
  const groups = [];
  let chunk = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    let end = index;
    let letters = spellingLength(word.text);
    if (letters) {
      while (end+1 < words.length && spellingLength(words[end+1].text) &&
          words[end+1].start-words[end].end < 1.5) {
        letters += spellingLength(words[++end].text);
      }
    }
    if (letters >= 3) {
      if (chunk.length) groups.push(chunk);
      chunk = [];
      const spelling = words.slice(index,end+1);
      spelling.isSpelling = true;
      groups.push(spelling);
      index = end;
      continue;
    }
    chunk.push(word);
    if (size === 'sentence' ? /[.!?؟]["'”)]*\s*$/.test(word.text) || chunk.length >= 24 : chunk.length >= Number(size)) {
      groups.push(chunk);
      chunk = [];
    }
  }
  if (chunk.length) groups.push(chunk);
  return groups;
}
guidedButton.onclick = () => prepareGuided(true);
fullButton.onclick = () => prepareGuided(false);
async function prepareGuided(practice) {
  if (!guidedAvailable || !player || cancelAudio) return;
  const file = $('audioFile').files[0];
  stopGuided();
  player.pause();
  const session = {controller: new AbortController(), index: 0, correct: 0, answers: [], mistakes: new Map()};
  guidedSession = session;
  guidedButton.disabled = fullButton.disabled = $('listen').disabled = true;
  $('fullPanel').hidden = true;
  $('fullPanel').open = false;
  $('showLive').checked = false;
  $('livePanel').hidden = true;
  $('results').replaceChildren();
  guidedStatus.textContent = 'Preparing the hidden transcript. The first run may download a speech model.';
  try {
    const language = $('speechLanguage').value.startsWith('fa') ? 'fa' : 'en';
    let words = cachedWords?.language === language ? cachedWords.words : null;
    if (!words) {
      const response = await fetch('/transcribe/' + language, {method:'POST', body:file, signal:session.controller.signal});
      words = await response.json();
      if (session !== guidedSession) return;
      if (!response.ok) throw Error(words.error);
      if (!words.length) throw Error('No speech was found in this file.');
      cachedWords = {language, words};
    }
    session.groups = groupWords(words, $('chunkSize').value);
    voiceText = words.map(word => word.text.trim()).join(' ');
    if (!practice) {
      $('fullText').textContent = voiceText;
      $('fullPanel').hidden = false;
      $('fullPanel').open = true;
      guidedStatus.textContent = 'Full transcript ready. You can also use it to review your typing.';
      return;
    }
    $('guidedTurn').hidden = false;
    guidedStatus.textContent = 'Listen to each group, type it, and press Enter. Use Replay whenever you need to hear it again.';
    startTurn();
  } catch (error) {
    if (session === guidedSession) guidedStatus.textContent = error.message;
  } finally {
    if (session === guidedSession) {
      guidedButton.disabled = fullButton.disabled = false;
      $('listen').disabled = !fileRecognition;
    }
  }
}
function startTurn() {
  const session = guidedSession;
  const chunk = session.groups[session.index];
  if (!chunk) {
    $('guidedTurn').hidden = true;
    guidedStatus.textContent = 'Finished. ' + session.correct + ' of ' + session.groups.length + ' groups completed correctly.';
    showGuidedResults(session);
    return;
  }
  $('chunkProgress').textContent = 'Group ' + (session.index+1) + ' of ' + session.groups.length + (chunk.isSpelling ? ' · Spelling' : ' · ' + chunk.length + ' timed words');
  $('chunkSkip').textContent = 'Show answer and skip';
  $('chunkAnswer').value = '';
  $('chunkFeedback').textContent = '';
  session.ready = false;
  $('chunkAnswer').focus();
  playChunk();
}
function playChunk() {
  const session = guidedSession;
  if (!session?.groups?.[session.index]) return;
  const chunk = session.groups[session.index];
  cancelAnimationFrame(session.frame);
  session.ready = false;
  $('chunkFeedback').textContent = '';
  const previous = session.groups[session.index-1]?.at(-1);
  const following = session.groups[session.index+1]?.[0];
  const start = previous ? Math.min(chunk[0].start, previous.end) : Math.max(0,chunk[0].start-.08);
  const end = following ? Math.max(chunk.at(-1).end, Math.min(chunk.at(-1).end+.06, following.start)) : chunk.at(-1).end+.08;
  player.currentTime = start;
  const pauseAtEnd = () => {
    if (guidedSession !== session) return;
    if (player.currentTime >= end || player.ended) {
      player.pause();
      session.ready = true;
    } else {
      session.frame = requestAnimationFrame(pauseAtEnd);
    }
  };
  player.play().then(() => {
    if (guidedSession === session) session.frame = requestAnimationFrame(pauseAtEnd);
  }).catch(() => {
    if (guidedSession === session) $('chunkFeedback').textContent = 'Playback was blocked. Select Replay to start this group.';
  });
}
$('chunkReplay').onclick = playChunk;
function advance(answer, correct) {
  const session = guidedSession;
  session.answers.push(answer);
  if (correct) {
    session.correct++;
    (session.accepted ??= new Set()).add(session.index);
  }
  cancelAnimationFrame(session.frame);
  player.pause();
  session.index++;
  startTurn();
}
$('chunkForm').onsubmit = event => {
  event.preventDefault();
  const session = guidedSession;
  const chunk = session?.groups?.[session.index];
  if (!chunk || !session.ready) return;
  const answer = $('chunkAnswer').value.trim();
  const expected = chunk.map(word => word.text.trim()).join(' ');
  const comparable = text => tokens(text).map(norm).join(' ');
  const spelling = value => norm(value).replace(/[.\s‐‑–—-]/g,'');
  if (chunk.isSpelling ? spelling(answer) === spelling(expected.replace(/[.,;:!?]/g,'')) : comparable(answer) === comparable(expected)) {
    advance(answer,true);
  } else {
    const differences = noteDifferences(session, answer, expected);
    const hints = differences.filter(item => item.raw && item.word).map(item => '“'+item.raw+'” may be misspelled or misheard');
    const missing = differences.filter(item => !item.raw).length;
    const extra = differences.filter(item => !item.word).length;
    if (missing) hints.push(missing+' missing');
    if (extra) hints.push(extra+' extra');
    $('chunkFeedback').textContent = hints.join(' · ') + '. Replay and try again.';
  }
};
$('chunkSkip').onclick = () => {
  const session = guidedSession;
  const chunk = session?.groups?.[session.index];
  if (!chunk) return;
  player.pause();
  cancelAnimationFrame(session.frame);
  const expected = chunk.map(word => word.text.trim()).join(' ');
  if (session.revealed === session.index) {
    $('chunkSkip').textContent = 'Show answer and skip';
    const answer = $('chunkAnswer').value.trim();
    noteDifferences(session, answer, expected);
    advance(answer,false);
  } else {
    session.ready = true;
    session.revealed = session.index;
    $('chunkFeedback').textContent = expected;
    $('chunkSkip').textContent = 'Skip this group';
  }
};

function noteDifferences(session, answer, expected) {
  const differences = compare(tokens(answer), tokens(expected));
  for (const item of differences) {
    const key = JSON.stringify([norm(item.raw),norm(item.word)]);
    if (!session.mistakes.has(key)) session.mistakes.set(key,item);
  }
  return differences;
}
function showGuidedResults(session) {
  const reference = session.groups.map(group => group.map(word => word.text.trim()).join(' '));
  const submitted = session.answers.join(' ');
  const differences = reference.flatMap((line,index) => {
    if (session.groups[index].isSpelling && session.accepted?.has(index)) return [];
    return compare(tokens(session.answers[index]),tokens(line));
  });
  const result = accuracy(differences, tokens(reference.join(' ')).length);
  $('guidedAccuracy').textContent = 'Estimated word accuracy: '+result.percent+'% · '+result.missing+' missing · '+result.changed+' different · '+result.extra+' extra';
  $('guidedDraft').textContent = submitted.trim() || 'No words submitted.';
  $('guidedReference').textContent = reference.join(' ');
  const choices = [];
  const mistakes = $('guidedMistakes');
  mistakes.replaceChildren();
  $('guidedMistakeNote').textContent = session.mistakes.size
    ? 'This list includes words you corrected on a retry. The score uses your final submission for each group. Check the suggested words against the recording before adding them.'
    : 'No word differences recorded.';
  for (const item of session.mistakes.values()) {
    const label = document.createElement('label');
    if (item.word) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      label.append(box, ' '+(item.raw || 'Missing word')+' → '+item.word);
      choices.push({box,word:item.word});
    } else {
      label.textContent = 'Extra word · '+item.raw;
    }
    mistakes.append(label);
  }
  const add = $('guidedAdd');
  add.hidden = !choices.length;
  add.onclick = () => {
    const selected = new Map(choices.filter(choice => choice.box.checked).map(choice => [norm(choice.word),choice.word]));
    for (const word of selected.values()) record(word,false);
    if (selected.size) {
      $('guidedMistakeNote').textContent = selected.size+' words added to needs mastery.';
      for (const choice of choices) if (selected.has(norm(choice.word))) choice.box.checked = false;
    }
  };
  $('guidedResults').querySelector('details').open = false;
  $('guidedResults').hidden = false;
}
