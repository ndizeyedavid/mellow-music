import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../data/library";

export type RepeatMode = "off" | "all" | "one";

export interface UseAudioPlayer {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTrack: Track;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  liked: boolean;
  progress: number;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  playFrom: (index: number) => void;
  seek: (time: number) => void;
  setVolumeValue: (value: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  toggleLike: () => void;
}

/**
 * Playback state + <audio> wiring for the bottom player.
 * Handles play/pause, track cycling, shuffle, repeat, seek, volume and mute.
 */
export function useAudioPlayer(
  tracks: Track[],
  startIndex = 0,
): UseAudioPlayer {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [index, setIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [liked, setLiked] = useState(false);

  // Refs mirroring state so the one-time audio listeners always read fresh values.
  const indexRef = useRef(index);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const isPlayingRef = useRef(isPlaying);

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

  // One-time wiring of media element events.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
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

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [goNext, tracks.length]);

  // Load the track when the index changes (skip if the source is unchanged).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextSrc = tracks[index].source;
    if (audio.src !== new URL(nextSrc, window.location.href).href) {
      audio.src = nextSrc;
      audio.load();
      setCurrentTime(0);
      setDuration(0);
    }
    setLiked(false);
    if (isPlayingRef.current) {
      void audio.play();
    }
  }, [index, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

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

  const setVolumeValue = useCallback((value: number) => {
    setVolume(Math.min(Math.max(value, 0), 1));
    setMuted(false);
  }, []);

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
  const toggleLike = useCallback(() => setLiked((isLiked) => !isLiked), []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return {
    audioRef,
    currentTrack: tracks[index],
    currentIndex: index,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    repeat,
    shuffle,
    liked,
    progress,
    togglePlay,
    next: goNext,
    previous: goPrevious,
    playFrom,
    seek,
    setVolumeValue,
    toggleMute,
    cycleRepeat,
    toggleShuffle,
    toggleLike,
  };
}
