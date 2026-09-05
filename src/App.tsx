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
import { islands, connections, places, spawn } from './world/map';
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
  const scale = 0.7;
  const px = (x: number) => 100 + x * scale,
    pz = (z: number) => 63 + z * scale;
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
              rx={i.radius * scale}
              ry={i.radius * scale}
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
    x: spawn.x,
    z: spawn.z,
    y: spawn.y,
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
            'This browser could not open the 3D world. Enable WebGL and reload to try again.',
          );
        }
      })
      .catch(() =>
        setError('The world could not load. Check your connection and reload to try again.'),
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
      notify('Ambient sound could not start. Please try again.');
    }
  };
  const takePhoto = async () => {
    try {
      await engine.current?.takePhoto();
      notify('Your travel photo has been saved.');
    } catch {
      notify('Your photo could not be saved.');
    }
  };
  const changeTime = () => {
    const next = !night;
    setNight(next);
    engine.current?.setNight(next);
    notify(next ? 'Night falls over Yukagecho.' : 'Welcome to Yukagecho at dusk.');
  };
  const close = () => setModal(null);
  return (
    <main {...stylex.props(s.app)}>
      <div
        ref={container}
        data-world-x={state.x.toFixed(2)}
        data-world-z={state.z.toFixed(2)}
        data-world-y={state.y.toFixed(2)}
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
                notify('Camera view reset.');
              }}
              aria-label="Yukagecho - Reset camera"
            >
              <OnsenMark />
              <span>
                <span {...stylex.props(s.brandTitle)}>Yukagecho</span>
                <span lang="ja" {...stylex.props(s.brandSub)}>
                  湯影町
                </span>
              </span>
            </button>
            <p {...stylex.props(s.motto)}>A quiet moment above the clouds.</p>
            <nav aria-label="World settings" {...stylex.props(s.toolbar)}>
              <button
                {...stylex.props(s.iconButton, sound && s.activeButton)}
                aria-label={sound ? 'Mute ambient sound' : 'Enable ambient sound'}
                aria-pressed={sound}
                title={sound ? 'Mute ambient sound' : 'Enable ambient sound'}
                onClick={() => void toggleAudio()}
              >
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <button
                {...stylex.props(s.iconButton, s.desktopButton)}
                aria-label={night ? 'Switch to dusk' : 'Switch to night'}
                title={night ? 'Switch to dusk' : 'Switch to night'}
                onClick={changeTime}
              >
                {night ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <button
                {...stylex.props(s.iconButton)}
                aria-label="Save photo"
                title="Save photo"
                onClick={() => void takePhoto()}
                disabled={!ready}
              >
                <Camera size={17} />
              </button>
              <button
                {...stylex.props(s.iconButton)}
                aria-label="Controls"
                title="Controls"
                onClick={() => setModal('help')}
              >
                <CircleHelp size={18} />
              </button>
            </nav>
          </header>
          <section key={state.place.id} {...stylex.props(s.location)} aria-label="Current location">
            <span {...stylex.props(s.smallText)}>FROM FOOTHILLS TO FLOATING WORLDS</span>
            <h1 {...stylex.props(s.placeTitle)}>{state.place.english}</h1>
            <p lang="ja" {...stylex.props(s.japaneseName)}>
              {state.place.name}
            </p>
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
                  {visited.includes(state.place.id) ? 'A TRAVEL MEMORY' : 'A LITTLE DISCOVERY'}
                </span>
                <span {...stylex.props(s.interactTitle)}>
                  {state.place.id === 'onsen'
                    ? 'Pause by the hot springs'
                    : state.place.id === 'shrine'
                      ? 'Leave a wish on the wind'
                      : state.place.id === 'inn'
                        ? 'Visit the ryokan'
                        : state.place.id === 'ascent'
                          ? 'Take in the view'
                          : state.place.id === 'ground-bath'
                            ? 'Visit the springs'
                            : 'Follow the lanterns'}
                </span>
              </span>
              <ChevronRight size={15} />
            </button>
          )}
          <div {...stylex.props(s.controls)} aria-label="Keyboard controls">
            <span {...stylex.props(s.controlPart)}>
              <span>
                {['W', 'A', 'S', 'D'].map((k) => (
                  <kbd key={k} {...stylex.props(s.key)}>
                    {k}
                  </kbd>
                ))}
              </span>{' '}
              Walk
            </span>
            <span {...stylex.props(s.controlDivider)} />
            <span>Drag to look</span>
            <span {...stylex.props(s.controlDivider)} />
            <span {...stylex.props(s.controlPart)}>
              <kbd {...stylex.props(s.key)}>E</kbd> Discover
            </span>
            <span {...stylex.props(s.controlDivider)} />
            <span {...stylex.props(s.controlPart)}>
              <kbd {...stylex.props(s.key)}>M</kbd> Travel journal
            </span>
          </div>
          <div {...stylex.props(s.mapArea)}>
            <button
              {...stylex.props(s.mapButton)}
              aria-label="Open map and travel journal"
              title="Travel journal (M)"
              onClick={() => setModal('journal')}
            >
              <MiniMap state={state} visited={visited} />
            </button>
            <div {...stylex.props(s.mapCaption)}>
              <Map size={10} />
              <span>DISCOVERED</span>
              <span>
                {visited.length} / {places.length}
              </span>
            </div>
          </div>
          <div {...stylex.props(s.touch)} aria-label="Touch movement">
            {[
              { label: 'Move forward', x: 0, y: -1, icon: ArrowUp, style: s.touchUp },
              { label: 'Move left', x: -1, y: 0, icon: ArrowLeft, style: s.touchLeft },
              { label: 'Move right', x: 1, y: 0, icon: ArrowRight, style: s.touchRight },
              { label: 'Move backward', x: 0, y: 1, icon: ArrowDown, style: s.touchDown },
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
          H · Show interface
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
          <h1 {...stylex.props(s.loadingTitle)}>Yukagecho</h1>
          <span lang="ja" {...stylex.props(s.brandSub)}>
            湯影町
          </span>
          <p {...stylex.props(s.loadingCopy)}>
            {error || 'Preparing your journey above the clouds…'}
          </p>
          {error && (
            <button
              {...stylex.props(s.iconButton)}
              aria-label="Reload"
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
                ? 'A PLACE TO REMEMBER'
                : modal === 'journal'
                  ? 'A LITTLE TRAVEL JOURNAL'
                  : 'TAKE YOUR TIME'}
            </span>
            <h2 id="dialog-title" {...stylex.props(s.dialogTitle)}>
              {modal === 'place'
                ? activePlace.english
                : modal === 'journal'
                  ? 'Travel journal'
                  : 'How to explore'}
            </h2>
            {modal === 'place' && (
              <p lang="ja" {...stylex.props(s.japaneseName)}>
                {activePlace.name}
              </p>
            )}
          </div>
          <button {...stylex.props(s.iconButton)} aria-label="Close" onClick={close}>
            <X size={17} />
          </button>
        </div>
        {modal === 'place' && (
          <>
            <p {...stylex.props(s.story)}>{activePlace.story}</p>
            <p {...stylex.props(s.helpFooter)}>
              <Check size={12} /> Added to your travel journal.
            </p>
            <button {...stylex.props(s.action)} onClick={close}>
              Keep exploring
            </button>
          </>
        )}
        {modal === 'help' && (
          <>
            <p {...stylex.props(s.story)}>
              No deadlines. No need to hurry.
              <br />
              Start in the foothill town. Follow the red bridges north, through Cloudview Terrace,
              to the floating village.
            </p>
            {[
              { name: 'Walk', keys: 'W A S D / Arrow keys' },
              { name: 'Run / Hop', keys: 'Shift / Space' },
              { name: 'Look around / Zoom', keys: 'Drag / Scroll' },
              { name: 'Discover a place', keys: 'E' },
              { name: 'Travel journal', keys: 'M' },
              { name: 'Hide interface', keys: 'H' },
              { name: 'Close', keys: 'Esc' },
            ].map((row) => (
              <div key={row.name} {...stylex.props(s.helpRow)}>
                <span>{row.name}</span>
                <span {...stylex.props(s.helpKeys)}>{row.keys}</span>
              </div>
            ))}
            <p {...stylex.props(s.helpFooter)}>
              On mobile, use the arrows to walk and drag the scene to look around.
              <br />
              Use the camera to save a photo. Your discoveries are saved in this browser.
            </p>
            <button {...stylex.props(s.action)} onClick={close}>
              Continue exploring
            </button>
          </>
        )}
        {modal === 'journal' && (
          <>
            <p {...stylex.props(s.journalDesc)}>
              {visited.length === places.length
                ? 'Every place is now part of your journey.'
                : 'A little discovery awaits across each bridge.'}{' '}
              {visited.length} / {places.length}
            </p>
            {places.map((place) => (
              <div key={place.id} {...stylex.props(s.journalRow)}>
                <span {...stylex.props(s.stamp, visited.includes(place.id) && s.stamped)}>
                  {place.symbol}
                </span>
                <div>
                  <h3 {...stylex.props(s.journalName)}>{place.english}</h3>
                  <p lang="ja" {...stylex.props(s.japaneseName, s.journalJapanese)}>
                    {place.name}
                  </p>
                  <p {...stylex.props(s.journalDesc)}>
                    {visited.includes(place.id) ? place.description : 'Waiting to be discovered'}
                  </p>
                </div>
                {visited.includes(place.id) && (
                  <Check size={15} {...stylex.props(s.journalCheck)} />
                )}
              </div>
            ))}
            <p {...stylex.props(s.helpFooter)}>
              Near a landmark, press E or tap the discovery prompt to add it to your journal.
            </p>
            <button {...stylex.props(s.action)} onClick={close}>
              Find your next discovery
            </button>
          </>
        )}
      </dialog>
    </main>
  );
}
