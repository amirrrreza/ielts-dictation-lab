# IELTS Dictation Lab

Practise IELTS listening with your own recordings. In Guided Dictation, the
player stops after a few words so you can type what you heard before moving on.

## Start the app on a Mac

1. Install Python 3.12 and check that `python3 --version` works in Terminal.
2. Download and unzip the source, or clone the repository.
3. Double-click **Start IELTS Dictation Lab.command**. If Finder blocks the
   launcher, open Terminal in the project folder and run
   `zsh 'Start IELTS Dictation Lab.command'`.
4. If the browser does not open, visit [127.0.0.1:8765](http://127.0.0.1:8765/).
   Keep the Terminal window open during practice.

The first launch downloads Python dependencies. The first transcription in
each language downloads its speech model. Both are saved in Application
Support so they can be reused.

To run the server directly from the project folder:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python guided_server.py
```

## Practise with a recording

Open **Transcript** and choose an audio or video file up to 200 MB. Use the
player to pause, skip back, or slow the recording down.

For a guided session, select English or Persian and choose two words, three
words, or a sentence per turn. Click **Start guided dictation**. Type what you
hear and press Enter. If the answer differs from the reference, you can replay
the clip, try again, or reveal the answer and skip ahead. At the end, the app
shows your transcript and estimated word accuracy. Corrections from earlier
tries appear in the feedback even if you got them right on a retry.

Choose **Full transcript** to read the generated text without starting a
session. For free typing, use the scratchpad and paste the official transcript
if you have it. When the speech model merges or mishears letters, it may split
a spelling exercise across clips.

## Practise words and phrases

The library has eight sample entries. Import more from a TXT file with one
entry per line, or use the first column of a CSV or DOCX table.

In **Practice**, listen to the prompt and type the answer. A correct answer
schedules another recall after ten minutes, then after a day. Three
consecutive correct recalls mark the entry as mastered. A mistake resets the
streak. Add corrections from a recording to **Needs mastery** to practise them
again.

Set a target in **Goals & records**. An entry counts once a day when you play
its prompt or check an answer.

## Where data is stored

Practice history and drafts are saved in the browser profile at the local
app address. A fresh profile starts with empty progress. Clearing that
profile's site data removes the records.

Guided Dictation and Full Transcript process selected files on your computer.
If you use the separate browser transcription option, the browser may send
the audio to its speech service. Use Chrome for that option.

## Source and license

The interface is in `web/`. The Python server in `guided_server.py` serves
the pages and produces transcripts with word timings.

The app uses the [MIT license](LICENSE). Dependencies and speech models have
their own licenses.
