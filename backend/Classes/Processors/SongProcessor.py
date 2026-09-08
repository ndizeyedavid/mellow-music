from datetime import datetime, timedelta, timezone
from threading import Thread, Event
from time import sleep

def _ensure_aware(dt: datetime | None) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def _now() -> datetime:
    return datetime.now(timezone.utc)


from customisedLogs import CustomisedLogs
from Classes.Processors.PostgresPool import PostgresPool
from randomisedString import RandomisedString


from Classes.Holders.DBTables import DBTables
from Classes.Holders.UrlTypes import UrlTypes
from Classes.Processors.SongData import SongData
from Classes.Processors.SpotifyAPI import SpotifyAPICollection
from Classes.Processors.URLHandler import URLHandler
from Classes.Processors.YTDLP import YTDLP


class SongCache:
    """
    Processor to collect, renew and handle local and DB caches for all song data
    """
    def __init__(self, SQLConn:PostgresPool, Logger:CustomisedLogs, URLHandler:URLHandler):
        self.SQLConn = SQLConn
        self.logger = Logger
        self.cache:dict[str, SongData] = {}
        self.YTDLP = YTDLP(self.logger)
        self.SpotifyAPICollection = SpotifyAPICollection(self.SQLConn)
        self.URLHandler = URLHandler
        self._embedder = None

    @staticmethod
    def __db_value(value):
        if isinstance(value, (bytes, bytearray)):
            return value.decode()
        return value

    def __save_to_db(self, song:SongData) -> None:
        """
        Store a new song to DB or mark as repeat.
        Upsert-safe: a row that already carries this song_id (e.g. its
        source marker changed from a plain video id to saavn:/preview:)
        is updated in place instead of crashing on the primary key.
        :param song: SongData object with all values
        :return:
        """
        existing = self.SQLConn.execute(f"SELECT {DBTables.SONGS.SONG_ID} FROM {DBTables.SONGS.TABLE_NAME} WHERE {DBTables.SONGS.SONG_ID}=? LIMIT 1", [song.song_id])
        if existing:
            self.SQLConn.execute(f"UPDATE {DBTables.SONGS.TABLE_NAME} SET {DBTables.SONGS.REAL_NAME}=?, {DBTables.SONGS.SPOTIFY_ID}=?, {DBTables.SONGS.YT_ID}=?, {DBTables.SONGS.DURATION}=?, {DBTables.SONGS.THUMBNAIL}=?, {DBTables.SONGS.AUDIO_URL}=?, {DBTables.SONGS.LAST_UPDATED}=NOW() WHERE {DBTables.SONGS.SONG_ID}=?", [song.song_name, song.spotify, song.yt, song.duration, song.thumbnail, song.audio_url, song.song_id])
            if song.search_name and song.search_name != song.song_name:
                known_alias = self.SQLConn.execute(f"SELECT {DBTables.ALIASES.SONG_ID} FROM {DBTables.ALIASES.TABLE_NAME} WHERE {DBTables.ALIASES.SONG_ID}=? AND {DBTables.ALIASES.STRING}=? LIMIT 1", [song.song_id, song.search_name])
                if not known_alias:
                    self.SQLConn.execute(f"INSERT INTO {DBTables.ALIASES.TABLE_NAME} VALUES (?, ?)", [song.song_id, song.search_name])
            return
        fetched = self.SQLConn.execute(f"SELECT {DBTables.SONGS.SONG_ID} FROM {DBTables.SONGS.TABLE_NAME} WHERE ({DBTables.SONGS.REAL_NAME}=? AND {'TRUE' if song.song_name else 'FALSE'}) OR ({DBTables.SONGS.YT_ID}=? AND {'TRUE' if song.yt else 'FALSE'}) OR ({DBTables.SONGS.SPOTIFY_ID}=? AND {'TRUE' if song.spotify else 'FALSE'}) LIMIT 1", [song.song_name, song.yt, song.spotify])
        if fetched:
            realID = self.__db_value(fetched[0][DBTables.SONGS.SONG_ID])
            if realID not in self.cache: self.__cache_from_db(realID, True)
            realSong = self.cache[realID]
            song.repeat_for = realSong
            self.__renew_expiry(realSong, song.audio_url)
            self.SQLConn.execute(f"INSERT INTO {DBTables.ALIASES.TABLE_NAME} VALUES (?, ?)", [realID, song.search_name])
        else:
            self.SQLConn.execute(f"INSERT INTO {DBTables.SONGS.TABLE_NAME} VALUES (?, ?, ?, ?, ?, ?, ?, NOW())", [song.song_id, song.song_name, song.spotify, song.yt, song.duration, song.thumbnail, song.audio_url])
            if song.search_name != song.song_name:
                self.SQLConn.execute(f"INSERT INTO {DBTables.ALIASES.TABLE_NAME} VALUES (?, ?)", [song.song_id, song.search_name])


    def __fail_fetch(self, song:SongData, reason:str) -> None:
        """
        Mark a song fetch as failed without raising, so waiters are released
        and API endpoints can return {"ERROR": reason} instead of 500ing.
        :param song: the SongData object that failed
        :param reason: human-readable failure cause
        :return:
        """
        try:
            self.logger.error(f"Song fetch failed for '{song.search_name}': {reason}")
        except Exception:
            pass
        song.error = reason
        if song.waiter is not None:
            try:
                song.waiter.set()
            except Exception:
                pass
            song.waiter = None
        Thread(target=self.__remove_cache, args=(song,)).start()

    def __finish_refresh(self, song:SongData) -> None:
        """Persist a refreshed audio URL and release any waiter."""
        song.expiry = _now() + timedelta(hours=5)
        song.last_fetched_at = _now()
        try:
            self.SQLConn.execute(f"UPDATE {DBTables.SONGS.TABLE_NAME} SET {DBTables.SONGS.LAST_UPDATED}=NOW(), {DBTables.SONGS.AUDIO_URL}=? WHERE {DBTables.SONGS.SONG_ID}=?", [song.audio_url, song.song_id])
        except Exception:
            pass
        if song.waiter is not None:
            try:
                song.waiter.set()
            except Exception:
                pass
            song.waiter = None
        Thread(target=self.__remove_cache, args=(song,)).start()

    def __refresh_preview(self, song:SongData) -> None:
        """Renew a preview:<deezer_id> song — try to upgrade to full YouTube first."""
        # Try to upgrade preview to full YouTube on renewal (so old preview
        # caches like the reported Blaze Of Glory don't stay 30s forever).
        try:
            title = song.song_name or song.search_name
            if title:
                cleaned = self.URLHandler.cleanedTrackName(title) or title
                for q in [cleaned + " lyrics", title + " lyrics", cleaned, title]:
                    q = q.replace('"', "'").strip()
                    r = self.YTDLP.get_downloader(q)
                    entries = (r.get("entries") or []) if r and isinstance(r, dict) else []
                    entries = [e for e in entries if e]
                    if entries and entries[0].get("url"):
                        first = entries[0]
                        song.yt = first.get('id')
                        song.song_name = first.get("title") or title
                        song.audio_url = first.get('url')
                        song.duration = first.get('duration') or 0
                        song.thumbnail = first.get('thumbnail') or song.thumbnail
                        self.__finish_refresh(song)
                        return
                # Fallback via Invidious before giving up to preview.
                for q in [cleaned + " lyrics", title + " lyrics"]:
                    q = q.replace('"', "'").strip()
                    inv = self.YTDLP.invidious_search(q, max_results=5)
                    for item in inv or []:
                        vid = item.get("id")
                        streams = self.YTDLP.invidious_streams(vid) if vid else None
                        if streams and streams.get("audio_url"):
                            song.yt = item["id"]
                            song.song_name = item["title"]
                            song.audio_url = streams["audio_url"]
                            song.duration = streams.get("duration") or 0
                            song.thumbnail = item.get("thumbnail") or song.thumbnail
                            self.__finish_refresh(song)
                            return
        except Exception:
            pass
        did = (song.yt or "").split(":", 1)[1] if ":" in (song.yt or "") else ""
        refreshed = self.YTDLP.deezer_preview(did) if did else None
        if not refreshed:
            self.__fail_fetch(song, "Saved audio expired and refresh failed.")
            return
        song.audio_url = refreshed["audio_url"]
        song.duration = refreshed.get("duration") or 30
        self.__finish_refresh(song)


    def __fetch_new(self, song:SongData, category:UrlTypes, string:str) -> None:
        """
        Fetch a new song from YTDLP or Spotipy based on category and name/url string implementing Event based waiting to prevent race conditions
        Also keeps track of audio url expiry and calls for refresh when needed
        Extraction failures (e.g. YouTube bot checks) are recorded on
        song.error instead of raising, so /api/fetch returns {"ERROR": ...}.
        :param song: the SongData object to fill
        :param category: category of the string
        :param string: name/url string
        :return:
        """
        if song.waiter is None:
            song.waiter = Event()
            song.waiter.clear()

        try:
            if category == UrlTypes.YT_URL:
                url = self.URLHandler.merge(category, string)
                r = self.YTDLP.get_downloader(url)
                if r and r.get("url"):
                    song.song_name = r.get("title")
                    song.yt = string
                    song.duration = r.get("duration")
                    song.audio_url = r.get("url")
                    # NOTE: no eager fetch_stream — audio downloads lazily on
                    # first /api/audio read (see SongData.ensure_stream).
                    thumbnails = r.get("thumbnails") or []
                    song.thumbnail = thumbnails[0].get('url') if thumbnails else None
                else:
                    # Direct link blocked: try Invidious streams before failing.
                    inv = self.YTDLP.invidious_streams(string)
                    if inv and inv.get("audio_url"):
                        title = inv.get("title") or string
                        song.song_name = title
                        song.yt = string
                        song.duration = inv.get("duration") or 0
                        song.audio_url = inv["audio_url"]
                        song.thumbnail = inv.get("thumbnail") or None
                    else:
                        self.__fail_fetch(song, "YouTube refused this video (bot check). Try again later.")
                        return

            elif category == UrlTypes.SPOTIFY_URL:
                details = self.SpotifyAPICollection.fetch_api().API.track(string)
                artists = " ".join([_["name"] for _ in details['artists']])
                song.song_name = details["name"] + " " + artists
                if song.song_name:
                    self.__fetch_new(song, UrlTypes.UNKNOWN, song.song_name)
                    return

            elif category == UrlTypes.UNKNOWN:
                # Chain: Deezer meta (for clean title/artist/cover), then
                # YouTube full-length via yt-dlp (multiple sanitized queries
                # to survive weird quoting like Blaze Of Glory...), then
                # Invidious, then Deezer 30s preview as last resort.
                meta = self.YTDLP.deezer_track_meta(string)
                # Queries ordered from most specific to most generic.
                raw_candidates = [string + " lyrics", string]
                cleaned = self.URLHandler.cleanedTrackName(string)
                if cleaned and cleaned.lower() != string.lower():
                    raw_candidates.insert(0, cleaned + " lyrics")
                    raw_candidates.insert(2, cleaned)
                # Deduplicate while preserving order, strip stray quotes.
                seen_q = set()
                queries = []
                for q in raw_candidates:
                    q = q.replace('"', "'").replace("“", "'").replace("”", "'").strip()
                    if q and q.lower() not in seen_q:
                        seen_q.add(q.lower())
                        queries.append(q)
                first = None
                r = None
                for q in queries:
                    r = self.YTDLP.get_downloader(q)
                    entries = (r.get("entries") or []) if r and isinstance(r, dict) else []
                    entries = [e for e in entries if e]
                    if entries:
                        first = entries[0]
                        if first.get("url"):
                            break
                        first = None
                if first and first.get("url"):
                    song.yt = first.get('id')
                    song.song_name = first.get("title")
                    song.audio_url = first.get('url')
                    song.duration = first.get('duration')
                    song.thumbnail = first.get('thumbnail') or (meta["cover"] if meta else None)
                else:
                    # YouTube search blocked (datacenter IP): try Invidious.
                    inv = None
                    for q in queries:
                        inv = self.YTDLP.invidious_search(q, max_results=5)
                        if inv:
                            break
                    if inv:
                        picked = None
                        for item in inv:
                            vid = item.get("id")
                            streams = self.YTDLP.invidious_streams(vid) if vid else None
                            if streams and streams.get("audio_url"):
                                picked = (item, streams)
                                break
                        if picked:
                            item, streams = picked
                            song.yt = item["id"]
                            song.song_name = item["title"]
                            song.audio_url = streams["audio_url"]
                            song.duration = streams.get("duration") or item.get("duration") or 0
                            song.thumbnail = item.get("thumbnail") or (meta["cover"] if meta else None)
                        elif meta and meta.get("preview"):
                            song.yt = f"preview:{meta['deezer_id']}"
                            song.song_name = meta["title"]
                            song.audio_url = meta["preview"]
                            song.duration = 30
                            song.thumbnail = meta.get("cover") or None
                        else:
                            self.__fail_fetch(song, f"No results for '{string}'.")
                            return
                    elif meta and meta.get("preview"):
                        song.yt = f"preview:{meta['deezer_id']}"
                        song.song_name = meta["title"]
                        song.audio_url = meta["preview"]
                        song.duration = 30
                        song.thumbnail = meta.get("cover") or None
                    else:
                        self.__fail_fetch(song, f"No results for '{string}'.")
                        return

            else:
                self.__fail_fetch(song, "Unsupported link type.")
                return
        except Exception as exc:
            self.__fail_fetch(song, f"Extraction failed: {exc}")
            return

        if not song.spotify:
            try:
                items = self.SpotifyAPICollection.fetch_api().API.search(song.song_name.lower(), type="track")['tracks']['items']
                chosen = items[1]
                for item in items:
                    if item["name"].lower() == song.song_name.lower() or item["name"].lower() in song.song_name.lower():
                        chosen = item
                        break
                song.spotify = chosen["id"]
            except:
                song.spotify = ""

        song.expiry = _now() + timedelta(hours=5)
        try:
            self.__save_to_db(song)
        except Exception as exc:
            self.__fail_fetch(song, f"Could not save song: {exc}")
            return
        try:
            Thread(target=self.__ensure_embedding, args=(song.song_id, song.song_name), daemon=True).start()
        except Exception:
            pass
        if song.waiter is not None:
            song.waiter.set()
            song.waiter = None
        Thread(target=self.__remove_cache, args=(song,)).start()

    def __ensure_embedding(self, song_id: str, song_name: str):
        try:
            if self._embedder is None:
                from Classes.Processors.EmbeddingService import EmbeddingService

                self._embedder = EmbeddingService(self.SQLConn, self.logger)
            title = song_name
            artist = ""
            if " - " in song_name:
                # song_name often is "Title - Artist" from YT; keep full for embedding
                title = song_name
            self._embedder.ensure_embedding(song_id, title, artist)
        except Exception:
            pass


    def __cache_from_db(self, songID:str, asRepeat) -> SongData | None:
        """
        Fetch a song data from DB
        :param songID: ID of the song
        :param asRepeat: if the song has to be marked as real for some other repeat song, which will define if it needs to be renewed
        :return: SongData object
        """
        fetched = self.SQLConn.execute(f"SELECT * FROM {DBTables.SONGS.TABLE_NAME} WHERE {DBTables.SONGS.SONG_ID}=?", [songID])
        if fetched:
            fetched = fetched[0]
            song = SongData()
            song.song_id = songID
            if song.waiter is None:
                song.waiter = Event()
                song.waiter.clear()
            self.cache[songID] = song
            song.yt = self.__db_value(fetched[DBTables.SONGS.YT_ID])
            song.spotify = self.__db_value(fetched[DBTables.SONGS.SPOTIFY_ID])
            song.song_name = fetched[DBTables.SONGS.REAL_NAME]
            song.duration = fetched[DBTables.SONGS.DURATION]
            song.audio_url = fetched[DBTables.SONGS.AUDIO_URL]
            song.thumbnail = fetched[DBTables.SONGS.THUMBNAIL]
            song.expiry = _ensure_aware(fetched[DBTables.SONGS.LAST_UPDATED]) + timedelta(hours=5)
            if not asRepeat: self.__renew_expiry(song, None)
            Thread(target=self.__remove_cache, args=(song,)).start()
            if song.waiter is not None:
                song.waiter.set()
                song.waiter = None
            return self.cache[songID]


    def __remove_cache(self, song:SongData, seconds:int= 3600 * 4):
        """
        If any song is not requested for n seconds, remove it from the cache
        :param song: the song to remove
        :param seconds: time to wait in seconds
        :return:
        """
        while (_now() - _ensure_aware(song.last_fetched_at)).total_seconds() < seconds+5: sleep(1)
        if song.song_id in self.cache:
            del self.cache[song.song_id]


    def __renew_expiry(self, song:SongData, url:str|None):
        """
        Wait for expiry and renew if required
        :param song: song to renew
        :param url: fetched audio_url to use the url directly or None to fetch it manually
        :return:
        """
        if url:
            song.audio_url = url
            song.expiry = _now()+timedelta(hours=5)
            song.last_fetched_at = _now()
        elif _now() > _ensure_aware(song.expiry):
            marker = song.yt or ""
            if marker.startswith("preview:"):
                self.__refresh_preview(song)
            elif marker.startswith("saavn:"):
                # Legacy marker from the retired Saavn path: re-resolve the
                # song cleanly through the current chain (upsert keeps its ID).
                self.__fetch_new(song, UrlTypes.UNKNOWN, song.song_name or song.search_name)
            else:
                self.__fetch_new(song, UrlTypes.YT_URL, song.yt)
        else: return
        self.SQLConn.execute(f"UPDATE {DBTables.SONGS.TABLE_NAME} SET {DBTables.SONGS.LAST_UPDATED}=NOW(), {DBTables.SONGS.AUDIO_URL}=? WHERE {DBTables.SONGS.SONG_ID}=?", [song.audio_url, song.song_id])


    def get_song_id(self, string:str) -> str|None:
        """
        Find relevant song based on name or URL provided
        :param string: name or url to search for
        :return: 30-character unique ID for the song or None if the string is a playlist or other unknown type
        """
        category, string = self.URLHandler.strip(string)
        found = self.SQLConn.execute(f"SELECT {DBTables.ALIASES.SONG_ID} FROM {DBTables.ALIASES.TABLE_NAME} WHERE {DBTables.ALIASES.STRING}=? LIMIT 1", [string])
        if found: return self.__db_value(found[0][DBTables.ALIASES.SONG_ID])
        else: ## No real name matched
            if category == UrlTypes.UNKNOWN: found = self.SQLConn.execute(f"SELECT {DBTables.SONGS.SONG_ID} FROM {DBTables.SONGS.TABLE_NAME} WHERE {DBTables.SONGS.REAL_NAME}=? LIMIT 1", [string])
            elif category == UrlTypes.SPOTIFY_URL: found = self.SQLConn.execute(f"SELECT {DBTables.SONGS.SONG_ID} FROM {DBTables.SONGS.TABLE_NAME} WHERE {DBTables.SONGS.SPOTIFY_ID}=? LIMIT 1", [string])
            elif category == UrlTypes.YT_URL: found = self.SQLConn.execute(f"SELECT {DBTables.SONGS.SONG_ID} FROM {DBTables.SONGS.TABLE_NAME} WHERE {DBTables.SONGS.YT_ID}=? LIMIT 1", [string])
            else: return None
            if found: return self.__db_value(found[0][DBTables.SONGS.SONG_ID])
            else: ## No alias name matched
                songID = RandomisedString().AlphaNumeric(30,30)
                song = SongData()
                song.song_id = songID
                self.cache[songID] = song
                song.search_name = self.URLHandler.merge(category, string)
                Thread(target=self.__fetch_new, args=(song, category, string)).start()
                return songID


    def get_song_data(self, songID:str)->SongData:
        """
        Wait for song with the ID to be prepared and then return it
        :param songID: ID to search for
        :return:
        """
        if songID not in self.cache: song = self.__cache_from_db(songID, False)
        else: song = self.cache[songID]
        if song is not None and song.waiter is not None:
            # Bounded wait: extraction has finite retries, but never hang
            # the request thread forever if a worker dies silently.
            song.waiter.wait(timeout=180)
            if song.repeat_for is not None:
                song = song.repeat_for
                if song.waiter is not None:
                    song.waiter.wait(timeout=180)
            song.last_fetched_at = _now()
            if song.error is None:
                try:
                    self.__renew_expiry(song, None)
                except Exception as exc:
                    song.error = f"Refresh failed: {exc}"
        return song

