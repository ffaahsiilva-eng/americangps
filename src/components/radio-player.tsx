import { useEffect, useRef, useState } from "react";

const STREAMS = [
  { name: "181.FM The Beat (Hip Hop / R&B)", url: "https://listen.181fm.com/181-beat_128k.mp3" },
  { name: "90s90s Hip Hop", url: "https://streams.90s90s.de/hiphop/mp3-192/" },
  { name: "Laut.FM Hip Hop", url: "https://stream.laut.fm/hiphop" },
  { name: "Laut.FM Old School Hip Hop", url: "https://stream.laut.fm/oldschool-hip-hop" },
  { name: "Laut.FM Hip Hop Classics", url: "https://stream.laut.fm/hip-hop-classics" },
];


export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [streamIdx, setStreamIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Autoplay on load — try immediately, fall back to first user gesture.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = STREAMS[0].url + "?t=" + Date.now();
    const tryPlay = async () => {
      try {
        await a.play();
        setPlaying(true);
        return true;
      } catch {
        return false;
      }
    };
    tryPlay().then((ok) => {
      if (ok) return;
      const onGesture = async () => {
        const success = await tryPlay();
        if (success) {
          window.removeEventListener("pointerdown", onGesture);
          window.removeEventListener("keydown", onGesture);
        }
      };
      window.addEventListener("pointerdown", onGesture, { once: false });
      window.addEventListener("keydown", onGesture, { once: false });
    });
  }, []);


  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        setLoading(true);
        a.src = STREAMS[streamIdx].url + "?t=" + Date.now();
        await a.play();
        setPlaying(true);
      } catch (e) {
        console.error("Radio play failed", e);
      } finally {
        setLoading(false);
      }
    }
  };

  const switchStream = (idx: number) => {
    setStreamIdx(idx);
    if (playing && audioRef.current) {
      audioRef.current.src = STREAMS[idx].url + "?t=" + Date.now();
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <>
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
      <div className={`radio-player ${expanded ? "radio-player--open" : ""}`}>
        <button
          className="radio-player__toggle"
          onClick={toggle}
          aria-label={playing ? "Pausar rádio" : "Tocar rádio"}
          disabled={loading}
        >
          {loading ? (
            <span className="radio-player__spinner" />
          ) : playing ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M7 5v14l12-7z" />
            </svg>
          )}
        </button>
        <div className="radio-player__meta">
          <div className="radio-player__label">
            <span className={`radio-player__dot ${playing ? "radio-player__dot--on" : ""}`} />
            OLD SCHOOL HIP HOP
          </div>
          <div className="radio-player__station">{STREAMS[streamIdx].name}</div>
        </div>
        <button
          className="radio-player__expand"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Expandir controles"
        >
          {expanded ? "−" : "+"}
        </button>
        {expanded && (
          <div className="radio-player__panel">
            <label className="radio-player__row">
              <span>Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
              />
            </label>
            <div className="radio-player__row">
              <span>Estação</span>
              <div className="radio-player__stations">
                {STREAMS.map((s, i) => (
                  <button
                    key={s.url}
                    className={`radio-player__station-btn ${i === streamIdx ? "is-active" : ""}`}
                    onClick={() => switchStream(i)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
