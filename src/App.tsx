import { useCallback, useEffect, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Map,
  Moon,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { s } from './styles';
import { islands, connections, places } from './world/map';
import type { Place } from './world/map';
import type { WorldEngine, WorldState } from './world/engine';
import { Soundscape } from './world/audio';

type Modal = 'help' | 'journal' | 'place' | null;
const SAVE_KEY = 'yukagecho.visits.v1';
function savedVisits(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '[]');
    return Array.isArray(saved)
      ? saved.filter(
          (id): id is string => typeof id === 'string' && places.some((p) => p.id === id),
        )
      : [];
  } catch {
    return [];
  }
}
function OnsenMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...stylex.props(s.logo)}>
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M19 39c-7 3-9 8 1 11 7 2 18 2 25-2 6-4 0-7-2-8M23 37c-8-8 7-11 0-23m10 23c-8-8 7-11 0-23m10 23c-8-8 7-11 0-23"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
function MiniMap({ state, visited }: { state: WorldState; visited: string[] }) {
  const px = (x: number) => 99 + x * 1.52,
    pz = (z: number) => 124 + z * 1.45;
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
      <defs>
        <clipPath id="mapClip">
          <circle cx="100" cy="100" r="87" />
        </clipPath>
        <radialGradient id="mapBg">
          <stop stopColor="#2c4347" />
          <stop offset="1" stopColor="#172e3b" />
        </radialGradient>
      </defs>
      <circle
        cx="100"
        cy="100"
        r="94"
        fill="url(#mapBg)"
        fillOpacity=".88"
        stroke="#d0b583"
        strokeWidth=".8"
      />
      <circle
        cx="100"
        cy="100"
        r="89"
        fill="none"
        stroke="#d0b583"
        strokeOpacity=".4"
        strokeWidth=".5"
      />
      <g clipPath="url(#mapClip)">
        {connections.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={px(islands[a].x)}
            y1={pz(islands[a].z)}
            x2={px(islands[b].x)}
            y2={pz(islands[b].z)}
            stroke="#b97a5b"
            strokeWidth="4"
          />
        ))}
        {islands.map((i) => (
          <g key={i.id}>
            <ellipse
              cx={px(i.x)}
              cy={pz(i.z)}
              rx={i.radius * 1.3}
              ry={i.radius * 1.2}
              fill="#52635c"
              stroke="#8e9273"
              strokeWidth=".5"
            />
            <path
              d={`M${px(i.x) - i.radius},${pz(i.z)}h${i.radius * 2}M${px(i.x)},${pz(i.z) - i.radius}v${i.radius * 2}`}
              stroke="#b3a78a"
              strokeWidth="1.4"
            />
          </g>
        ))}
        {[-11, -4, 4, 11].map((z, i) => (
          <g key={z}>
            <rect
              x={px(-9)}
              y={pz(z) - 3}
              width="7"
              height="6"
              fill={i % 2 ? '#bd9774' : '#809088'}
              transform={`rotate(-6 ${px(-9)} ${pz(z)})`}
            />
            <rect x={px(6)} y={pz(z) - 3} width="7" height="6" fill="#ab9476" />
          </g>
        ))}
        {places.map((p) => (
          <g key={p.id}>
            <circle
              cx={px(p.x)}
              cy={pz(p.z)}
              r="7"
              fill="#263c42"
              stroke={visited.includes(p.id) ? '#eed2a1' : '#8c9789'}
              strokeWidth=".7"
            />
            <text
              x={px(p.x)}
              y={pz(p.z) + 3}
              textAnchor="middle"
              fill="#e8cfa5"
              fontSize="8"
              fontFamily="serif"
            >
              {p.symbol}
            </text>
          </g>
        ))}
        <g
          transform={`translate(${px(state.x)} ${pz(state.z)}) rotate(${(-state.yaw * 180) / Math.PI})`}
        >
          <circle r="7" fill="#f3ddac" opacity=".14" />
          <path d="M0 -6L4 5 0 3 -4 5Z" fill="#ffedc5" stroke="#243741" strokeWidth=".7" />
        </g>
      </g>
      <text x="100" y="11" textAnchor="middle" fontSize="11" fill="#e7cea2" fontFamily="serif">
        N
      </text>
      {[0, 90, 180, 270].map((a) => (
        <path
          key={a}
          d="M100 2l3 5-3 5-3-5Z"
          fill="#263e47"
          stroke="#d6b883"
          strokeWidth=".7"
          transform={`rotate(${a} 100 100)`}
        />
      ))}
    </svg>
  );
}

export default function App() {
  const container = useRef<HTMLDivElement>(null),
    engine = useRef<WorldEngine | null>(null),
    audio = useRef<Soundscape | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [modal, setModal] = useState<Modal>(null),
    [sound, setSound] = useState(false),
    [night, setNight] = useState(false),
    [hideUI, setHideUI] = useState(false),
    [toast, setToast] = useState('');
  const [visited, setVisited] = useState(savedVisits),
    [activePlace, setActivePlace] = useState<Place>(places[0]);
  const [state, setState] = useState<WorldState>({
    x: 0,
    z: 12,
    yaw: 0.17,
    place: places[0],
    nearby: true,
    paused: false,
  });
  const stateRef = useRef(state),
    interactRef = useRef<() => void>(() => {});
  const notify = useCallback((text: string) => setToast(text), []);
  const interact = useCallback(() => {
    const current = stateRef.current;
    if (!current.nearby) return;
    setActivePlace(current.place);
    setModal('place');
    setVisited((old) => {
      if (old.includes(current.place.id)) return old;
      const next = [...old, current.place.id];
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      } catch {
        /* Private storage does not prevent exploring. */
      }
      return next;
    });
  }, []);
  useEffect(() => {
    interactRef.current = interact;
  }, [interact]);
  useEffect(() => {
    let cancelled = false;
    audio.current = new Soundscape();
    void import('./world/engine')
      .then(({ WorldEngine }) => {
        if (cancelled || !container.current) return;
        try {
          engine.current = new WorldEngine(container.current, {
            onState: (next) => {
              stateRef.current = next;
              setState(next);
            },
            onInteract: () => interactRef.current(),
            onReady: () => setReady(true),
            onError: setError,
          });
        } catch (e) {
          console.error(e);
          setError(
            'このブラウザで3Dの世界を開けませんでした。WebGLを有効にして、再読み込みしてください。',
          );
        }
      })
      .catch(() =>
        setError('世界の読み込みに失敗しました。接続を確認して、再読み込みしてください。'),
      );
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
      audio.current?.dispose();
    };
  }, []);
  useEffect(() => {
    engine.current?.pause(modal !== null);
    if (modal) dialog.current?.showModal();
    else {
      dialog.current?.close();
      container.current?.querySelector('canvas')?.focus({ preventScroll: true });
    }
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,textarea')) return;
      if (event.code === 'Escape') {
        setModal(null);
        setHideUI(false);
      }
      if (event.code === 'KeyM' && !event.repeat)
        setModal((old) => (old === 'journal' ? null : 'journal'));
      if (event.code === 'KeyH' && !event.repeat && !modal) setHideUI((old) => !old);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [modal]);
  const toggleAudio = async () => {
    try {
      setSound(await audio.current!.toggle());
    } catch {
      notify('環境音を再生できませんでした。もう一度お試しください。');
    }
  };
  const takePhoto = async () => {
    try {
      await engine.current?.takePhoto();
      notify('旅の一枚を保存しました。');
    } catch {
      notify('写真を保存できませんでした。');
    }
  };
  const changeTime = () => {
    const next = !night;
    setNight(next);
    engine.current?.setNight(next);
    notify(next ? '夜の湯影町へ。' : '夕暮れの湯影町へ。');
  };
  const close = () => setModal(null);
  return (
    <main {...stylex.props(s.app)}>
      <div
        ref={container}
        data-world-x={state.x.toFixed(2)}
        data-world-z={state.z.toFixed(2)}
        data-world-yaw={state.yaw.toFixed(3)}
        data-world-paused={state.paused}
        {...stylex.props(s.world)}
      />
      {!hideUI && (
        <>
          <div {...stylex.props(s.vignette)} />
          <div {...stylex.props(s.frame)}>
            <span {...stylex.props(s.corner)} />
            <span {...stylex.props(s.corner, s.cornerBR)} />
          </div>
          <header {...stylex.props(s.header)}>
            <button
              {...stylex.props(s.brand)}
              onClick={() => {
                engine.current?.resetView();
                notify('視点を戻しました。');
              }}
              aria-label="湯影町・視点を戻す"
            >
              <OnsenMark />
              <span>
                <span {...stylex.props(s.brandTitle)}>湯影町</span>
                <span {...stylex.props(s.brandSub)}>YUKAGECHO</span>
              </span>
            </button>
            <p {...stylex.props(s.motto)}>雲の上で、ひと休み。</p>
            <nav aria-label="旅の設定" {...stylex.props(s.toolbar)}>
              <button
                {...stylex.props(s.iconButton, sound && s.activeButton)}
                aria-label={sound ? '環境音をオフ' : '環境音をオン'}
                aria-pressed={sound}
                title={sound ? '環境音をオフ' : '環境音をオン'}
                onClick={() => void toggleAudio()}
              >
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <button
                {...stylex.props(s.iconButton, s.desktopButton)}
                aria-label={night ? '夕暮れにする' : '夜にする'}
                title={night ? '夕暮れにする' : '夜にする'}
                onClick={changeTime}
              >
                {night ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <button
                {...stylex.props(s.iconButton)}
                aria-label="写真を保存"
                title="写真を保存"
                onClick={() => void takePhoto()}
                disabled={!ready}
              >
                <Camera size={17} />
              </button>
              <button
                {...stylex.props(s.iconButton)}
                aria-label="操作ガイド"
                title="操作ガイド"
                onClick={() => setModal('help')}
              >
                <CircleHelp size={18} />
              </button>
            </nav>
          </header>
          <section key={state.place.id} {...stylex.props(s.location)} aria-label="現在地">
            <span {...stylex.props(s.smallText)}>天空の温泉郷</span>
            <h1 {...stylex.props(s.placeTitle)}>{state.place.name}</h1>
            <div {...stylex.props(s.divider)}>
              <span {...stylex.props(s.diamond)} />
            </div>
            <p {...stylex.props(s.placeDescription)}>{state.place.description}</p>
          </section>
          {ready && state.nearby && !modal && (
            <button {...stylex.props(s.interact)} onClick={interact}>
              <kbd {...stylex.props(s.key)}>E</kbd>
              <span>
                <span {...stylex.props(s.interactSub)}>
                  {visited.includes(state.place.id) ? '旅のひとこま' : '小さな寄り道'}
                </span>
                <span {...stylex.props(s.interactTitle)}>
                  {state.place.id === 'onsen'
                    ? '湯けむりにひと休み'
                    : state.place.id === 'shrine'
                      ? '風に願いを'
                      : state.place.id === 'inn'
                        ? '旅の宿を訪ねる'
                        : '提灯の灯りをたどる'}
                </span>
              </span>
              <ChevronRight size={15} />
            </button>
          )}
          <div {...stylex.props(s.controls)} aria-label="操作方法">
            <span {...stylex.props(s.controlPart)}>
              <span>
                {['W', 'A', 'S', 'D'].map((k) => (
                  <kbd key={k} {...stylex.props(s.key)}>
                    {k}
                  </kbd>
                ))}
              </span>{' '}
              移動
            </span>
            <span {...stylex.props(s.controlDivider)} />
            <span>ドラッグ 視点</span>
            <span {...stylex.props(s.controlDivider)} />
            <span {...stylex.props(s.controlPart)}>
              <kbd {...stylex.props(s.key)}>E</kbd> 調べる
            </span>
            <span {...stylex.props(s.controlDivider)} />
            <span {...stylex.props(s.controlPart)}>
              <kbd {...stylex.props(s.key)}>M</kbd> 旅の手帖
            </span>
          </div>
          <div {...stylex.props(s.mapArea)}>
            <button
              {...stylex.props(s.mapButton)}
              aria-label="地図と旅の手帖を開く"
              title="旅の手帖 (M)"
              onClick={() => setModal('journal')}
            >
              <MiniMap state={state} visited={visited} />
            </button>
            <div {...stylex.props(s.mapCaption)}>
              <Map size={10} />
              <span>湯めぐり</span>
              <span>{visited.length} / 4</span>
            </div>
          </div>
          <div {...stylex.props(s.touch)} aria-label="タッチ移動">
            {[
              { label: '前へ', x: 0, y: -1, icon: ArrowUp, style: s.touchUp },
              { label: '左へ', x: -1, y: 0, icon: ArrowLeft, style: s.touchLeft },
              { label: '右へ', x: 1, y: 0, icon: ArrowRight, style: s.touchRight },
              { label: '後ろへ', x: 0, y: 1, icon: ArrowDown, style: s.touchDown },
            ].map(({ label, x, y, icon: Icon, style }) => (
              <button
                key={label}
                aria-label={label}
                {...stylex.props(s.touchButton, style)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  engine.current?.setTouchAxis(x, y);
                }}
                onPointerUp={() => engine.current?.setTouchAxis(0, 0)}
                onPointerCancel={() => engine.current?.setTouchAxis(0, 0)}
                onLostPointerCapture={() => engine.current?.setTouchAxis(0, 0)}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </>
      )}
      {hideUI && (
        <button {...stylex.props(s.photoReturn)} onClick={() => setHideUI(false)}>
          H · 旅の画面に戻る
        </button>
      )}
      {toast && (
        <div role="status" {...stylex.props(s.toast)}>
          {toast}
        </div>
      )}
      {(!ready || error) && (
        <div {...stylex.props(s.loading)} role="status">
          <OnsenMark />
          <h1 {...stylex.props(s.loadingTitle)}>湯影町</h1>
          <p {...stylex.props(s.loadingCopy)}>{error || '雲の向こうに、旅の支度を。'}</p>
          {error && (
            <button
              {...stylex.props(s.iconButton)}
              aria-label="再読み込み"
              onClick={() => location.reload()}
            >
              <RotateCcw size={17} />
            </button>
          )}
        </div>
      )}
      <dialog
        ref={dialog}
        {...stylex.props(s.dialog)}
        aria-labelledby="dialog-title"
        onCancel={close}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <div {...stylex.props(s.dialogTop)}>
          <div>
            <span {...stylex.props(s.smallText)}>
              {modal === 'place'
                ? activePlace.english
                : modal === 'journal'
                  ? 'A LITTLE TRAVEL JOURNAL'
                  : 'TAKE YOUR TIME'}
            </span>
            <h2 id="dialog-title" {...stylex.props(s.dialogTitle)}>
              {modal === 'place'
                ? activePlace.name
                : modal === 'journal'
                  ? '旅の手帖'
                  : '湯影町の歩き方'}
            </h2>
          </div>
          <button {...stylex.props(s.iconButton)} aria-label="閉じる" onClick={close}>
            <X size={17} />
          </button>
        </div>
        {modal === 'place' && (
          <>
            <p {...stylex.props(s.story)}>{activePlace.story}</p>
            <p {...stylex.props(s.helpFooter)}>
              <Check size={12} /> この場所を、旅の手帖に記しました。
            </p>
            <button {...stylex.props(s.action)} onClick={close}>
              もう少し、歩いてみる
            </button>
          </>
        )}
        {modal === 'help' && (
          <>
            <p {...stylex.props(s.story)}>
              目的地も、制限時間もありません。
              <br />
              気になる橋の向こうへ、のんびりと。
            </p>
            {[
              { name: '歩く', keys: 'W A S D / 矢印キー' },
              { name: '走る / 小さく跳ぶ', keys: 'Shift / Space' },
              { name: '見回す / 近づく', keys: 'ドラッグ / スクロール' },
              { name: '場所を調べる', keys: 'E' },
              { name: '旅の手帖', keys: 'M' },
              { name: '風景だけを楽しむ', keys: 'H' },
              { name: '閉じる', keys: 'Esc' },
            ].map((row) => (
              <div key={row.name} {...stylex.props(s.helpRow)}>
                <span>{row.name}</span>
                <span {...stylex.props(s.helpKeys)}>{row.keys}</span>
              </div>
            ))}
            <p {...stylex.props(s.helpFooter)}>
              スマートフォンでは、左下の矢印で歩き、画面をなぞって見回せます。
              <br />
              カメラで旅の写真を保存。湯めぐりの記録はこのブラウザに残ります。
            </p>
            <button {...stylex.props(s.action)} onClick={close}>
              散策をつづける
            </button>
          </>
        )}
        {modal === 'journal' && (
          <>
            <p {...stylex.props(s.journalDesc)}>
              {visited.length === 4
                ? '四つの風景が、あなたの旅の記憶になりました。'
                : '橋の向こうに、小さな発見が待っています。'}{' '}
              {visited.length} / 4
            </p>
            {places.map((place) => (
              <div key={place.id} {...stylex.props(s.journalRow)}>
                <span {...stylex.props(s.stamp, visited.includes(place.id) && s.stamped)}>
                  {place.symbol}
                </span>
                <div>
                  <h3 {...stylex.props(s.journalName)}>{place.name}</h3>
                  <p {...stylex.props(s.journalDesc)}>
                    {visited.includes(place.id) ? place.description : 'まだ訪れていない風景'}
                  </p>
                </div>
                {visited.includes(place.id) && (
                  <Check size={15} {...stylex.props(s.journalCheck)} />
                )}
              </div>
            ))}
            <p {...stylex.props(s.helpFooter)}>
              場所の近くで E を押すか、「小さな寄り道」をタップすると記録できます。
            </p>
            <button {...stylex.props(s.action)} onClick={close}>
              次の風景を探しに
            </button>
          </>
        )}
      </dialog>
    </main>
  );
}
