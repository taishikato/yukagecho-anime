import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildArchitecture, createTraveler, random } from './architecture';
import { canWalk, nearestPlace, surfaceHeight } from './map';
import type { Place } from './map';

export interface WorldState {
  x: number;
  z: number;
  yaw: number;
  place: Place;
  nearby: boolean;
  paused: boolean;
}
interface Callbacks {
  onState: (state: WorldState) => void;
  onInteract: () => void;
  onReady: () => void;
  onError: (message: string) => void;
}

export class WorldEngine {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.2, 650);
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private objects = buildArchitecture();
  private traveler = createTraveler();
  private keys = new Set<string>();
  private yaw = 0.1;
  private pitch = 0.38;
  private distance = 58;
  private pointer: { x: number; y: number; id: number } | null = null;
  private position = new THREE.Vector3(0, 0.15, 12);
  private time = 0;
  private jump = 0;
  private jumpSpeed = 0;
  private frame = 0;
  private last = 0;
  private lastUpdate = 0;
  private resizeObserver: ResizeObserver;
  private steam: { sprite: THREE.Sprite; source: THREE.Vector3; phase: number; scale: number }[] =
    [];
  private particles: THREE.Points;
  private particlePositions: Float32Array;
  private disposed = false;
  private isPaused = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private touchAxis = { x: 0, y: 0 };
  private focus = new THREE.Vector3();
  private light: THREE.DirectionalLight;
  private night = false;
  private skyMaterial: THREE.ShaderMaterial | null = null;

  constructor(
    private container: HTMLElement,
    private callbacks: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '雲海に浮かぶ湯影町の3D世界。WASDまたは矢印キーで移動、ドラッグで視点を変更。',
    );
    this.renderer.domElement.setAttribute('tabindex', '0');
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#a9b2c6');
    this.scene.fog = new THREE.FogExp2('#b0aebf', 0.0043);
    this.scene.add(new THREE.HemisphereLight('#b7d8f0', '#8b6e70', 1.3));
    this.light = new THREE.DirectionalLight('#ffd5a6', 2.3);
    this.light.position.set(-25, 45, 30);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    Object.assign(this.light.shadow.camera, {
      left: -60,
      right: 60,
      top: 60,
      bottom: -60,
      near: 1,
      far: 160,
    });
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.06;
    this.scene.add(this.light);
    this.scene.add(this.objects.group, this.traveler.group);
    for (const z of [11, 4, -4, -11]) {
      const glow = new THREE.PointLight('#ffb65f', 3.5, 7, 2);
      glow.position.set(0, 2.3, z);
      this.scene.add(glow);
    }
    this.camera.position.set(6, 20, 39);
    this.focus.copy(this.position).add(new THREE.Vector3(6, 1.5, -8));
    this.camera.lookAt(this.focus);

    new THREE.TextureLoader().load(
      '/sky.webp',
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        this.skyMaterial = new THREE.ShaderMaterial({
          uniforms: { panorama: { value: texture }, brightness: { value: 1 } },
          side: THREE.BackSide,
          depthWrite: false,
          toneMapped: false,
          vertexShader:
            'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader:
            'uniform sampler2D panorama; uniform float brightness; varying vec3 direction; void main(){vec3 d=normalize(direction);vec2 uv=vec2(fract(atan(d.z,d.x)/6.2831853+.6),clamp(asin(d.y)*.9+.5,.005,.995));gl_FragColor=vec4(texture2D(panorama,uv).rgb*brightness,1.);}',
        });
        const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 40, 24), this.skyMaterial);
        sky.renderOrder = -10;
        this.scene.add(sky);
      },
      undefined,
      () => {
        /* The procedural atmosphere remains usable if the background cannot load. */
      },
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(800, 600), 0.24, 0.5, 1.2));
    this.composer.addPass(new OutputPass());
    const cloudTexture = this.makeCloudTexture();
    for (const source of this.objects.steamSources) {
      for (let i = 0; i < 5; i++) {
        const material = new THREE.SpriteMaterial({
          map: cloudTexture,
          color: '#e3e6e9',
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        this.steam.push({ sprite, source, phase: i / 5, scale: 1.5 + random() });
        this.scene.add(sprite);
      }
    }
    // Soft cloud banks sit below the islands, leaving their suspended rock faces visible.
    for (let i = 0; i < 65; i++) {
      const material = new THREE.SpriteMaterial({
        map: cloudTexture,
        color: i % 2 ? '#c0b9cb' : '#ead1d1',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      const a = random() * Math.PI * 2,
        r = 35 + random() * 120;
      sprite.position.set(Math.cos(a) * r, -12 - random() * 11, Math.sin(a) * r - 30);
      const s = 20 + random() * 36;
      sprite.scale.set(s * 2, s, 1);
      this.scene.add(sprite);
    }
    this.particlePositions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      this.particlePositions[i * 3] = (random() - 0.5) * 100;
      this.particlePositions[i * 3 + 1] = random() * 20;
      this.particlePositions[i * 3 + 2] = (random() - 0.5) * 100;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: '#ffe0d4',
        size: 0.09,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    this.scene.add(this.particles);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.pointerdown);
    canvas.addEventListener('pointermove', this.pointermove);
    canvas.addEventListener('pointerup', this.pointerup);
    canvas.addEventListener('pointercancel', this.pointerup);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.frame = requestAnimationFrame(this.animate);
    callbacks.onReady();
  }

  private makeCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,.8)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,.5)');
    gradient.addColorStop(0.65, 'rgba(255,255,255,.18)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }
  private resize = () => {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };
  private keydown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest('input,textarea,dialog,[role="dialog"]')) return;
    if (
      (event.target as HTMLElement).closest('button') &&
      ['Space', 'Enter', 'KeyE'].includes(event.code)
    )
      return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
      ].includes(event.code)
    )
      event.preventDefault();
    if (this.isPaused) return;
    this.keys.add(event.code);
    if (event.code === 'KeyE' && !event.repeat) this.callbacks.onInteract();
    if (event.code === 'Space' && this.jump === 0) this.jumpSpeed = 4.5;
  };
  private keyup = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };
  private blur = () => {
    this.keys.clear();
    this.touchAxis = { x: 0, y: 0 };
  };
  private visibility = () => {
    this.blur();
    this.last = 0;
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.callbacks.onError('3D描画が中断されました。ページを再読み込みしてください。');
    this.pause(true);
  };
  private pointerdown = (e: PointerEvent) => {
    this.pointer = { x: e.clientX, y: e.clientY, id: e.pointerId };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private pointermove = (e: PointerEvent) => {
    if (!this.pointer || this.pointer.id !== e.pointerId || this.isPaused) return;
    this.yaw -= (e.clientX - this.pointer.x) * 0.004;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + (e.clientY - this.pointer.y) * 0.003,
      0.22,
      1.15,
    );
    this.pointer = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  private pointerup = () => {
    this.pointer = null;
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.018, 10, 65);
  };

  private animate = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min(this.last ? (now - this.last) / 1000 : 0, 0.05);
    this.last = now;
    if (document.hidden) return;
    if (!this.isPaused) this.time += dt;
    let dx = 0,
      dz = 0;
    if (!this.isPaused) {
      const forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
        this.touchAxis.y;
      const side =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
        this.touchAxis.x;
      dx = side * Math.cos(this.yaw) - forward * Math.sin(this.yaw);
      dz = -forward * Math.cos(this.yaw) - side * Math.sin(this.yaw);
      const len = Math.hypot(dx, dz);
      if (len > 1) {
        dx /= len;
        dz /= len;
      }
      const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 7.5 : 4) * dt;
      // Axis-separated collision gives wall sliding and prevents walking off islands.
      if (canWalk(this.position.x + dx * speed, this.position.z, this.objects.obstacles))
        this.position.x += dx * speed;
      if (canWalk(this.position.x, this.position.z + dz * speed, this.objects.obstacles))
        this.position.z += dz * speed;
      this.position.y = surfaceHeight(this.position.x, this.position.z) ?? this.position.y;
      if (this.jumpSpeed !== 0 || this.jump > 0) {
        this.jumpSpeed -= 12 * dt;
        this.jump = Math.max(0, this.jump + this.jumpSpeed * dt);
        if (this.jump === 0) this.jumpSpeed = 0;
      }
    }
    const moving = Math.hypot(dx, dz) > 0.05;
    this.traveler.group.position.copy(this.position);
    this.traveler.group.position.y += this.jump;
    if (moving) {
      const target = Math.atan2(dx, dz);
      const delta = Math.atan2(
        Math.sin(target - this.traveler.group.rotation.y),
        Math.cos(target - this.traveler.group.rotation.y),
      );
      this.traveler.group.rotation.y += delta * Math.min(1, dt * 12);
    }
    const walk = moving ? Math.sin(this.time * 11) * 0.45 : 0;
    this.traveler.left.rotation.x = walk;
    this.traveler.right.rotation.x = -walk;
    this.traveler.la.rotation.x = -walk * 0.7;
    this.traveler.ra.rotation.x = walk * 0.7;
    const target = this.position
      .clone()
      .add(new THREE.Vector3(this.camera.aspect < 0.8 ? 0 : 12, 1.5, -8));
    const smoothing = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 4);
    this.focus.lerp(target, smoothing);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    );
    this.camera.position.lerp(this.focus.clone().add(offset), smoothing);
    this.camera.lookAt(this.focus);
    const t = this.reducedMotion ? 0 : this.time;
    for (const s of this.steam) {
      const phase = (t * 0.075 + s.phase) % 1;
      s.sprite.position
        .copy(s.source)
        .add(
          new THREE.Vector3(
            Math.sin(phase * 4 + s.phase) * phase * 1.7,
            phase * 6,
            Math.sin(phase * 3) * 0.4,
          ),
        );
      const size = s.scale * (0.6 + phase * 1.7);
      s.sprite.scale.set(size, size * 1.4, 1);
      s.sprite.material.opacity = Math.sin(phase * Math.PI) * 0.16;
    }
    for (const water of this.objects.waters)
      (water.material as THREE.ShaderMaterial).uniforms.time.value = t;
    if (!this.reducedMotion && !this.isPaused) {
      for (let i = 0; i < 180; i++) {
        this.particlePositions[i * 3] += dt * 0.32;
        this.particlePositions[i * 3 + 1] -= dt * 0.17;
        if (this.particlePositions[i * 3 + 1] < 0) this.particlePositions[i * 3 + 1] = 20;
        if (this.particlePositions[i * 3] > 50) this.particlePositions[i * 3] = -50;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
    this.composer.render();
    if (now - this.lastUpdate > 140) {
      this.lastUpdate = now;
      this.publishState();
    }
  };
  private publishState() {
    const place = nearestPlace(this.position.x, this.position.z);
    this.callbacks.onState({
      x: this.position.x,
      z: this.position.z,
      yaw: this.yaw,
      paused: this.isPaused,
      place,
      nearby: Math.hypot(this.position.x - place.x, this.position.z - place.z) < 4.3,
    });
  }
  pause(value: boolean) {
    this.isPaused = value;
    this.blur();
    this.publishState();
  }
  setTouchAxis(x: number, y: number) {
    this.touchAxis = { x, y };
  }
  resetView() {
    this.yaw = 0.1;
    this.pitch = 0.38;
    this.distance = 58;
  }
  setNight(value: boolean) {
    this.night = value;
    this.light.intensity = value ? 0.55 : 2.3;
    this.light.color.set(value ? '#9ab8ff' : '#ffd5a6');
    this.renderer.toneMappingExposure = value ? 0.85 : 1.05;
    this.scene.backgroundIntensity = value ? 0.35 : 1;
    if (this.skyMaterial) this.skyMaterial.uniforms.brightness.value = value ? 0.3 : 1;
  }
  isNight() {
    return this.night;
  }
  async takePhoto() {
    this.composer.render();
    const blob = await new Promise<Blob | null>((resolve) =>
      this.renderer.domElement.toBlob(resolve, 'image/png'),
    );
    if (!blob) throw new Error('写真を保存できませんでした。');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yukagecho-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    const c = this.renderer.domElement;
    c.removeEventListener('pointerdown', this.pointerdown);
    c.removeEventListener('pointermove', this.pointermove);
    c.removeEventListener('pointerup', this.pointerup);
    c.removeEventListener('pointercancel', this.pointerup);
    c.removeEventListener('wheel', this.wheel);
    c.removeEventListener('webglcontextlost', this.contextLost);
    const geometries = new Set<THREE.BufferGeometry>(),
      mats = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
        if ('geometry' in obj) geometries.add(obj.geometry);
        for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
          mats.add(mat);
          if ('map' in mat && mat.map instanceof THREE.Texture) textures.add(mat.map);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    if (this.skyMaterial) (this.skyMaterial.uniforms.panorama.value as THREE.Texture).dispose();
    this.composer.passes.forEach((p) => p.dispose());
    this.composer.dispose();
    this.renderer.dispose();
    c.remove();
  }
}
