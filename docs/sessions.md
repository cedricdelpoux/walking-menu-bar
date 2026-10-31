# How sessions are recorded

A session starts when the belt runs. It ends when the belt has not moved for longer than the pause timeout (5 minutes by default), and its end time is the last moment the belt moved. A short stop keeps the same session.

The pad counters (time, distance, steps) are never stored as is. Each status is turned into a delta against the previous reading, which is saved in the database. A counter that decreases, or a pad clock that advanced faster than the wall clock, means the counters were reset in between. The C2 resets them when it falls asleep, for example. The new values are then counted from zero. Every status is written to the database as it arrives, so a crash or a sleeping Mac loses nothing, and the active session resumes on the next start.

The max speed only counts speeds held for 3 seconds, which ignores the short spike some pads report when the belt starts.
