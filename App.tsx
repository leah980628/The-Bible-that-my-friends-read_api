import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Icon } from './components/Icon';
import { Visualizer, VisualizerMode } from './components/Visualizer';
import { Equalizer } from './components/Equalizer';
import { Track, RepeatMode } from './types';

// ✅ Cloudflare R2 공개 URL
const R2_BASE_URL = 'https://pub-671da4d0ad7f4987a1126bed7db40f70.r2.dev';

const STORAGE_KEY_SETTINGS = 'scoc_settings';
const STORAGE_KEY_LAST_INDEX = 'scoc_last_index';
const STORAGE_KEY_LAST_TIME = 'scoc_last_time';

// 성경 66권 코드 매핑
const bibleNames: Record<string, string> = {
  "01": "창세기", "02": "출애굽기", "03": "레위기", "04": "민수기", "05": "신명기",
  "06": "여호수아", "07": "사사기", "08": "룻기", "09": "사무엘상", "10": "사무엘하",
  "11": "열왕기상", "12": "열왕기하", "13": "역대상", "14": "역대하", "15": "에스라",
  "16": "느헤미야", "17": "에스더", "18": "욥기", "19": "시편", "20": "잠언",
  "21": "전도서", "22": "아가", "23": "이사야", "24": "예레미야", "25": "예레미야애가",
  "26": "에스겔", "27": "다니엘", "28": "호세아", "29": "요엘", "30": "아모스",
  "31": "오바댜", "32": "요나", "33": "미가", "34": "나훔", "35": "하박국",
  "36": "스바냐", "37": "학개", "38": "스가랴", "39": "말라기",
  "40": "마태복음", "41": "마가복음", "42": "누가복음", "43": "요한복음", "44": "사도행전",
  "45": "로마서", "46": "고린도전서", "47": "고린도후서", "48": "갈라디아서", "49": "에베소서",
  "50": "빌립보서", "51": "골로새서", "52": "데살로니가전서", "53": "데살로니가후서", "54": "디모데전서",
  "55": "디모데후서", "56": "디도서", "57": "빌레몬서", "58": "히브리서", "59": "야고보서",
  "60": "베드로전서", "61": "베드로후서", "62": "요한1서", "63": "요한2서", "64": "요한3서",
  "65": "유다서", "66": "요한계시록"
};

// 성경 각 권의 장 수
const bibleChapters: Record<string, number> = {
  "01":50,"02":40,"03":27,"04":36,"05":34,"06":24,"07":21,"08":4,
  "09":31,"10":24,"11":22,"12":25,"13":29,"14":36,"15":10,"16":13,
  "17":10,"18":42,"19":150,"20":31,"21":12,"22":8,"23":66,"24":52,
  "25":5,"26":48,"27":12,"28":14,"29":3,"30":9,"31":1,"32":4,
  "33":7,"34":3,"35":3,"36":3,"37":2,"38":14,"39":4,
  "40":28,"41":16,"42":24,"43":21,"44":28,"45":16,"46":16,"47":13,
  "48":6,"49":6,"50":4,"51":4,"52":5,"53":3,"54":6,"55":4,
  "56":3,"57":1,"58":13,"59":5,"60":5,"61":3,"62":5,"63":1,
  "64":1,"65":1,"66":22
};

// ✅ R2에서 전체 성경 트랙 목록 생성 (파일이 없어도 목록은 만들어둠)
const loadTracksFromR2 = (): Track[] => {
  const tracks: Track[] = [];
  Object.entries(bibleNames).forEach(([bookCode, bookName]) => {
    const totalChapters = bibleChapters[bookCode];
    if (!totalChapters) return;
    for (let chapter = 1; chapter <= totalChapters; chapter++) {
      const chapterStr = String(chapter).padStart(3, '0');
      const fileName = `${bookCode}_${chapterStr}.mp3`;
      const url = `${R2_BASE_URL}/${fileName}`;
      tracks.push({
        id: `r2-${bookCode}-${chapterStr}`,
        file: new File([], fileName),
        name: `${bookName} ${chapter}장`,
        artist: '친구들이 들려주는 성경말씀',
        duration: 0,
        url
      });
    }
  });
  return tracks;
};

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

const getImageUrl = (id: string, size: number) => {
    const targetWidth = Math.max(size, 1024);
    const targetHeight = Math.round(targetWidth * 9 / 16);
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0; 
    }
    const seed = Math.abs(hash);
    
    const prompts = [
        "Ancient primordial forest with giant mossy stones and ethereal mist, no civilization",
        "Majestic mountain range untouched by man, crystal clear alpine lake, prehistoric nature",
        "Deep ocean coral reef with vibrant marine life, turquoise water, zero human presence",
        "Empty desert dunes under a celestial milky way, silent prehistoric landscape",
        "Isolated wild waterfall in a dense tropical jungle, ancient exotic plants, pristine lagoon",
        "Arctic glaciers and massive icebergs in a pure blue ocean, dramatic cold wilderness",
        "Infinite field of wild flowers under a dramatic sunset, untouched prehistoric meadow"
    ];

    const selectedPrompt = prompts[seed % prompts.length];
    
    const negativeKeywords = [
        "human, person, man, woman, child, baby, crowd, group of people, pedestrians, silhouette, face, hands, fingers, skin, hair, eyes, body parts, anatomy, portrait",
        "laptop, computer, notebook, pen, coffee cup, camera, lens, tripod, electronics, tech, gadget, wires, cables, screen, monitor, machinery, engine, motor",
        "building, skyscraper, house, architecture, window, city, urban, street, road, asphalt, pavement, bridge, wall, fence, post, streetlight, sign, logo, text",
        "vehicle, car, automobile, truck, bicycle, bike, train, airplane, boat, ship, furniture, chair, desk, office, room, indoor",
        "plastic, metal plates, concrete, trash, glass, clothing, fashion, outfit, blurry, distorted, grainy, low quality, watermark, signature"
    ].join(", ");

    const statusTags = "strictly no people, zero humans, uninhabited wilderness, 100% pure nature, primeval landscape, cinematic lighting, national geographic style, highly detailed, 8k";
    const finalPrompt = `${selectedPrompt}, ${statusTags}, avoid: ${negativeKeywords}`;
    const encodedPrompt = encodeURIComponent(finalPrompt);

    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${targetWidth}&height=${targetHeight}&seed=${seed}&nologo=true`;
};

const AlbumArt = ({ trackId, size, className }: { trackId: string, size: number, className?: string }) => {
    const primaryUrl = useMemo(() => getImageUrl(trackId, size), [trackId, size]);
    const [src, setSrc] = useState(primaryUrl);
    
    useEffect(() => { 
        setSrc(getImageUrl(trackId, size)); 
    }, [trackId, size]);
    
    const fallbackWidth = Math.max(size, 1024);
    const fallbackHeight = Math.round(fallbackWidth * 9 / 16);

    return (
        <img 
            src={src} 
            alt="Album Art" 
            className={`${className} object-cover bg-gray-900 transition-opacity duration-500`} 
            onError={() => setSrc(`https://picsum.photos/seed/${trackId}/${fallbackWidth}/${fallbackHeight}`)}
            loading="lazy"
        />
    );
};

const eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
const visualizerModes: VisualizerMode[] = ['line', 'bars', 'wave', 'circle', 'dots'];

const ScocTextLogo = ({ className }: { className?: string }) => (
  <span className={`${className} text-xl font-bold tracking-tight text-white`}>SCOC</span>
);

export default function App() {
    const [playlist, setPlaylist] = useState<Track[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.5);
    const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.NONE);
    const [isShuffled, setIsShuffled] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSidebarVisible, setIsSidebarVisible] = useState(window.innerWidth >= 768);
    const [showVisualizer, setShowVisualizer] = useState(true);
    const [visualizerModeIndex, setVisualizerModeIndex] = useState(0);
    const [isEqVisible, setIsEqVisible] = useState(false);
    const [eqGains, setEqGains] = useState<number[]>(() => Array(eqFrequencies.length).fill(0));
    const [sortConfig, setSortConfig] = useState<{ key: 'fileName' | 'artist', direction: 'asc' | 'desc' }>({ key: 'fileName', direction: 'asc' });
    const [logoError, setLogoError] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
    const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
    const wakeLockRef = useRef<any>(null);

    const stateRef = useRef({ playlist, currentTrackIndex, isShuffled, repeatMode, isPlaying });
    useEffect(() => {
        stateRef.current = { playlist, currentTrackIndex, isShuffled, repeatMode, isPlaying };
    }, [playlist, currentTrackIndex, isShuffled, repeatMode, isPlaying]);

    // ✅ 앱 시작 시 R2에서 트랙 목록 자동 로드
    useEffect(() => {
        const tracks = loadTracksFromR2();
        setPlaylist(tracks);

        // 설정 복구
        try {
            const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
            if (savedSettings.volume !== undefined) setVolume(savedSettings.volume);
            if (savedSettings.repeatMode !== undefined) setRepeatMode(savedSettings.repeatMode);
            if (savedSettings.isShuffled !== undefined) setIsShuffled(savedSettings.isShuffled);
            if (savedSettings.visualizerModeIndex !== undefined) setVisualizerModeIndex(savedSettings.visualizerModeIndex);
            if (savedSettings.showVisualizer !== undefined) setShowVisualizer(savedSettings.showVisualizer);
            if (savedSettings.isEqVisible !== undefined) setIsEqVisible(savedSettings.isEqVisible);
            if (savedSettings.eqGains) setEqGains(savedSettings.eqGains);

            const lastIndex = localStorage.getItem(STORAGE_KEY_LAST_INDEX);
            const lastTime = localStorage.getItem(STORAGE_KEY_LAST_TIME);

            if (lastIndex !== null) {
                const idx = parseInt(lastIndex);
                if (tracks[idx]) {
                    setCurrentTrackIndex(idx);
                    if (audioRef.current) {
                        audioRef.current.src = tracks[idx].url;
                        if (lastTime) {
                            const t = parseFloat(lastTime);
                            if (!isNaN(t)) {
                                const setTimeOnce = () => {
                                    if (audioRef.current) {
                                        audioRef.current.currentTime = t;
                                        setCurrentTime(t);
                                    }
                                };
                                audioRef.current.addEventListener('loadedmetadata', setTimeOnce, { once: true });
                            }
                        }
                    }
                }
            } else {
                // 처음 방문 시 첫 번째 곡 선택
                setCurrentTrackIndex(0);
                if (audioRef.current && tracks[0]) {
                    audioRef.current.src = tracks[0].url;
                }
            }
        } catch (e) {
            console.error("Failed to restore state:", e);
            setCurrentTrackIndex(0);
        }
    }, []);

    const updateMediaSessionMetadata = useCallback((track: Track) => {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            album: '친구들이 들려주는 성경말씀',
            artwork: [
                { src: getImageUrl(track.id, 512), sizes: '512x288', type: 'image/png' },
                { src: getImageUrl(track.id, 256), sizes: '256x144', type: 'image/png' },
                { src: getImageUrl(track.id, 128), sizes: '128x72', type: 'image/png' }
            ]
        });
    }, []);

    // 설정 저장
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
            volume, repeatMode, isShuffled, showVisualizer,
            visualizerModeIndex, isEqVisible, eqGains
        }));
    }, [volume, repeatMode, isShuffled, showVisualizer, visualizerModeIndex, isEqVisible, eqGains]);

    // 재생 위치 저장
    useEffect(() => {
        const savePlaybackState = () => {
            if (currentTrackIndex !== null) {
                localStorage.setItem(STORAGE_KEY_LAST_INDEX, currentTrackIndex.toString());
            }
            if (audioRef.current) {
                localStorage.setItem(STORAGE_KEY_LAST_TIME, audioRef.current.currentTime.toString());
            }
        };

        if (currentTrackIndex !== null) {
            localStorage.setItem(STORAGE_KEY_LAST_INDEX, currentTrackIndex.toString());
        }

        window.addEventListener('beforeunload', savePlaybackState);
        document.addEventListener('visibilitychange', savePlaybackState);
        const interval = setInterval(savePlaybackState, 5000);

        return () => {
            window.removeEventListener('beforeunload', savePlaybackState);
            document.removeEventListener('visibilitychange', savePlaybackState);
            clearInterval(interval);
        };
    }, [currentTrackIndex]);

    const setupAudioContext = useCallback(() => {
        if (!audioRef.current) return null;
        if (audioContext && audioContext.state !== 'closed') return audioContext;

        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        const context = new Ctx({ latencyHint: 'playback', sampleRate: 44100 });
        (window as any).scocAudioContext = context;

        const source = context.createMediaElementSource(audioRef.current);
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;

        const filters = eqFrequencies.map((freq) => {
            const filter = context.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.gain.value = 0;
            filter.Q.value = 1.4;
            return filter;
        });
        
        eqFiltersRef.current = filters;
        const connectedFilters = filters.reduce((prev, curr) => {
            prev.connect(curr);
            return curr;
        }, source as AudioNode);
        
        connectedFilters.connect(analyser);
        analyser.connect(context.destination);

        setAudioContext(context);
        setAnalyserNode(analyser);
        return context;
    }, [audioContext]);

    const displayedPlaylist = useMemo(() => {
        return [...playlist]
            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.artist.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const dir = sortConfig.direction === 'asc' ? 1 : -1;
                const valA = sortConfig.key === 'fileName' ? a.file.name : a.artist;
                const valB = sortConfig.key === 'fileName' ? b.file.name : b.artist;
                return valA.localeCompare(valB) * dir;
            });
    }, [playlist, searchTerm, sortConfig]);

    const playTrack = useCallback(async (index: number) => {
        const { playlist } = stateRef.current;
        if (!playlist[index] || !audioRef.current) return;

        const track = playlist[index];
        const audio = audioRef.current;

        updateMediaSessionMetadata(track);
        const ctx = setupAudioContext();
        
        if (ctx && ctx.state === 'suspended') {
            await ctx.resume().catch(e => console.warn("AudioContext resume failed:", e));
        }

        if (audio.src !== track.url) {
            audio.src = track.url;
            audio.load();
        }

        setCurrentTrackIndex(index);
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                await playPromise;
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Playback failed:", err);
            }
        }
    }, [setupAudioContext, updateMediaSessionMetadata]);

    const handlePlayPause = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio || stateRef.current.playlist.length === 0) return;

        const ctx = setupAudioContext();

        if (stateRef.current.isPlaying) {
            audio.pause();
            if (ctx && ctx.state === 'running') await ctx.suspend();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        } else {
            if (stateRef.current.currentTrackIndex === null) {
                await playTrack(0);
                return;
            }
            if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => {});
            try {
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    await playPromise;
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error("Play failed:", err);
            }
        }
    }, [setupAudioContext, playTrack]);

    const handleNext = useCallback(() => {
        const { playlist, currentTrackIndex, isShuffled, repeatMode } = stateRef.current;
        if (playlist.length === 0) return;

        if (isShuffled) {
            playTrack(Math.floor(Math.random() * playlist.length));
        } else {
            const currentTrackId = playlist[currentTrackIndex || 0]?.id;
            const currentDisplayIndex = displayedPlaylist.findIndex(t => t.id === currentTrackId);
            
            if (currentDisplayIndex === -1) {
                playTrack((currentTrackIndex || 0) + 1);
                return;
            }

            let nextDisplayIndex = currentDisplayIndex + 1;
            if (nextDisplayIndex >= displayedPlaylist.length) {
                if (repeatMode === RepeatMode.ALL) {
                    nextDisplayIndex = 0;
                } else {
                    if (audioRef.current) audioRef.current.pause();
                    setIsPlaying(false);
                    return;
                }
            }

            const nextTrack = displayedPlaylist[nextDisplayIndex];
            const originalIndex = playlist.findIndex(t => t.id === nextTrack.id);
            playTrack(originalIndex);
        }
    }, [playTrack, displayedPlaylist]);

    const handlePrev = useCallback(() => {
        const { playlist, currentTrackIndex } = stateRef.current;
        if (playlist.length === 0) return;

        const currentTrackId = playlist[currentTrackIndex || 0]?.id;
        const currentDisplayIndex = displayedPlaylist.findIndex(t => t.id === currentTrackId);

        let prevDisplayIndex = currentDisplayIndex - 1;
        if (prevDisplayIndex < 0) prevDisplayIndex = displayedPlaylist.length - 1;

        const prevTrack = displayedPlaylist[prevDisplayIndex];
        const originalIndex = playlist.findIndex(t => t.id === prevTrack.id);
        playTrack(originalIndex);
    }, [playTrack, displayedPlaylist]);

    const handleSeek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    }, []);

    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        const audio = audioRef.current;

        navigator.mediaSession.setActionHandler('play', async () => {
             if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
             audio?.play().catch(() => {});
             navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', async () => {
             audio?.pause();
             if (audioContext && audioContext.state === 'running') await audioContext.suspend();
             navigator.mediaSession.playbackState = 'paused';
        });
        navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
        navigator.mediaSession.setActionHandler('nexttrack', handleNext);
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) handleSeek(details.seekTime);
        });

        return () => {
            ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'].forEach(action => {
                navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
            });
        };
    }, [handleNext, handlePrev, handleSeek, audioContext]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const keepAliveInterval = setInterval(() => {
            if (stateRef.current.isPlaying && audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
        }, 2000);

        const handleVisibilityChange = () => {
            if (stateRef.current.isPlaying && audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && !isNaN(audio.duration)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: audio.duration || 0,
                        playbackRate: audio.playbackRate,
                        position: audio.currentTime
                    });
                } catch (e) {}
            }
        };

        const onEnded = () => {
            if (stateRef.current.repeatMode === RepeatMode.ONE) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            } else {
                handleNext();
            }
        };

        const onPlay = () => {
            setIsPlaying(true);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(() => {});
        };

        const onPause = () => {
            setIsPlaying(false);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);

        return () => {
            clearInterval(keepAliveInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', () => setDuration(audio.duration));
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
        };
    }, [handleNext, audioContext, isPlaying]);

    useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
    useEffect(() => {
        eqFiltersRef.current.forEach((filter, i) => {
            if (filter) filter.gain.setTargetAtTime(eqGains[i], (audioContext?.currentTime || 0), 0.1);
        });
    }, [eqGains, audioContext]);

    useEffect(() => {
        const requestWakeLock = async () => {
            if ('wakeLock' in navigator && isPlaying) {
                try { 
                    if (wakeLockRef.current) await wakeLockRef.current.release();
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); 
                } catch (err) {}
            }
        };
        if (isPlaying) requestWakeLock();
        else if (wakeLockRef.current) { 
            wakeLockRef.current.release().catch(() => {}); 
            wakeLockRef.current = null; 
        }
    }, [isPlaying]);

    const currentTrack = useMemo(() => {
        return currentTrackIndex !== null && playlist[currentTrackIndex] ? playlist[currentTrackIndex] : null;
    }, [playlist, currentTrackIndex]);

    return (
        <div className="fixed inset-0 w-full h-[100dvh] flex items-center justify-center font-sans text-white bg-[#0f172a] overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle at top left, #1e293b, #0f172a 40%)' }}>
            <div className="w-full h-full md:w-[950px] md:h-[720px] bg-gray-800/70 backdrop-blur-sm md:rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/90 z-20">
                    <div className="flex items-center space-x-4">
                        <Icon name="bible" className="w-8 h-8 md:w-10 md:h-10 text-cyan-400" />
                        <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">친구들이 들려주는 성경말씀</h1>
                    </div>
                    <div className="flex items-center">
                        <a href="https://scoc.net/" target="_blank" rel="noopener noreferrer" className="ml-2 hover:opacity-80 transition-opacity" title="서울그리스도의 교회 홈페이지 방문">
                            {logoError ? (
                                <ScocTextLogo />
                            ) : (
                                <img 
                                    src="scoc_logo.png" 
                                    alt="SCOC" 
                                    className="h-6 md:h-7 w-auto object-contain" 
                                    onError={() => setLogoError(true)}
                                />
                            )}
                        </a>
                    </div>
                </header>

                <main className="flex-grow flex flex-col md:flex-row relative overflow-hidden min-h-0">
                    <aside className={`transition-all duration-300 z-30 ${isSidebarVisible ? 'absolute inset-0 bg-gray-900 md:static md:w-1/3 md:bg-black/20 flex flex-col' : 'hidden md:hidden'}`}>
                        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700/50">
                            <h2 className="font-bold">파일 목록 ({displayedPlaylist.length})</h2>
                            <button onClick={() => setIsSidebarVisible(false)} className="p-2 md:hidden" title="목록 닫기"><Icon name="close" className="w-8 h-8" /></button>
                        </div>
                        <div className="overflow-y-auto p-3 space-y-2 flex-grow">
                            {displayedPlaylist.length === 0 && <p className="text-center text-gray-500 mt-10">목록이 비었습니다.</p>}
                            {displayedPlaylist.map((track) => (
                                <div key={track.id} 
                                     onClick={() => {
                                         playTrack(playlist.findIndex(t => t.id === track.id));
                                         if(window.innerWidth < 768) setIsSidebarVisible(false); 
                                     }}
                                     title={`${track.name} 재생`}
                                     className={`group flex items-center p-3 rounded-lg cursor-pointer transition-colors ${currentTrack?.id === track.id ? 'bg-cyan-500/30' : 'hover:bg-white/10'}`}>
                                    <AlbumArt trackId={track.id} size={48} className="w-12 h-12 rounded-md mr-4 flex-shrink-0" />
                                    <div className="flex-grow overflow-hidden">
                                        <p className="font-semibold truncate">{track.name}</p>
                                        <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <section className="flex flex-col w-full h-full p-4 md:p-6 space-y-4 md:space-y-6 flex-grow overflow-hidden">
                        <div className="flex-grow min-h-0 bg-black/30 rounded-xl relative overflow-hidden flex items-center justify-center">
                            {showVisualizer ? <Visualizer analyserNode={analyserNode} mode={visualizerModes[visualizerModeIndex]} /> : 
                                (currentTrack ? <AlbumArt trackId={currentTrack.id} size={600} className="w-full h-full" /> : <Icon name="music-note" className="w-24 h-24 md:w-32 md:h-32 opacity-10" />)}
                        </div>

                        <div className="flex-shrink-0 space-y-4">
                            <div className="text-center px-4">
                                <h2 className="text-xl md:text-2xl font-bold truncate">{currentTrack ? currentTrack.name : '재생할 곡을 선택하세요'}</h2>
                                <p className="text-cyan-200/70">{currentTrack ? currentTrack.artist : '-'}</p>
                            </div>

                            <div className="space-y-2">
                                <input type="range" min="0" max={duration || 0} value={currentTime} onChange={(e) => handleSeek(parseFloat(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-400" title="재생 위치 조절"/>
                                <div className="flex justify-between text-xs font-mono opacity-50">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            <div className="flex flex-col md:grid md:grid-cols-3 items-center bg-black/20 p-3 md:p-4 rounded-2xl w-full">
                                <div className="flex items-center justify-center w-full md:contents gap-x-3 sm:gap-x-6">
                                    <div className="flex items-center justify-center md:justify-start md:flex-1 gap-1 md:gap-4 flex-shrink-0">
                                        <button onClick={() => setIsShuffled(!isShuffled)} className={`p-1.5 text-2xl md:text-3xl transition-colors ${isShuffled ? 'opacity-100' : 'opacity-40'}`}>🔀</button>
                                        <button onClick={() => setRepeatMode(prev => (prev + 1) % 3)} className={`p-1.5 text-2xl md:text-3xl transition-colors ${repeatMode !== RepeatMode.NONE ? 'opacity-100' : 'opacity-40'}`}>
                                            {repeatMode === RepeatMode.ONE ? '🔂' : '🔁'}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-center md:flex-1 gap-3 md:gap-8 flex-shrink-0">
                                        <button onClick={handlePrev} className="p-1 text-gray-200 active:text-cyan-400"><Icon name="prev" className="w-8 h-8 md:w-10 md:h-10"/></button>
                                        <button onClick={handlePlayPause} className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center bg-cyan-400 text-black rounded-full shadow-lg transform active:scale-90 md:hover:scale-110 transition-all">
                                            <Icon name={isPlaying ? 'pause' : 'play'} className="w-9 h-9 md:w-14 md:h-14 fill-current"/>
                                        </button>
                                        <button onClick={handleNext} className="p-1 text-gray-200 active:text-cyan-400"><Icon name="next" className="w-8 h-8 md:w-10 md:h-10"/></button>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center justify-end gap-2 md:flex-1">
                                    <Icon name="volume" className="w-5 h-5 text-gray-400" />
                                    <div className="w-24">
                                        <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-1.5 accent-cyan-400 cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                          
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                                <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar">
                                    <button onClick={() => setShowVisualizer(!showVisualizer)} className={`p-2 sm:p-3 flex-shrink-0 ${!showVisualizer ? 'text-cyan-400' : 'text-gray-400'}`} title="화면 모드 변경"><Icon name="gallery" /></button>
                                    <button onClick={() => setVisualizerModeIndex(p => (p + 1) % visualizerModes.length)} className="p-2 sm:p-3 text-gray-400 hover:text-white flex-shrink-0" title="시각화 효과 변경"><Icon name="chart-bar" /></button>
                                    <button onClick={() => setIsEqVisible(true)} className="p-2 sm:p-3 text-gray-400 hover:text-white flex-shrink-0" title="이퀄라이저"><Icon name="equalizer" /></button>
                                    <button onClick={() => setIsSidebarVisible(true)} className="p-2 sm:p-3 text-gray-400 hover:text-white flex-shrink-0" title="목록"><Icon name="list" /></button>
                                </div>
                                <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                                            <Icon name="search" className="w-4 h-4 text-gray-500 group-focus-within:text-cyan-400 transition-colors" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="검색" 
                                            className="bg-gray-700/50 text-white text-xs sm:text-sm rounded-full pl-8 pr-2 py-1.5 w-20 sm:w-32 focus:w-28 sm:focus:w-48 transition-all focus:outline-none focus:ring-1 focus:ring-cyan-400 placeholder-gray-500 border border-transparent focus:bg-gray-700"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
                <audio 
                    ref={audioRef} 
                    playsInline 
                    // @ts-ignore
                    webkit-playsinline="true"
                    preload="auto" 
                    crossOrigin="anonymous" 
                    // @ts-ignore
                    x-webkit-airplay="allow"
                    autoPlay={false}
                />
                {isEqVisible && <Equalizer onClose={() => setIsEqVisible(false)} gains={eqGains} setGains={setEqGains} frequencies={eqFrequencies} />}
            </div>
        </div>
    );
}
