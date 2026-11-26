import * as THREE from "three";
import { latLngToVector3 } from "./geo";

/**
 * Major global tectonic plate boundary polylines ([lat, lng][]):
 * Ring of Fire trenches, Mid-Atlantic Ridge, Alpine-Himalayan belt,
 * East African Rift, Indian Ocean ridges, Philippine Sea Plate, Nazca/Cocos trenches.
 */
const TECTONIC_BOUNDARY_POLYLINES: Array<Array<[number, number]>> = [
  // Ring of Fire — Western Pacific (Aleutians -> Kamchatka -> Kuril -> Japan -> Mariana -> Philippines)
  [
    [54, -165], [52.5, -173], [51.8, 178], [53.5, 168], [55.5, 162],
    [51, 158], [46, 153], [42, 146], [38, 143.5], [34.5, 141.5],
    [30, 142.5], [24, 144], [18, 147], [13, 146], [9, 140], [5, 134],
  ],
  // Philippine Sea Plate western boundary (Ryukyu -> Taiwan -> Luzon -> Mindanao -> Halmahera)
  [
    [34.5, 141.5], [32, 134], [28, 130], [24.5, 125], [23.5, 121.8],
    [19, 120.5], [14.5, 119.5], [10, 126.5], [5, 127], [1, 126],
  ],
  // Sunda / Java Trench & Banda Arc -> New Guinea -> Tonga-Kermadec -> New Zealand
  [
    [22, 93], [16, 94], [10, 92.5], [4, 94.5], [-1, 98], [-6, 103.5],
    [-9.5, 110], [-10.5, 118], [-9.5, 126], [-6.5, 133], [-4.5, 142],
    [-6, 150], [-10.5, 160], [-16, 167], [-21, 170], [-20, -175],
    [-28, -176.5], [-36, 179], [-42, 173], [-47, 166], [-56, 158],
  ],
  // Eastern Pacific — Alaska -> Cascadia -> San Andreas -> Middle America Trench -> Peru-Chile Trench
  [
    [60, -150], [59, -140], [54, -134], [49, -128], [42, -125.5],
    [38, -122.8], [34, -118], [31, -114.5], [24, -109], [19, -105.5],
    [15, -96], [11, -87], [7.5, -82], [2, -80], [-5, -81.5],
    [-14, -77], [-22, -71.5], [-33, -72.5], [-43, -75], [-52, -76], [-56, -68],
  ],
  // East Pacific Rise (divergent mid-ocean ridge)
  [
    [20, -106], [10, -104], [2, -102], [-8, -108], [-18, -113],
    [-28, -112], [-38, -111], [-50, -115], [-57, -140], [-62, -165],
  ],
  // Nazca / Antarctic & Scotia Arc
  [
    [-38, -111], [-40, -95], [-45, -76], [-56, -68], [-58, -50],
    [-56, -32], [-60, -26], [-62, -45], [-60, -64],
  ],
  // Caribbean Plate
  [
    [15, -90], [18, -84], [19.5, -75], [19.5, -65], [15, -60],
    [10.5, -62], [10.5, -72], [9, -81],
  ],
  // Mid-Atlantic Ridge (Arctic -> Iceland -> Azores -> Equatorial -> South Atlantic)
  [
    [80, 2], [73, -8], [65, -18], [58, -32], [48, -28], [39, -30],
    [30, -42], [20, -46], [10, -41], [1, -30], [-2, -14], [-12, -14],
    [-25, -13], [-40, -16], [-54, -4], [-54, 15],
  ],
  // Alpine-Himalayan Collision Belt (Azores -> Gibraltar -> Mediterranean -> Anatolia -> Iran -> Himalayas -> Burma)
  [
    [38, -28], [36, -12], [36, -5], [37.5, 4], [38, 15], [35.5, 24],
    [38.5, 30], [39.5, 41], [35, 48], [28, 56], [26, 66], [34, 72],
    [31, 80], [28, 87], [27.5, 94], [22, 93],
  ],
  // Red Sea & East African Rift
  [
    [30, 34], [22, 38], [13, 43], [11, 48], [12, 58],
  ],
  [
    [13, 43], [8, 39], [1, 36], [-8, 35], [-18, 35],
  ],
  // Central & Southeast Indian Ridges
  [
    [12, 58], [4, 63], [-10, 67], [-25, 70], [-36, 52], [-48, 35], [-54, 15],
  ],
  [
    [-25, 70], [-35, 80], [-44, 100], [-50, 125], [-55, 148], [-56, 158],
  ],
];

/**
 * Generates subdivided spherical 3D LineSegments for global tectonic plate boundaries.
 */
export function buildTectonicPlateGeometry(radius = 1.0022): THREE.BufferGeometry {
  const positions: number[] = [];

  for (const line of TECTONIC_BOUNDARY_POLYLINES) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lat1, lng1] = line[i];
      const [lat2, lng2] = line[i + 1];

      // Handle antimeridian cleanly
      let dLng = lng2 - lng1;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      const dLat = lat2 - lat1;
      const steps = Math.max(2, Math.ceil(Math.hypot(dLat, dLng) / 2.5));

      for (let s = 0; s < steps; s++) {
        const t1 = s / steps;
        const t2 = (s + 1) / steps;
        const aLat = lat1 + dLat * t1;
        const aLng = lng1 + dLng * t1;
        const bLat = lat1 + dLat * t2;
        const bLng = lng1 + dLng * t2;
        const [x1, y1, z1] = latLngToVector3(aLat, aLng, radius);
        const [x2, y2, z2] = latLngToVector3(bLat, bLng, radius);
        positions.push(x1, y1, z1, x2, y2, z2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}
