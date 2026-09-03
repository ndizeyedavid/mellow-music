from datetime import datetime
from datetime import timedelta
from threading import Thread, Event
from time import sleep


from customisedLogs import CustomisedLogs
from pooledMySQL import PooledMySQL
from randomisedString import RandomisedString


from Classes.Holders.DBTables import DBTables
from Classes.Holders.UrlTypes import UrlTypes
from Classes.Processors.AudiusAPI import AudiusAPI
from Classes.Processors.InternetArchiveAPI import InternetArchiveAPI
from Classes.Processors.SongData import SongData
from Classes.Processors.SpotifyAPI import SpotifyAPICollection
from Classes.Processors.URLHandler import URLHandler
from Classes.Processors.YTDLP import YTDLP


# #region debug-point setup
import json as _json, urllib.request as _urllib, time as _time
_DBG = {"url": "http://127.0.0.1:7777/event", "sid": "slow-first-play"}
try:
    with open(".dbg/slow-first-play.env") as _f:
        for _l in _f.read().splitlines():
            if _l.startswith("DEBUG_SERVER_URL="): _DBG["url"] = _l.split("=", 1)[1]
            elif _l.startswith("DEBUG_SESSION_ID="): _DBG["sid"] = _l.split("=", 1)[1]
except Exception:
    pass
def _dbg(run, hyp, loc, msg, **data):
    try:
        _p = _json.dumps({"sessionId": _DBG["sid"], "runId": run, "hypothesisId": hyp, "location": loc, "msg": "[DEBUG] " + msg, "data": data, "ts": int(_time.time() * 1000)}).encode()
        _urllib.urlopen(_urllib.Request(_DBG["url"], data=_p, headers={"Content-Type": "application/json"}), timeout=1).read()
    except Exception:
        pass
# #endregion


class SongCache:
    """
    Processor to collect, renew and handle local and DB caches for all song data
    """
    def __init__(self, SQLConn:PooledMySQL, Logger:CustomisedLogs, URLHandler:URLHandler):
        self.SQLConn = SQLConn
        self.logger = Logger
        self.cache:dict[str, SongData] = {}
        self.YTDLP = YTDLP(self.logger)
        self.AudiusAPI = AudiusAPI()
        self.InternetArchiveAPI = InternetArchiveAPI()
        self.SpotifyAPICollection = SpotifyAPICollection(self.SQLConn)
        self.URLHandler = URLHandler

    @staticmethod
    def __db_value(value):
        if isinstance(value, (bytes, bytearray)):
            return value.decode()
        return value

    def __save_to_db(self, song:SongData) -> None:
        """
        Store a new song to DB or mark as repeat
        :param song: SongData object with all values
        :return:
        """
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


    def __start_audio(self, song:SongData) -> None:
        """
        Unblock any waiting /api/audio request. Starts downloading only when a
        usable stream URL exists; the waiter is always released so a failed source
        degrades to an immediate (empty) stream instead of a deadlock.
        """
        if song.audio_url and str(song.audio_url).strip() and song.stream is None:
            Thread(target=song.fetch_stream).start()
        # #region debug-point D:audio-start
        _dbg("pre", "D", "SongProcessor.__start_audio", "audio streaming started", song_id=song.song_id)
        # #endregion
        if song.waiter is not None:
            song.waiter.set()
            song.waiter = None

    def __resolve_free_source(self, song:SongData, string:str) -> bool:
        """
        Try a free, direct-stream provider (Audius -> Internet Archive) by title.
        Returns True when a stream URL was found, otherwise False (caller falls back).
        """
        try:
            audius = self.AudiusAPI.match_stream(string)
            if audius:
                song.song_name = audius["title"]
                song.audio_url = audius["stream_url"]
                song.duration = audius["duration"]
                song.thumbnail = audius["thumbnail"]
                song.yt = ""
                return True
        except Exception:
            pass

        try:
            archive = self.InternetArchiveAPI.match_stream(string)
            if archive:
                song.song_name = archive["title"]
                song.audio_url = archive["stream_url"]
                song.duration = archive["duration"]
                song.thumbnail = archive["thumbnail"]
                song.yt = ""
                return True
        except Exception:
            pass

        return False

    def __resolve_youtube(self, song:SongData, string:str) -> bool:
        """
        Resolve playback through YouTube as a last resort.
        Uses a fast flat search to grab the top video ID, then deep-extracts just
        that one video for a usable stream URL. Never raises; returns True on
        success or False when nothing usable was found so playback degrades instead
        of hanging on a dead /api/audio request.
        """
        try:
            search_info = self.YTDLP.search_first(string)
            video_id = search_info.get("id")
            if not video_id:
                return False
            song.yt = video_id
            if not song.song_name:
                song.song_name = search_info.get("title") or string
            if not song.duration:
                song.duration = search_info.get("duration") or 0
            if not song.thumbnail:
                song.thumbnail = search_info.get("thumbnail") or ""
            r = self.YTDLP.get_downloader(self.URLHandler.merge(UrlTypes.YT_URL, video_id))
            if isinstance(r, dict):
                if not song.audio_url:
                    song.audio_url = r.get("url") or ""
                song.duration = r.get("duration") or song.duration
                if not song.thumbnail and isinstance(r.get("thumbnails"), list) and r.get("thumbnails"):
                    song.thumbnail = r["thumbnails"][0].get("url")
            return bool(song.audio_url)
        except Exception:
            return False

    def __resolve_audio(self, song:SongData, string:str) -> None:
        """YouTube first (accurate track matching), then the free direct-stream providers."""
        if not self.__resolve_youtube(song, string):
            self.__resolve_free_source(song, string)

    def __finish_prep(self, song:SongData) -> None:
        """
        Optional post-playback enrichment and persistence. Runs off the playback path
        so it never delays serving audio. Fills the Spotify ID when missing, then saves.
        """
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
        # #region debug-point D:spotify-done
        _dbg("pre", "D", "SongProcessor.__finish_prep", "spotify enrichment done", song_id=song.song_id)
        # #endregion
        song.expiry = datetime.now() + timedelta(hours=5)
        self.__save_to_db(song)


    def __fetch_new(self, song:SongData, category:UrlTypes, string:str) -> None:
        """
        Fetch a new song from a free source (Audius -> Internet Archive -> YouTube)
        based on category and name/url string, implementing Event based waiting to
        prevent race conditions. Playback is unblocked the instant a stream URL is
        known; Spotify enrichment and DB persistence run in the background.
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
                if isinstance(r, dict):
                    song.song_name = r.get("title") or song.song_name
                    song.yt = string
                    song.duration = r.get("duration") or song.duration
                    song.audio_url = r.get("url") or ""
                    song.thumbnail = None if not isinstance(r.get("thumbnails"), list) or not r.get("thumbnails") else r.get("thumbnails")[0].get('url')

            elif category == UrlTypes.SPOTIFY_URL:
                details = self.SpotifyAPICollection.fetch_api().API.track(string)
                artists = " ".join([_["name"] for _ in details['artists']])
                song.song_name = details["name"] + " " + artists
                song.spotify = string
                if song.song_name:
                    self.__resolve_audio(song, song.song_name)

            elif category == UrlTypes.UNKNOWN:
                self.__resolve_audio(song, string)
        except Exception:
            pass
        finally:
            # Always release the waiter so /api/audio never deadlocks, even if the
            # source failed to resolve. Optional enrichment follows in the background.
            self.__start_audio(song)

        self.__finish_prep(song)
        Thread(target=self.__remove_cache, args=(song,)).start()


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
            Thread(target=song.fetch_stream).start()
            song.thumbnail = fetched[DBTables.SONGS.THUMBNAIL]
            song.expiry = fetched[DBTables.SONGS.LAST_UPDATED] + timedelta(hours=5)
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
        while (datetime.now() - song.last_fetched_at).total_seconds() < seconds+5: sleep(1)
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
            Thread(target=song.fetch_stream).start()
            song.expiry = datetime.now()+timedelta(hours=5)
            song.last_fetched_at = datetime.now()
        elif datetime.now() > song.expiry:
            if song.yt:
                self.__fetch_new(song, UrlTypes.YT_URL, song.yt)
                return
            # Stable direct stream (Audius/Internet Archive): keep it, just refresh expiry.
            song.expiry = datetime.now()+timedelta(hours=5)
            song.last_fetched_at = datetime.now()
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
            # #region debug-point A:wait-start
            _tw = _time.time()
            # #endregion
            song.waiter.wait()
            # #region debug-point A:wait-end
            _dbg("pre", "A", "SongProcessor.get_song_data", "waiter released", song_id=songID, wait_ms=round((_time.time() - _tw) * 1000, 1))
            # #endregion
            if song.repeat_for is not None:
                song = song.repeat_for
                if song.waiter is not None:
                    song.waiter.wait()
            song.last_fetched_at = datetime.now()
            self.__renew_expiry(song, None)
        return song

