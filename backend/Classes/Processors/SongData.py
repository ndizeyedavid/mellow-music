from __future__ import annotations
from datetime import datetime
from threading import Condition, Lock, Thread
from typing import Generator

import requests


class SongData:
    def __init__(self):
        """
        Holder + Processor class to hold unique song data and stream data fetcher
        """
        self.search_name = ""
        self.song_id:str = ""
        self.song_name:str = ""
        self.yt:str = ""
        self.spotify:str = ""
        self.duration:float|int = 0
        self.audio_url:str = ""
        self.thumbnail:str = ""
        self.expiry:datetime = datetime.now()
        self.lyrics:str = "No Lyrics LOL :)"
        self.last_fetched_at:datetime = datetime.now()
        self.repeat_for: SongData | None = None
        self.waiter = None
        # Set when extraction fails (e.g. YouTube bot-check) so API
        # endpoints can return {"ERROR": ...} instead of hanging or 500ing.
        self.error: str | None = None

        self.stream = None
        self.data_queue = []
        self.done = False
        self.data_condition = Condition()
        # Audio bytes are fetched LAZILY on first stream read — resolving
        # metadata must never download audio for songs nobody plays.
        self._stream_started = False
        self._stream_lock = Lock()


    def full_dict(self) -> dict:
        """
        JSON for the song data to send to client or pass to new Song class
        :return:
        """
        return {
            "ID":self.song_id,
            "SONG_NAME":self.song_name,
            "YT_ID":self.yt,
            "SPOTIFY_ID":self.spotify,
            "DURATION":self.duration,
            "AUDIO_URL":self.audio_url,
            "THUMBNAIL":self.thumbnail,
            "EXPIRY":self.expiry,
            "LYRICS":self.lyrics
        }


    def read_dict(self, source:dict) -> SongData:
        """
        Read JSON from fresh data or another Song object to clone values
        :param source: JSON to read from
        :return:
        """
        self.song_id = source.get("ID")
        self.song_name = source.get("SONG_NAME")
        self.yt = source.get("YT_ID")
        self.spotify = source.get("SPOTIFY_ID")
        self.duration = float(source.get("DURATION"))
        self.audio_url = source.get("AUDIO_URL")
        self.thumbnail = source.get("THUMBNAIL")
        self.expiry = source.get("EXPIRY")
        self.lyrics = source.get("LYRICS")
        return self


    def ensure_stream(self) -> None:
        """
        Start the background audio download exactly once, on first actual
        stream consumption. Thread-safe: concurrent readers share one fetch.
        """
        with self._stream_lock:
            if self._stream_started:
                return
            self._stream_started = True
        Thread(target=self.fetch_stream, daemon=True).start()

    def fetch_stream(self) -> None:
        """
        Start reading bytes from URL as stream once Song.audio_url is received
        :return:
        """
        try:
            self.stream = requests.get(self.audio_url, stream=True).iter_content(1024) # Chunks of 1KB is read and stored
            for chunk in self.stream:
                with self.data_condition:
                    self.data_queue.append(chunk)
                    self.data_condition.notify_all()
        except Exception:
            pass
        finally:
            with self.data_condition:
                self.done = True
                self.data_condition.notify_all()


    def __get_cached_chunk(self, index:int):
        """
        Return the index-th chunk from the data queue
        :param index: integer of the data chunk requested
        :return:
        """
        with self.data_condition:
            if index < len(self.data_queue):
                return self.data_queue[index]
            elif self.done:
                return None
            else:
                return None


    def fetch_data_from_stream(self) -> Generator[bytes]:
        """
        Generator for reading bytes from stream or as a whole if the song is ready
        :return: Generator[bytes]
        """
        self.ensure_stream()
        expected = 0
        while True:
            with self.data_condition:
                while expected >= len(self.data_queue) and not self.done:
                    self.data_condition.wait()
                data = self.__get_cached_chunk(expected)
                if data is not None:
                    expected += 1
                    yield data
                else:
                    if self.done:
                        break