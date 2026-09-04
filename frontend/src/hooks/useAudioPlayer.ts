import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../types";
import { usePersistentState } from "../utils/usePersistentState";

export type RepeatMode = "off" | "all" | "one";

export interface AudioPlayerOptions {
  /**
   * Resolve a fresh playable Track (new audio URL) for an expired or dead
   * stream. Return null to fall back to skip-to-next. Retried at most once
   * per track source.
   */
  refreshTrack?: (track: Track) => Promise<Track | null>;
}

export interface UseAudioPlayer {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Second element used as the fade-in voice during crossfades. */
  audioRefB: React.RefObject<HTMLAudioElement | null>;
  queue: Track[];
  currentTrack: Track | undefined;
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  /** Crossfade length in seconds (0 = off). Persisted. */
  crossfade: number;
  progress: number;
  streamError: string | null;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  playFrom: (index: number) => void;
  replaceQueue: (tracks: Track[], startIndex?: number) => void;
  /** Insert tracks right after the current one (no autoplay). */
  queueNext: (track: Track) => void;
  /** Append a track to the end of the queue (no autoplay). */
  queueLast: (track: Track) => void;
  /** Swap an optimistic placeholder for its resolved track (same position). */
  replaceQueuedTrack: (tempId: string, track: Track) => void;
  /** Remove a queued track by id (used to revert failed placeholders). */
  removeFromQueue: (id: string) => void;
  /** Move a queued track; the current index follows the playing track. */
  moveInQueue: (from: number, to: number) => void;
  seek: (time: number) => void;
  setVolumeValue: (value: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setCrossfade: (seconds: number) => void;
  restart: () => void;
  clearStreamError: () => void;
}

/**
 * Playback state + <audio> wiring for the bottom player.
 * Handles play/pause, queue swapping, shuffle, repeat, seek, volume (persisted),
 * buffering, Media Session integration, keyboard shortcuts and stream errors.
 */
export function useAudioPlayer(
  initialTracks: Track[],
  startIndex = 0,
  options: AudioPlayerOptions = {},
): UseAudioPlayer {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioRefB = useRef<HTMLAudioElement>(null);

  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [index, setIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = usePersistentState("mellow-volume", 0.7);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [crossfade, setCrossfadeState] = usePersistentState(
    "mellow-crossfade",
    5,
  );
  const [streamError, setStreamError] = useState<string | null>(null);

  // Refs mirroring state so the one-time audio listeners always read fresh values.
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const crossfadeRef = useRef(crossfade);
  const tracksRef = useRef(tracks);
  const refreshRef = useRef(options.refreshTrack);
  /** Track key that already failed a refresh — retry at most once per source. */
  const refreshFailedFor = useRef<string | null>(null);
  /** 0|1 — which element is the audible front voice. */
  const frontIdxRef = useRef<0 | 1>(0);
  /** Active crossfade, if any. */
  const fadeRef = useRef<{
    oldEl: HTMLAudioElement;
    newEl: HTMLAudioElement;
    raf: number;
    start: number;
    seconds: number;
  } | null>(null);
  /** Fade length requested for the pending index change (auto = remaining). */
  const fadePendingRef = useRef<number | null>(null);
  /** Index the active fade was started for (interruptions finish it first). */
  const fadeForIndexRef = useRef<number | null>(null);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    crossfadeRef.current = crossfade;
  }, [crossfade]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    refreshRef.current = options.refreshTrack;
  }, [options.refreshTrack]);

  /* ---------------- Crossfade engine (dual element) ---------------- */

  const elementAt = useCallback(
    (idx: 0 | 1): HTMLAudioElement | null =>
      idx === 0 ? audioRef.current : audioRefB.current,
    [],
  );
  const frontEl = useCallback(
    (): HTMLAudioElement | null => elementAt(frontIdxRef.current),
    [elementAt],
  );
  const backEl = useCallback(
    (): HTMLAudioElement | null =>
      elementAt(frontIdxRef.current === 0 ? 1 : 0),
    [elementAt],
  );
  /** Complete (or cancel) any active fade instantly. Always safe to call. */
  const finishFade = useCallback((): void => {
    const fade = fadeRef.current;
    if (!fade) return;
    cancelAnimationFrame(fade.raf);
    fadeRef.current = null;
    fadeForIndexRef.current = null;
    try {
      fade.oldEl.pause();
    } catch {
      // Already stopped — nothing to do.
    }
    fade.oldEl.volume = 0;
    fade.newEl.volume = mutedRef.current ? 0 : volumeRef.current;
  }, []);

  /** Begin an overlapping fade from oldEl to newEl already pointed at src. */
  const startCrossfade = useCallback(
    (
      oldEl: HTMLAudioElement,
      newEl: HTMLAudioElement,
      src: string,
      seconds: number,
      onPlayFailed: () => void,
    ): void => {
      finishFade();
      frontIdxRef.current = (
        elementAt(0) === newEl ? 0 : 1
      ) as 0 | 1;
      newEl.volume = 0;
      newEl.src = src;
      newEl.load();
      setCurrentTime(0);
      setDuration(0);
      const dur = Math.max(0.4, seconds);
      fadeRef.current = {
        oldEl,
        newEl,
        raf: 0,
        start: performance.now(),
        seconds: dur,
      };
      const tick = () => {
        const fade = fadeRef.current;
        if (!fade) return;
        const target = mutedRef.current ? 0 : volumeRef.current;
        const t = Math.min(
          1,
          (performance.now() - fade.start) / (fade.seconds * 1000),
        );
        fade.newEl.volume = target * t;
        fade.oldEl.volume = target * (1 - t);
        if (t >= 1) {
          finishFade();
          return;
        }
        fade.raf = requestAnimationFrame(tick);
      };
      fadeRef.current.raf = requestAnimationFrame(tick);
      void newEl.play().catch(() => {
        // New voice refused to start — revert to the old one and skip on.
        if (fadeRef.current?.newEl === newEl) {
          fadeRef.current = null;
          frontIdxRef.current = (
            elementAt(0) === oldEl ? 0 : 1
          ) as 0 | 1;
          try {
            newEl.pause();
          } catch {
            // Ignore pause failures on a dead element.
          }
          newEl.volume = 0;
          onPlayFailed();
        }
      });
    },
    [elementAt, finishFade],
  );

  const isExpiredTrack = useCallback((track: Track | undefined): boolean => {
    if (!track?.expiresAt) return false;
    const expiry = new Date(track.expiresAt).getTime();
    return Number.isFinite(expiry) && expiry <= Date.now();
  }, []);

  /**
   * Swap a dead/expired stream for a fresh URL and resume from `position`.
   * Returns true when the error was absorbed (no skip needed).
   */
  const attemptRefresh = useCallback(
    async (targetIndex: number, position: number): Promise<boolean> => {
      const refresh = refreshRef.current;
      const target = tracksRef.current[targetIndex];
      if (!refresh || !target?.source) return false;
      const key = `${targetIndex}:${target.source}`;
      if (refreshFailedFor.current === key) return false;
      refreshFailedFor.current = key;
      finishFade();
      setIsBuffering(true);
      try {
        const fresh = await refresh(target);
        if (!fresh?.source) return false;
        // User moved on while we were refreshing — just absorb the error.
        if (indexRef.current !== targetIndex) return true;
        setTracks((prev) =>
          prev.map((t, i) => (i === targetIndex ? fresh : t)),
        );
        const audio = frontEl();
        if (!audio) return false;
        audio.src = fresh.source;
        audio.load();
        audio.currentTime = Math.max(0, position);
        setCurrentTime(audio.currentTime);
        if (isPlayingRef.current) {
          await audio.play();
        }
        return true;
      } catch {
        return false;
      } finally {
        setIsBuffering(false);
      }
    },
    [finishFade, frontEl],
  );

  const pickIndex = useCallback(
    (except: number) => {
      if (tracks.length <= 1) return except;
      let candidate = except;
      while (candidate === except) {
        candidate = Math.floor(Math.random() * tracks.length);
      }
      return candidate;
    },
    [tracks.length],
  );

  /** Next index per shuffle/repeat rules, or null when playback should stop. */
  const computeNextIndex = useCallback((): number | null => {
    const length = tracksRef.current.length;
    if (length === 0) return null;
    if (repeatRef.current === "one") return indexRef.current;
    if (
      shuffleRef.current ||
      repeatRef.current === "all" ||
      indexRef.current < length - 1
    ) {
      return shuffleRef.current
        ? pickIndex(indexRef.current)
        : (indexRef.current + 1) % length;
    }
    return null;
  }, [pickIndex]);

  /** Manual switches request a short fade; auto-advance sets remaining time. */
  const requestManualFade = useCallback((): void => {
    const fadeLength = crossfadeRef.current;
    fadePendingRef.current =
      fadeLength > 0 ? Math.min(2, fadeLength) : null;
  }, []);

  const goNext = useCallback(() => {
    if (tracksRef.current.length === 0) return;
    requestManualFade();
    setIndex((prev) =>
      shuffleRef.current ? pickIndex(prev) : (prev + 1) % tracksRef.current.length,
    );
  }, [pickIndex, requestManualFade]);

  const goPrevious = useCallback(() => {
    if (tracksRef.current.length === 0) return;
    requestManualFade();
    setIndex((prev) =>
      shuffleRef.current
        ? pickIndex(prev)
        : (prev - 1 + tracksRef.current.length) % tracksRef.current.length,
    );
  }, [pickIndex, requestManualFade]);

  /** Jump to a specific track and start playing it. */
  const playFrom = useCallback(
    (next: number) => {
      const length = tracksRef.current.length;
      if (length === 0) return;
      const target = Math.max(0, Math.min(next, length - 1));
      isPlayingRef.current = true;
      if (target === indexRef.current) {
        void frontEl()?.play();
        return;
      }
      requestManualFade();
      setIndex(target);
    },
    [frontEl, requestManualFade],
  );

  /** Replace the whole queue and start playing the track at startIndex. */
  const replaceQueue = useCallback(
    (nextTracks: Track[], nextIndex = 0) => {
      if (nextTracks.length === 0) return;
      const target = Math.max(0, Math.min(nextIndex, nextTracks.length - 1));
      isPlayingRef.current = true;
      requestManualFade();
      setTracks(nextTracks);
      setIndex(target);
    },
    [requestManualFade],
  );

  /** Insert tracks without disturbing playback (never autoplays). */
  const insertTracks = useCallback((newTracks: Track[], atEnd: boolean) => {
    if (newTracks.length === 0) return;
    setTracks((prev) => {
      const at = atEnd ? prev.length : indexRef.current + 1;
      const next = [...prev];
      next.splice(Math.max(0, Math.min(at, next.length)), 0, ...newTracks);
      return next;
    });
  }, []);

  const queueNext = useCallback(
    (track: Track) => insertTracks([track], false),
    [insertTracks],
  );
  const queueLast = useCallback(
    (track: Track) => insertTracks([track], true),
    [insertTracks],
  );

  /** Fulfil an optimistic placeholder in place (never moves the index). */
  const replaceQueuedTrack = useCallback((tempId: string, track: Track) => {
    setTracks((prev) => {
      if (!prev.some((t) => t.id === tempId)) return prev;
      return prev.map((t) => (t.id === tempId ? track : t));
    });
  }, []);

  /** Remove a queued track; the index follows the playing track. */
  const removeFromQueue = useCallback(
    (id: string) => {
      const list = tracksRef.current;
      const at = list.findIndex((t) => t.id === id);
      if (at === -1) return;
      const current = indexRef.current;
      if (at === current) {
        try {
          frontEl()?.pause();
        } catch {
          // Already stopped — nothing to do.
        }
        setCurrentTime(0);
        setDuration(0);
      }
      const next = list.filter((t) => t.id !== id);
      setTracks(next);
      if (next.length === 0) {
        setIndex(0);
        return;
      }
      if (at < current) setIndex(current - 1);
      else if (at === current) setIndex(Math.min(current, next.length - 1));
    },
    [frontEl],
  );

  /** Reorder the queue; the current index follows the playing track. */
  const moveInQueue = useCallback((from: number, to: number) => {
    if (from === to) return;
    const length = tracksRef.current.length;
    if (from < 0 || from >= length || to < 0 || to >= length) return;
    const current = indexRef.current;
    let nextIndex = current;
    if (from === current) nextIndex = to;
    else if (from < current && to >= current) nextIndex = current - 1;
    else if (from > current && to <= current) nextIndex = current + 1;
    setTracks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    // Same-source guard in the load effect absorbs this when the playing
    // track didn't actually change position content.
    if (nextIndex !== current) setIndex(nextIndex);
  }, []);

  // One-time wiring of both media elements. Only the front voice drives UI
  // state; the fading voice is ignored except for its natural end.
  useEffect(() => {
    const elements = [audioRef.current, audioRefB.current].filter(
      (el): el is HTMLAudioElement => el !== null,
    );
    if (elements.length === 0) return;
    const cleanups: Array<() => void> = [];

    for (const audio of elements) {
      const isFront = () => audio === frontEl();

      const onTime = () => {
        if (!isFront()) return;
        setCurrentTime(audio.currentTime);
        // Auto crossfade: hand over early so the voices overlap.
        const fadeLength = crossfadeRef.current;
        if (
          fadeLength > 0 &&
          !fadeRef.current &&
          Number.isFinite(audio.duration) &&
          audio.duration > fadeLength + 1
        ) {
          const remaining = audio.duration - audio.currentTime;
          if (remaining <= fadeLength && remaining > 0) {
            const nxt = computeNextIndex();
            if (nxt !== null && nxt !== indexRef.current) {
              fadePendingRef.current = remaining;
              setIndex(nxt);
            }
          }
        }
      };
      const onMeta = () => {
        if (!isFront()) return;
        setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      };
      const onPlay = () => {
        if (isFront()) setIsPlaying(true);
      };
      const onPause = () => {
        if (isFront()) setIsPlaying(false);
      };
      const onWaiting = () => {
        if (isFront()) setIsBuffering(true);
      };
      const onReady = () => {
        if (isFront()) setIsBuffering(false);
      };
      const onEnded = () => {
        if (!isFront()) {
          // Fading voice reached its natural end — complete the handover.
          finishFade();
          return;
        }
        if (repeatRef.current === "one") {
          audio.currentTime = 0;
          void audio.play();
          return;
        }
        const nxt = computeNextIndex();
        if (nxt !== null) {
          setIndex(nxt);
        } else {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      };
      const onError = () => {
        if (!isFront()) return;
        // MEDIA_ERR_ABORTED (4) fires on intentional src switches — ignore those.
        if (audio.error && audio.error.code !== 4) {
          const idx = indexRef.current;
          const position = audio.currentTime || 0;
          // Expired streams die with an error: refresh + resume instead of skip.
          void attemptRefresh(idx, position).then((recovered) => {
            if (!recovered) {
              setStreamError("Couldn't play this track. Skipping to the next one.");
              goNext();
            }
          });
        }
      };

      audio.addEventListener("timeupdate", onTime);
      audio.addEventListener("loadedmetadata", onMeta);
      audio.addEventListener("durationchange", onMeta);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("waiting", onWaiting);
      audio.addEventListener("playing", onReady);
      audio.addEventListener("canplay", onReady);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
      cleanups.push(() => {
        audio.removeEventListener("timeupdate", onTime);
        audio.removeEventListener("loadedmetadata", onMeta);
        audio.removeEventListener("durationchange", onMeta);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("waiting", onWaiting);
        audio.removeEventListener("playing", onReady);
        audio.removeEventListener("canplay", onReady);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      });
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [goNext, computeNextIndex, attemptRefresh, frontEl, finishFade]);

  // Load the track when the index changes. When the front voice is audibly
  // playing something else, overlap into the new track (crossfade) instead
  // of a hard cut. An already-expired URL is refreshed first.
  useEffect(() => {
    const front = frontEl();
    if (!front) return;
    const track = tracks[index];
    if (!track || !track.source) return;
    let cancelled = false;
    refreshFailedFor.current = null;
    // A fade started for another index was interrupted — finish it first.
    if (fadeRef.current && fadeForIndexRef.current !== index) {
      finishFade();
    }
    const src = new URL(track.source, window.location.href).href;

    const hardLoad = (s: string) => {
      if (cancelled) return;
      finishFade();
      const target = mutedRef.current ? 0 : volumeRef.current;
      front.volume = target;
      if (front.src !== new URL(s, window.location.href).href) {
        // New source: load it and start playback when requested.
        front.src = s;
        front.load();
        setCurrentTime(0);
        setDuration(0);
        if (isPlayingRef.current) {
          void front.play();
        }
        return;
      }
      if (!front.paused) {
        // Same source already playing (e.g. the queue grew underneath us
        // via lookahead extension): leave it alone, never restart.
        return;
      }
      // Same source, paused: resume from the top only when requested,
      // otherwise preserve the paused position.
      if (isPlayingRef.current) {
        front.currentTime = 0;
        setCurrentTime(0);
        void front.play();
      }
    };

    // Crossfade path: front is playing a different track.
    const fadeLength = crossfadeRef.current;
    if (fadeLength > 0 && front.src && front.src !== src && !front.paused) {
      const back = backEl();
      if (back) {
        const seconds = fadePendingRef.current ?? Math.min(2, fadeLength);
        fadePendingRef.current = null;
        fadeForIndexRef.current = index;
        startCrossfade(front, back, src, seconds, () => {
          if (!cancelled) {
            setStreamError("Couldn't play this track. Skipping to the next one.");
            goNext();
          }
        });
        return () => {
          cancelled = true;
        };
      }
    }
    fadePendingRef.current = null;

    if (
      refreshRef.current &&
      isExpiredTrack(track) &&
      refreshFailedFor.current !== `${index}:${track.source}`
    ) {
      refreshFailedFor.current = `${index}:${track.source}`;
      setIsBuffering(true);
      void refreshRef
        .current(track)
        .then((fresh) => {
          if (cancelled) return;
          if (fresh?.source && fresh.source !== track.source) {
            setTracks((prev) => prev.map((t, i) => (i === index ? fresh : t)));
            hardLoad(fresh.source);
          } else {
            hardLoad(track.source);
          }
        })
        .catch(() => hardLoad(track.source))
        .finally(() => {
          if (!cancelled) setIsBuffering(false);
        });
      return () => {
        cancelled = true;
      };
    }

    hardLoad(track.source);
    return () => {
      cancelled = true;
    };
  }, [
    index,
    tracks,
    isExpiredTrack,
    frontEl,
    backEl,
    startCrossfade,
    finishFade,
    goNext,
  ]);

  useEffect(() => {
    // The fade engine owns volumes while a fade is active.
    if (fadeRef.current) return;
    const target = muted ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.volume = target;
      audioRef.current.muted = muted;
    }
    if (audioRefB.current) {
      audioRefB.current.volume = 0;
      audioRefB.current.muted = muted;
    }
  }, [volume, muted]);

  // Media Session: lock-screen / OS media controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const track = tracks[index];
    if (!track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: [{ src: track.image, sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () =>
      void frontEl()?.play(),
    );
    navigator.mediaSession.setActionHandler("pause", () =>
      frontEl()?.pause(),
    );
    navigator.mediaSession.setActionHandler("previoustrack", goPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", goNext);
  }, [index, tracks, goNext, goPrevious, frontEl]);

  const togglePlay = useCallback(() => {
    // Settle any fade first so pause/resume always acts on one voice.
    finishFade();
    const audio = frontEl();
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [finishFade, frontEl]);

  const seek = useCallback(
    (time: number) => {
      finishFade();
      const audio = frontEl();
      if (!audio || !Number.isFinite(audio.duration)) return;
      const clamped = Math.min(Math.max(time, 0), audio.duration);
      audio.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [finishFade, frontEl],
  );

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const audio = frontEl();
      if (!audio) return;
      if (event.code === "Space") {
        if (target && target.tagName === "BUTTON") return;
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
      } else if (event.key === "ArrowLeft") {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setVolumeState(Math.min(1, volumeRef.current + 0.05));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setVolumeState(Math.max(0, volumeRef.current - 0.05));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setVolumeState, togglePlay]);

  const setVolumeValue = useCallback(
    (value: number) => {
      setVolumeState(Math.min(Math.max(value, 0), 1));
      setMuted(false);
    },
    [setVolumeState],
  );

  const toggleMute = useCallback(
    () => setMuted((mutedState) => !mutedState),
    [],
  );
  const cycleRepeat = useCallback(
    () =>
      setRepeat((mode) =>
        mode === "off" ? "all" : mode === "all" ? "one" : "off",
      ),
    [],
  );
  const toggleShuffle = useCallback(() => setShuffle((on) => !on), []);
  const setCrossfade = useCallback(
    (seconds: number) => {
      setCrossfadeState(Math.min(12, Math.max(0, seconds)));
    },
    [setCrossfadeState],
  );
  /**
   * Restart the current voice from the top (explicit user replay).
   * Unlike the load effect, this always restarts — background queue
   * growth must never call it.
   */
  const restart = useCallback(() => {
    finishFade();
    const audio = frontEl();
    if (!audio) return;
    isPlayingRef.current = true;
    audio.currentTime = 0;
    setCurrentTime(0);
    void audio.play();
  }, [finishFade, frontEl]);
  const clearStreamError = useCallback(() => setStreamError(null), []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return {
    audioRef,
    audioRefB,
    queue: tracks,
    currentTrack: tracks[index],
    currentIndex: index,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    crossfade,
    progress,
    streamError,
    togglePlay,
    next: goNext,
    previous: goPrevious,
    playFrom,
    replaceQueue,
    queueNext,
    queueLast,
    replaceQueuedTrack,
    removeFromQueue,
    moveInQueue,
    seek,
    setVolumeValue,
    toggleMute,
    cycleRepeat,
  toggleShuffle,
  setCrossfade,
  restart,
  clearStreamError,
  };
}
