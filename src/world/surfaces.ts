import type { MeshStandardMaterial } from 'three';

type Surface = 'wood' | 'stone' | 'roof' | 'earth';

/** World-space grain stays consistent across the material-batched architecture. */
export function weatherSurface(material: MeshStandardMaterial, surface: Surface) {
  material.customProgramCacheKey = () => `yukagecho-weather-${surface}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWeatherPosition;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWeatherPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWeatherPosition;
        float weatherHash(vec3 p) {
          p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float weatherNoise(vec3 p) {
          vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(weatherHash(i),weatherHash(i+vec3(1,0,0)),f.x),
                         mix(weatherHash(i+vec3(0,1,0)),weatherHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(weatherHash(i+vec3(0,0,1)),weatherHash(i+vec3(1,0,1)),f.x),
                         mix(weatherHash(i+vec3(0,1,1)),weatherHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 wp = vWeatherPosition;
        float grain = weatherNoise(wp * ${surface === 'wood' ? 'vec3(26., .7, 26.)' : 'vec3(7.)'});
        float age = weatherNoise(wp * 1.7);
        ${
          surface === 'wood'
            ? `
          float streak=weatherNoise(wp*vec3(75.,2.,75.));
          diffuseColor.rgb *= .63 + grain*.35 + streak*.12;
        `
            : surface === 'earth'
              ? `
          diffuseColor.rgb *= .64 + age*.4 + grain*.16;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.16,.14,.105), smoothstep(.5,.78,age)*.5);
        `
              : `
          diffuseColor.rgb *= .72 + grain*.19 + age*.22;
        `
        }`,
      );
  };
  material.needsUpdate = true;
}
