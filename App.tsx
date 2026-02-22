import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Icon } from './components/Icon';
import { Visualizer, VisualizerMode } from './components/Visualizer';
import { Equalizer } from './components/Equalizer';
import { Track, RepeatMode } from './types';

const DB_NAME = 'SCOC_BiblePlayer_DB';
const STORE_NAME = 'tracks';
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

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

const getImageUrl = (id: string, size: number) => {
    // 16:9 비율을 위한 너비와 높이 계산 (기본 너비를 1024px로 상향 조정하여 화질 확보)
    const targetWidth = Math.max(size, 1024);
    const targetHeight = Math.round(targetWidth * 9 / 16);
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash) + id.charCodeAt(i);
        hash |= 0; 
    }
    const seed = Math.abs(hash);
    
    // 자연/풍경 위주의 프롬프트 (인물 배제)
    const prompts = [
        "A lone tree on a hill at sunrise, god rays piercing through clouds, cinematic lighting, 8k",
        "Calm sea at dusk with a path of moonlight on water, ethereal atmosphere, highly detailed",
        "Close up of dew drops on a green leaf in a forest, morning mist, macro photography, professional",
        "Snow capped peaks of the Himalayas, epic scale, vast landscape, national geographic style",
        "Desert dunes under a starry night sky, milky way visible, lonely and majestic, deep colors",
        "Grand Canyon at golden hour, majestic red rock layers, warm sunlight, photorealistic",
        "Aurora Borealis over a frozen lake in Iceland, majestic green lights, starry night, professional photography",
        "Swiss Alps mountain peaks, dramatic snowy mountains, clear blue sky, majestic landscape",
        "Great Barrier Reef, vibrant coral underwater, turquoise clear water, realistic nature",
        "Autumn forest in Kyoto, vibrant red maple leaves, warm sunlight filtering through",
        "Victoria Falls, massive waterfall, mist rising, rainbows, powerful nature",
        "Lavender fields in Provence, endless purple flowers, warm summer sunset",
        "Antelope Canyon Arizona, smooth sandstone curves, beam of warm light, detailed texture",
        "Salar de Uyuni Bolivia, mirror reflection on salt flats, sunset colors, vast and majestic"
    ];

    const selectedPrompt = prompts[seed % prompts.length];
    
    // 사람, 신체 부위, 실루엣 등을 완벽하게 차단하기 위한 강력한 부정 프롬프트
    const negativePrompts = [
        // 1. 인물 및 신체 관련 (가장 강력하게 제외)
        "human, people, person, man, woman, girl, boy, child, baby, toddler, infant, teen, adult, elderly",
        "face, head, hair, eyes, nose, mouth, lips, ears, neck, shoulder, chest, torso, back",
        "arm, hand, finger, thumb, leg, foot, toe, limb, muscle, skin, flesh, anatomy, biological",
        "crowd, group, audience, pedestrian, traveler, tourist, inhabitant, resident, citizen",
        "feminine, masculine, gender, personage, self",
        
        // 2. 형상 및 표현 방식 (실루엣, 그림자 등)
        "silhouette, shadow of person, reflection of person, humanoid, character, figure, portrait, selfie, pose",
        "statue, sculpture, mannequin, doll, robot, cyborg, angel, demon, monster, ghost, spirit",
        "clothing, shirt, pants, dress, hat, shoes, glasses, accessories, fashion, uniform",
        
        // 3. 인공물 및 문명 (자연 풍경 유지를 위해)
        "building, house, city, architecture, vehicle, car, road, street, indoor, furniture, room",
        "machine, machinery, engine, electronics, technology, wires, cables, gadgets",
        
        // 4. 텍스트 및 품질 저하
        "text, signature, watermark, logo, typography, username, words, letters",
        "ugly, deformed, disfigured, mutation, blurry, low quality, grainy, out of focus, bad anatomy, extra limbs"
    ].join(", ");

    // Positive Prompt에도 사람 없음을 강조
    const positiveSuffix = "no people, no humans, uninhabited, pure landscape, nature only, scenery, deserted, wilderness, 8k, photorealistic, cinematic lighting, award winning";

    // 프롬프트 조합: 주제 + 강조 + 부정 키워드(모델에 따라 --no 문법 혹은 텍스트 내 포함)
    // Pollinations는 텍스트 기반이므로 긍정 프롬프트에 'no people'을 넣고, 추가적으로 뒤에 제외 키워드를 나열하여 가중치를 낮춥니다.
    const encodedPrompt = encodeURIComponent(`${selectedPrompt}, ${positiveSuffix}, exclude: ${negativePrompts}`);
    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${targetWidth}&height=${targetHeight}&seed=${seed}&nologo=true`;
};

const AlbumArt = ({ trackId, size, className }: { trackId: string, size: number, className?: string }) => {
    const primaryUrl = useMemo(() => getImageUrl(trackId, size), [trackId, size]);
    const [src, setSrc] = useState(primaryUrl);
    useEffect(() => { setSrc(getImageUrl(trackId, size)); }, [trackId, size]);
    
    // Fallback 이미지도 16:9 비율로 설정
    const fallbackWidth = Math.max(size, 1024);
    const fallbackHeight = Math.round(fallbackWidth * 9 / 16);

    return (
        <img 
            src={src} 
            alt="Album Art" 
            className={`${className} object-cover bg-gray-700`} 
            onError={() => setSrc(`https://picsum.photos/seed/${trackId}/${fallbackWidth}/${fallbackHeight}`)}
            loading="lazy"
        />
    );
};

const eqFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000];
const visualizerModes: VisualizerMode[] = ['line', 'bars', 'wave', 'circle', 'dots'];

// Fallback용 텍스트 로고 컴포넌트
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
    
    // 모바일에서는 기본적으로 사이드바 닫기, 데스크탑(768px 이상)에서는 열기
    const [isSidebarVisible, setIsSidebarVisible] = useState(window.innerWidth >= 768);
    
    const [showVisualizer, setShowVisualizer] = useState(true);
    const [visualizerModeIndex, setVisualizerModeIndex] = useState(0);
    const [isEqVisible, setIsEqVisible] = useState(false);
    const [eqGains, setEqGains] = useState<number[]>(() => Array(eqFrequencies.length).fill(0));
    const [sortConfig, setSortConfig] = useState<{ key: 'fileName' | 'artist', direction: 'asc' | 'desc' }>({ key: 'fileName', direction: 'asc' });
    const [logoError, setLogoError] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
    const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
    const wakeLockRef = useRef<any>(null);

    const stateRef = useRef({ playlist, currentTrackIndex, isShuffled, repeatMode, isPlaying });
    useEffect(() => {
        stateRef.current = { playlist, currentTrackIndex, isShuffled, repeatMode, isPlaying };
    }, [playlist, currentTrackIndex, isShuffled, repeatMode, isPlaying]);

    // 화면 크기 변경 시 사이드바 상태 자동 조정 (선택 사항)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                // 데스크탑으로 커지면 사이드바 보이기 (사용자가 닫았을 수 있으므로 강제하진 않음)
                // setIsSidebarVisible(true); 
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // IndexedDB 로드 및 상태 복구
    useEffect(() => {
        const loadFromDB = async () => {
            try {
                const db = await openDB();
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    let tracks: Track[] = request.result.map((item: any) => ({
                        ...item,
                        url: URL.createObjectURL(item.file)
                    }));
                    
                    tracks.sort((a, b) => a.file.name.localeCompare(b.file.name));

                    if (tracks.length > 0) {
                        setPlaylist(tracks);

                        // --- 상태 복구 로직 (설정 및 마지막 재생 위치) ---
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
                                    
                                    // Audio Element 설정
                                    if (audioRef.current) {
                                        audioRef.current.src = tracks[idx].url;
                                        if (lastTime) {
                                            const t = parseFloat(lastTime);
                                            if (!isNaN(t)) {
                                                // 메타데이터 로드 후 시간 설정 (안전성 확보)
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
                            }
                        } catch (e) {
                            console.error("Failed to restore state:", e);
                        }
                    }
                };
            } catch (err) {
                console.error("DB Load Error:", err);
            }
        };
        loadFromDB();
    }, []);

    const updateMediaSessionMetadata = useCallback((track: Track) => {
        if (!('mediaSession' in navigator)) return;
        
        // 메타데이터 업데이트 (16:9 비율 고려한 sizes 설정, 실제로는 API가 주는 이미지에 따라감)
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

    // 설정 값 변경 시 저장
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
            volume,
            repeatMode,
            isShuffled,
            showVisualizer,
            visualizerModeIndex,
            isEqVisible,
            eqGains
        }));
    }, [volume, repeatMode, isShuffled, showVisualizer, visualizerModeIndex, isEqVisible, eqGains]);

    // 재생 상태(곡 인덱스, 시간) 저장 로직
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

    // [신규 기능] 파일이 로드되었는데 현재 선택된 곡이 없다면 자동으로 첫 번째 곡 선택
    useEffect(() => {
        if (playlist.length > 0 && currentTrackIndex === null) {
            setCurrentTrackIndex(0);
            if (audioRef.current && playlist[0]) {
                audioRef.current.src = playlist[0].url;
                updateMediaSessionMetadata(playlist[0]);
            }
        }
    }, [playlist, currentTrackIndex, updateMediaSessionMetadata]);

    const setupAudioContext = useCallback(() => {
        if (!audioRef.current) return null;
        if (audioContext && audioContext.state !== 'closed') return audioContext;

        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        const context = new Ctx({ 
            latencyHint: 'playback',
            sampleRate: 44100 
        });
        
        // 중요: 오디오 컨텍스트가 가비지 컬렉션되지 않도록 window 객체에 할당 (디버깅용 겸 안정성)
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
        
        // iOS 백그라운드 재생 핵심: 컨텍스트가 중단되어 있다면 재생 시도 시 깨운다.
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
                // 재생 성공 시 MediaSession 상태 업데이트
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
            // [중요] 일시정지 시 AudioContext를 suspend하여 오디오 버퍼 글리치(반복) 현상 제거
            if (ctx && ctx.state === 'running') {
                await ctx.suspend();
            }
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        } else {
            if (stateRef.current.currentTrackIndex === null) {
                await playTrack(0);
                return;
            }

            if (ctx && ctx.state === 'suspended') {
                await ctx.resume().catch(() => {});
            }

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
            const nextIndex = Math.floor(Math.random() * playlist.length);
            playTrack(nextIndex);
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
                    // 마지막 곡이고 반복 없음이면 정지
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
        if (prevDisplayIndex < 0) {
            prevDisplayIndex = displayedPlaylist.length - 1;
        }

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

    // Media Session API 설정 강화
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        const audio = audioRef.current;

        // 잠금 화면에서 재생 버튼 눌렀을 때의 핸들러
        navigator.mediaSession.setActionHandler('play', async () => {
             // 중요: 백그라운드/잠금화면에서 오디오 컨텍스트가 죽어있으면 살려야 소리가 남
             if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
             audio?.play().catch(() => {});
             navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', async () => {
             audio?.pause();
             // 잠금화면 등에서 일시정지 시에도 Context suspend 처리
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

    // Visibility Change 및 Background Keep Alive 처리
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // 2초마다 체크하여 백그라운드에서 컨텍스트가 죽지 않도록 관리
        const keepAliveInterval = setInterval(() => {
            if (stateRef.current.isPlaying && audioContext && audioContext.state === 'suspended') {
                audioContext.resume().catch(() => {});
            }
        }, 2000);

        const handleVisibilityChange = () => {
            // 화면이 보이지 않게 되어도(백그라운드), 재생 중이면 절대 pause 하지 않음.
            // 오히려 iOS Safari 이슈 방지를 위해 컨텍스트가 살아있는지 확인.
            if (document.visibilityState === 'hidden') {
                if (stateRef.current.isPlaying && audioContext && audioContext.state === 'suspended') {
                    audioContext.resume().catch(() => {});
                }
            } else if (document.visibilityState === 'visible') {
                // 화면이 다시 켜졌을 때 동기화
                if (stateRef.current.isPlaying && audioContext && audioContext.state === 'suspended') {
                    audioContext.resume().catch(() => {});
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            // MediaSession 위치 정보 업데이트 (잠금화면 프로그레스 바)
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

    // Wake Lock (화면 꺼짐 방지) - 비디오가 아닌 오디오 앱이지만, 사용자가 화면을 보고 있을 때 유용
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

    const handleDeleteTrack = async (e: React.MouseEvent, trackId: string) => {
        e.stopPropagation();
        try {
            const db = await openDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.delete(trackId);
            
            transaction.oncomplete = () => {
                setPlaylist(prev => {
                    const deletedIndex = prev.findIndex(t => t.id === trackId);
                    const newPlaylist = prev.filter(t => t.id !== trackId);
                    
                    if (currentTrackIndex !== null) {
                        const currentTrack = prev[currentTrackIndex];
                        if (currentTrack && currentTrack.id === trackId) {
                            if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.src = "";
                            }
                            setIsPlaying(false);
                            setCurrentTrackIndex(null);
                        } else if (deletedIndex < currentTrackIndex) {
                            setCurrentTrackIndex(currentTrackIndex - 1);
                        }
                    }
                    return newPlaylist;
                });
            };
        } catch (err) {
            console.error("Delete Error:", err);
        }
    };

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList) as File[];
        const db = await openDB();
        
        const tracksToAdd: Track[] = files.map((file, i) => {
            const url = URL.createObjectURL(file);
            const fileName = file.name.replace(/\.[^/.]+$/, "");
            let trackName = fileName;
            
            // 성경 파일명 패턴 분석 (예: 42_001.mp3 -> 누가복음 1장)
            const match = fileName.match(/^(\d{2})[_.-](\d+)/);
            if (match) {
                const bookCode = match[1];
                const chapterStr = match[2];
                const bookName = bibleNames[bookCode];
                if (bookName) {
                     const chapter = parseInt(chapterStr, 10);
                     trackName = `${bookName} ${chapter}장`;
                }
            }
            
            return {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${i}`,
                file,
                name: trackName,
                artist: 'Unknown Artist',
                duration: 0,
                url
            };
        });

        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        tracksToAdd.forEach(t => {
            const { url, ...saveData } = t; 
            store.put(saveData);
        });

        setPlaylist(prev => {
            const updated = [...prev, ...tracksToAdd].sort((a, b) => a.file.name.localeCompare(b.file.name));
            // 자동 재생/선택 로직은 useEffect로 이동됨
            return updated;
        });

        tracksToAdd.forEach(track => {
            const tempAudio = new Audio();
            tempAudio.src = track.url;
            tempAudio.onloadedmetadata = async () => {
                const dur = tempAudio.duration;
                setPlaylist(prev => prev.map(t => t.id === track.id ? { ...t, duration: dur } : t));
                
                const upTx = db.transaction(STORE_NAME, 'readwrite');
                const upStore = upTx.objectStore(STORE_NAME);
                const req = upStore.get(track.id);
                req.onsuccess = () => {
                   if(req.result) {
                       req.result.duration = dur;
                       upStore.put(req.result);
                   }
                };
                tempAudio.src = '';
            };

            const jsmediatags = (window as any).jsmediatags;
            if (jsmediatags) {
                jsmediatags.read(track.file, {
                    onSuccess: (tag: any) => {
                        const { title, artist: tagArtist } = tag.tags;
                        if (title) { 
                            setPlaylist(prev => prev.map(t => t.id === track.id ? { 
                                ...t, 
                                name: title, 
                                artist: tagArtist || t.artist 
                            } : t));

                            const upTx = db.transaction(STORE_NAME, 'readwrite');
                            const upStore = upTx.objectStore(STORE_NAME);
                            const req = upStore.get(track.id);
                            req.onsuccess = () => {
                                const data = req.result;
                                if (data) {
                                    data.name = title;
                                    data.artist = tagArtist || data.artist;
                                    upStore.put(data);
                                }
                            };
                        }
                    },
                    onError: (error: any) => {
                        console.log('jsmediatags error:', error);
                    }
                });
            }
        });

        event.target.value = '';
    }, []);

    const handleClearPlaylist = useCallback(async () => {
        if (playlist.length === 0) return;
        
        if (!confirm("모든 파일을 삭제하고 앱을 초기화하시겠습니까?")) return;

        try {
            const db = await openDB();
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear();
            
            transaction.oncomplete = () => {
                setPlaylist([]);
                setCurrentTrackIndex(null);
                setIsPlaying(false);
                setCurrentTime(0);
                setDuration(0);
                setSearchTerm("");

                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.src = "";
                    audioRef.current.load();
                }
                
                localStorage.removeItem(STORAGE_KEY_LAST_INDEX);
                localStorage.removeItem(STORAGE_KEY_LAST_TIME);

                if ('mediaSession' in navigator) {
                    navigator.mediaSession.metadata = null;
                    navigator.mediaSession.playbackState = 'none';
                }
            };
        } catch (err) {
            console.error("Reset Error:", err);
        }
    }, [playlist]);

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
                                    <button onClick={(e) => handleDeleteTrack(e, track.id)} className="p-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity" title="파일 삭제"><Icon name="trash" className="w-5 h-5" /></button>
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

                              {/* 메인 컨트롤러: PC에서는 3등분 그리드(md:grid-cols-3)를 사용하여 중앙 정렬 보장 */}
                              <div className="grid grid-cols-1 md:grid-cols-3 items-center bg-black/20 p-2 md:p-4 rounded-2xl w-full">
    
                              {/* 1. 좌측 그룹 (셔플, 반복) - PC에서는 왼쪽 정렬 */}
                              <div className="flex items-center justify-center md:justify-start gap-2 md:gap-4 order-2 md:order-1 mt-3 md:mt-0">
                                  <button onClick={() => setIsShuffled(!isShuffled)} className={`p-2 text-2xl md:text-3xl transition-colors ${isShuffled ? 'opacity-100' : 'opacity-40'}`}>
                                       🔀
                                  </button>
                                  <button onClick={() => setRepeatMode(prev => (prev + 1) % 3)} className={`p-2 text-2xl md:text-3xl transition-colors ${repeatMode !== RepeatMode.NONE ? 'opacity-100' : 'opacity-40'}`}>
                                        {repeatMode === RepeatMode.ONE ? '🔂' : '🔁'}
                                  </button>
                              </div>

                             {/* 2. 중앙 그룹 (이전, 재생, 다음) - PC에서 완벽한 중앙 배치 */}
                             <div className="flex items-center justify-center gap-4 md:gap-8 order-1 md:order-2">
                                 <button onClick={handlePrev} className="p-2 text-gray-200 hover:text-white transition-colors">
                                     <Icon name="prev" className="w-8 h-8 md:w-10 md:h-10"/>
                                 </button>
                                 <button onClick={handlePlayPause} className="w-16 h-16 md:w-24 md:h-24 flex items-center justify-center bg-cyan-400 text-black rounded-full shadow-lg md:shadow-xl transform active:scale-95 md:hover:scale-110 transition-all">
                                     <Icon name={isPlaying ? 'pause' : 'play'} className="w-10 h-10 md:w-14 md:h-14 fill-current"/>
                                 </button>
                                 <button onClick={handleNext} className="p-2 text-gray-200 hover:text-white transition-colors">
                                     <Icon name="next" className="w-8 h-8 md:w-10 md:h-10"/>
                                 </button>
                            </div>

                            {/* 3. 우측 그룹 (볼륨) - 모바일(hidden) 숨김, PC(md:flex) 오른쪽 정렬 */}
                            <div className="hidden md:flex items-center justify-end gap-2 order-3">
                               <Icon name="volume" className="w-5 h-5 text-gray-400" />
                               <div className="w-24">
                                  <input 
                                     type="range" min="0" max="1" step="0.01" value={volume} 
                                     onChange={(e) => setVolume(parseFloat(e.target.value))} 
                                     className="w-full h-1.5 accent-cyan-400 cursor-pointer block" 
                                  />
                              </div>
                           </div>
                       </div>
                          
                            <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl">
                                <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar">
                                    <button onClick={() => fileInputRef.current?.click()} className="p-2 sm:p-3 text-gray-400 hover:text-white flex-shrink-0" title="파일 불러오기"><Icon name="folder" /></button>
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
                                    <button onClick={handleClearPlaylist} className="p-2 sm:p-3 text-gray-400 hover:text-white" title="앱 초기화"><Icon name="refresh" /></button>
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
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" onChange={handleFileChange} />
                {isEqVisible && <Equalizer onClose={() => setIsEqVisible(false)} gains={eqGains} setGains={setEqGains} frequencies={eqFrequencies} />}
            </div>
        </div>
    );
}
