import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../data/library";
import { usePersistentState } from "../utils/usePersistentState";

export type RepeatMode = "off" | "all" | "one";

export interface UseAudioPlayer {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  queue: Track[];
  currentTrack: Track;
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  progress: number;
  streamError: string | null;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  playFrom: (index: number) => void;
  replaceQueue: (tracks: Track[], startIndex?: number) => void;
  seek: (time: number) => void;
  setVolumeValue: (value: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
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
): UseAudioPlayer {
  const audioRef = useRef<HTMLAudioElement>(null);

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
  const [streamError, setStreamError] = useState<string | null>(null);

  // Refs mirroring state so the one-time audio listeners always read fresh values.
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const loadedSourceRef = useRef<string | null>(null);

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

  const goNext = useCallback(() => {
    setIndex((prev) =>
      shuffleRef.current ? pickIndex(prev) : (prev + 1) % tracks.length,
    );
  }, [pickIndex, tracks.length]);

  const goPrevious = useCallback(() => {
    setIndex((prev) =>
      shuffleRef.current
        ? pickIndex(prev)
        : (prev - 1 + tracks.length) % tracks.length,
    );
  }, [pickIndex, tracks.length]);

  /** Jump to a specific track and start playing it. */
  const playFrom = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, tracks.length - 1));
      isPlayingRef.current = true;
      if (target === indexRef.current) {
        void audioRef.current?.play();
        return;
      }
      setIndex(target);
    },
    [tracks.length],
  );

  /** Replace the whole queue and start playing the track at startIndex. */
  const replaceQueue = useCallback((nextTracks: Track[], nextIndex = 0) => {
    const target = Math.max(0, Math.min(nextIndex, nextTracks.length - 1));
    isPlayingRef.current = true;
    setTracks(nextTracks);
    setIndex(target);
  }, []);

  // One-time wiring of media element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onReady = () => setIsBuffering(false);
    const onEnded = () => {
      if (repeatRef.current === "one") {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      if (
        shuffleRef.current ||
        repeatRef.current === "all" ||
        indexRef.current < tracks.length - 1
      ) {
        goNext();
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };
    const onError = () => {
      // MEDIA_ERR_ABORTED (4) fires on intentional src switches — ignore those.
      if (audio.error && audio.error.code !== 4) {
        setStreamError("Couldn't play this track. Skipping to the next one.");
        goNext();
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

    return () => {
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
    };
  }, [goNext, tracks.length]);

  // Load the track when the index changes. Only reload when the source string
  // actually changes (tracked in a ref) so background queue refills don't call
  // audio.load() again — which would abort an in-flight play() with an AbortError.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextSrc = tracks[index].source;
    if (loadedSourceRef.current !== nextSrc) {
      loadedSourceRef.current = nextSrc;
      audio.src = nextSrc;
      audio.load();
      setCurrentTime(0);
      setDuration(0);
    }
    if (isPlayingRef.current) {
      audio.play().catch(() => {
        /* swallow AbortError/NotAllowedError; handled via the error event */
      });
    }
  }, [index, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Media Session: lock-screen / OS media controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tracks[index].title,
      artist: tracks[index].artist,
      album: tracks[index].album,
      artwork: [{ src: tracks[index].image, sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () =>
      void audioRef.current?.play(),
    );
    navigator.mediaSession.setActionHandler("pause", () =>
      audioRef.current?.pause(),
    );
    navigator.mediaSession.setActionHandler("previoustrack", goPrevious);
    navigator.mediaSession.setActionHandler("nexttrack", goNext);
  }, [index, tracks, goNext, goPrevious]);

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
      const audio = audioRef.current;
      if (!audio) return;
      if (event.code === "Space") {
        if (target && target.tagName === "BUTTON") return;
        event.preventDefault();
        if (audio.paused) {
          void audio.play();
        } else {
          audio.pause();
        }
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
  }, [setVolumeState]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const clamped = Math.min(Math.max(time, 0), audio.duration);
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

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
  const clearStreamError = useCallback(() => setStreamError(null), []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return {
    audioRef,
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
    progress,
    streamError,
    togglePlay,
    next: goNext,
    previous: goPrevious,
    playFrom,
    replaceQueue,
    seek,
    setVolumeValue,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    clearStreamError,
  };
}
