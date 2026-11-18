# Live sounds page

Open `http://localhost:8000/live-sounds.html` after starting both services with `python run_servers.py --mock` or the real Ganglion port. The page connects to the existing EEG WebSocket on `localhost:8765`. It does not load or play audio.

1. Keep the Test page closed while recording. The EEG service has one global stream and global start/stop state.
2. Connect EEG and wait for the ready message.
3. Start and stop a quiet baseline segment.
4. Describe a sound, start it on your external device when you click **Start sound**, and stop the segment when the sound ends. Repeat with other sounds.
5. Export the session JSON for a durable copy. The JSON contains labels, notes, timestamps, and the EEG readings received during each segment.

The live chart shows the most recent 90 relative band power readings. The table reports mean alpha and percentage-point changes in all five relative bands compared with the first baseline. These are descriptive observations, not causal estimates. The EEG service sends rolling band estimates and quality metrics, not raw waveform samples. A segment stops at 3,600 readings to limit browser storage use. Saved segments remain in this browser's local storage until a new session is started or browser data is cleared; they do not enter the existing Test/Analyze database.
