export interface GeoAnchor {
  id: string;
  name: string;
  nameKo: string;
  lat: number;
  lng: number;
  region?: string;
}

/**
 * 72 globally distributed land synoptic weather anchors.
 * Queried in a SINGLE batched Open-Meteo Forecast call (NOAA GFS / ECMWF / ICON blended).
 */
export const GLOBAL_WEATHER_ANCHORS: GeoAnchor[] = [
  // East & Southeast Asia
  { id: "seoul", name: "Seoul", nameKo: "서울", lat: 37.57, lng: 126.98, region: "동아시아" },
  { id: "busan", name: "Busan", nameKo: "부산", lat: 35.18, lng: 129.08, region: "동아시아" },
  { id: "jeju", name: "Jeju", nameKo: "제주", lat: 33.5, lng: 126.53, region: "동아시아" },
  { id: "tokyo", name: "Tokyo", nameKo: "도쿄", lat: 35.68, lng: 139.65, region: "동아시아" },
  { id: "sapporo", name: "Sapporo", nameKo: "삿포로", lat: 43.06, lng: 141.35, region: "동아시아" },
  { id: "beijing", name: "Beijing", nameKo: "베이징", lat: 39.9, lng: 116.4, region: "동아시아" },
  { id: "shanghai", name: "Shanghai", nameKo: "상하이", lat: 31.23, lng: 121.47, region: "동아시아" },
  { id: "taipei", name: "Taipei", nameKo: "타이베이", lat: 25.03, lng: 121.57, region: "동아시아" },
  { id: "hongkong", name: "Hong Kong", nameKo: "홍콩", lat: 22.32, lng: 114.17, region: "동아시아" },
  { id: "manila", name: "Manila", nameKo: "마닐라", lat: 14.6, lng: 120.98, region: "동남아시아" },
  { id: "bangkok", name: "Bangkok", nameKo: "방콕", lat: 13.76, lng: 100.5, region: "동남아시아" },
  { id: "singapore", name: "Singapore", nameKo: "싱가포르", lat: 1.35, lng: 103.82, region: "동남아시아" },
  { id: "jakarta", name: "Jakarta", nameKo: "자카르타", lat: -6.21, lng: 106.85, region: "동남아시아" },
  { id: "hanoi", name: "Hanoi", nameKo: "하노이", lat: 21.03, lng: 105.85, region: "동남아시아" },
  { id: "ulaanbaatar", name: "Ulaanbaatar", nameKo: "울란바토르", lat: 47.89, lng: 106.91, region: "동아시아" },
  // South & Central Asia + Middle East
  { id: "delhi", name: "New Delhi", nameKo: "뉴델리", lat: 28.61, lng: 77.21, region: "남아시아" },
  { id: "mumbai", name: "Mumbai", nameKo: "뭄바이", lat: 19.08, lng: 72.88, region: "남아시아" },
  { id: "dhaka", name: "Dhaka", nameKo: "다카", lat: 23.81, lng: 90.41, region: "남아시아" },
  { id: "almaty", name: "Almaty", nameKo: "알마티", lat: 43.24, lng: 76.89, region: "중앙아시아" },
  { id: "dubai", name: "Dubai", nameKo: "두바이", lat: 25.2, lng: 55.27, region: "중동" },
  { id: "riyadh", name: "Riyadh", nameKo: "리야드", lat: 24.71, lng: 46.68, region: "중동" },
  { id: "istanbul", name: "Istanbul", nameKo: "이스탄불", lat: 41.01, lng: 28.98, region: "유럽·중동" },
  // Oceania
  { id: "sydney", name: "Sydney", nameKo: "시드니", lat: -33.87, lng: 151.21, region: "오세아니아" },
  { id: "melbourne", name: "Melbourne", nameKo: "멜버른", lat: -37.81, lng: 144.96, region: "오세아니아" },
  { id: "perth", name: "Perth", nameKo: "퍼스", lat: -31.95, lng: 115.86, region: "오세아니아" },
  { id: "darwin", name: "Darwin", nameKo: "다윈", lat: -12.46, lng: 130.84, region: "오세아니아" },
  { id: "auckland", name: "Auckland", nameKo: "오클랜드", lat: -36.85, lng: 174.76, region: "오세아니아" },
  { id: "suva", name: "Suva", nameKo: "수바 (피지)", lat: -18.14, lng: 178.44, region: "오세아니아" },
  // Europe
  { id: "london", name: "London", nameKo: "런던", lat: 51.51, lng: -0.13, region: "유럽" },
  { id: "paris", name: "Paris", nameKo: "파리", lat: 48.86, lng: 2.35, region: "유럽" },
  { id: "berlin", name: "Berlin", nameKo: "베를린", lat: 52.52, lng: 13.41, region: "유럽" },
  { id: "madrid", name: "Madrid", nameKo: "마드리드", lat: 40.42, lng: -3.7, region: "유럽" },
  { id: "rome", name: "Rome", nameKo: "로마", lat: 41.9, lng: 12.5, region: "유럽" },
  { id: "zurich", name: "Zurich", nameKo: "취리히", lat: 47.37, lng: 8.54, region: "유럽" },
  { id: "warsaw", name: "Warsaw", nameKo: "바르샤바", lat: 52.23, lng: 21.01, region: "유럽" },
  { id: "stockholm", name: "Stockholm", nameKo: "스톡홀름", lat: 59.33, lng: 18.07, region: "유럽" },
  { id: "reykjavik", name: "Reykjavik", nameKo: "레이캬비크", lat: 64.15, lng: -21.94, region: "북유럽" },
  { id: "athens", name: "Athens", nameKo: "아테네", lat: 37.98, lng: 23.73, region: "유럽" },
  { id: "moscow", name: "Moscow", nameKo: "모스크바", lat: 55.76, lng: 37.62, region: "유럽" },
  { id: "novosibirsk", name: "Novosibirsk", nameKo: "노보시비르스크", lat: 55.01, lng: 82.93, region: "시베리아" },
  { id: "yakutsk", name: "Yakutsk", nameKo: "야쿠츠크", lat: 62.03, lng: 129.73, region: "시베리아" },
  // Africa
  { id: "cairo", name: "Cairo", nameKo: "카이로", lat: 30.04, lng: 31.24, region: "아프리카" },
  { id: "casablanca", name: "Casablanca", nameKo: "카사블랑카", lat: 33.57, lng: -7.59, region: "아프리카" },
  { id: "lagos", name: "Lagos", nameKo: "라고스", lat: 6.52, lng: 3.38, region: "아프리카" },
  { id: "nairobi", name: "Nairobi", nameKo: "나이로비", lat: -1.29, lng: 36.82, region: "아프리카" },
  { id: "addisababa", name: "Addis Ababa", nameKo: "아디스아바바", lat: 9.03, lng: 38.74, region: "아프리카" },
  { id: "kinshasa", name: "Kinshasa", nameKo: "킨샤사", lat: -4.44, lng: 15.27, region: "아프리카" },
  { id: "capetown", name: "Cape Town", nameKo: "케이프타운", lat: -33.92, lng: 18.42, region: "아프리카" },
  { id: "antananarivo", name: "Antananarivo", nameKo: "안타나나리보", lat: -18.88, lng: 47.51, region: "아프리카" },
  // North America
  { id: "sanfrancisco", name: "San Francisco", nameKo: "샌프란시스코", lat: 37.77, lng: -122.42, region: "북아메리카" },
  { id: "losangeles", name: "Los Angeles", nameKo: "로스앤젤레스", lat: 34.05, lng: -118.24, region: "북아메리카" },
  { id: "seattle", name: "Seattle", nameKo: "시애틀", lat: 47.61, lng: -122.33, region: "북아메리카" },
  { id: "anchorage", name: "Anchorage", nameKo: "앵커리지", lat: 61.22, lng: -149.9, region: "북아메리카" },
  { id: "honolulu", name: "Honolulu", nameKo: "호놀룰루", lat: 21.31, lng: -157.86, region: "태평양" },
  { id: "denver", name: "Denver", nameKo: "덴버", lat: 39.74, lng: -104.99, region: "북아메리카" },
  { id: "chicago", name: "Chicago", nameKo: "시카고", lat: 41.88, lng: -87.63, region: "북아메리카" },
  { id: "newyork", name: "New York", nameKo: "뉴욕", lat: 40.71, lng: -74.01, region: "북아메리카" },
  { id: "miami", name: "Miami", nameKo: "마이애미", lat: 25.76, lng: -80.19, region: "북아메리카" },
  { id: "toronto", name: "Toronto", nameKo: "토론토", lat: 43.65, lng: -79.38, region: "북아메리카" },
  { id: "mexicocity", name: "Mexico City", nameKo: "멕시코시티", lat: 19.43, lng: -99.13, region: "북아메리카" },
  { id: "nuuk", name: "Nuuk", nameKo: "누크 (그린란드)", lat: 64.18, lng: -51.72, region: "북극권" },
  // South America
  { id: "bogota", name: "Bogota", nameKo: "보고타", lat: 4.71, lng: -74.07, region: "남아메리카" },
  { id: "lima", name: "Lima", nameKo: "리마", lat: -12.05, lng: -77.04, region: "남아메리카" },
  { id: "santiago", name: "Santiago", nameKo: "산티아고", lat: -33.45, lng: -70.67, region: "남아메리카" },
  { id: "saopaulo", name: "Sao Paulo", nameKo: "상파울루", lat: -23.55, lng: -46.63, region: "남아메리카" },
  { id: "manaus", name: "Manaus", nameKo: "마나우스 (아마존)", lat: -3.12, lng: -60.02, region: "남아메리카" },
  { id: "buenosaires", name: "Buenos Aires", nameKo: "부에노스아이레스", lat: -34.6, lng: -58.38, region: "남아메리카" },
  { id: "ushuaia", name: "Ushuaia", nameKo: "우수아이아", lat: -54.8, lng: -68.3, region: "남아메리카" },
  // Polar & Remote
  { id: "svalbard", name: "Svalbard", nameKo: "스발바르", lat: 78.22, lng: 15.63, region: "북극권" },
  { id: "mcmurdo", name: "McMurdo", nameKo: "맥머도 (남극)", lat: -77.85, lng: 166.67, region: "남극" },
];

/**
 * 48 major global ocean & sea basin coordinates for NOAA/ECMWF marine wave + current model.
 * Queried in a SINGLE batched Open-Meteo Marine API request!
 */
export const GLOBAL_OCEAN_ANCHORS: GeoAnchor[] = [
  // East Asia Seas
  { id: "east-sea", name: "East Sea", nameKo: "동해 중앙", lat: 38.5, lng: 132.0 },
  { id: "yellow-sea", name: "Yellow Sea", nameKo: "서해 (황해)", lat: 35.5, lng: 124.0 },
  { id: "korea-strait", name: "Korea Strait", nameKo: "대한해협 · 제주 남방", lat: 32.5, lng: 127.5 },
  { id: "east-china-sea", name: "East China Sea", nameKo: "동중국해", lat: 28.0, lng: 125.5 },
  { id: "south-china-sea", name: "South China Sea", nameKo: "남중국해", lat: 15.0, lng: 114.0 },
  { id: "philippine-sea", name: "Philippine Sea", nameKo: "필리핀해 (태풍 길목)", lat: 19.0, lng: 133.0 },
  { id: "kuroshio", name: "Kuroshio Current", nameKo: "쿠로시오 해류", lat: 33.0, lng: 142.0 },
  { id: "okhotsk", name: "Sea of Okhotsk", nameKo: "오호츠크해", lat: 52.0, lng: 148.0 },
  // Pacific Ocean
  { id: "nw-pacific", name: "NW Pacific", nameKo: "북서 태평양", lat: 42.0, lng: 162.0 },
  { id: "bering-sea", name: "Bering Sea", nameKo: "베링해", lat: 56.0, lng: -175.0 },
  { id: "gulf-alaska", name: "Gulf of Alaska", nameKo: "알래스카만", lat: 55.0, lng: -145.0 },
  { id: "ne-pacific", name: "NE Pacific", nameKo: "북동 태평양", lat: 40.0, lng: -135.0 },
  { id: "mid-pacific-n", name: "North Central Pacific", nameKo: "북태평양 중앙", lat: 32.0, lng: -165.0 },
  { id: "hawaii-swell", name: "Hawaiian Basin", nameKo: "하와이 해역", lat: 20.5, lng: -154.0 },
  { id: "eq-pacific-w", name: "West Equatorial Pacific", nameKo: "서부 적도 태평양", lat: 2.0, lng: 155.0 },
  { id: "eq-pacific-c", name: "Central Equatorial Pacific", nameKo: "중앙 적도 태평양 (엘니뇨 해역)", lat: 0.0, lng: -140.0 },
  { id: "eq-pacific-e", name: "East Equatorial Pacific", nameKo: "동부 적도 태평양", lat: -2.0, lng: -102.0 },
  { id: "coral-sea", name: "Coral Sea", nameKo: "산호해", lat: -17.0, lng: 156.0 },
  { id: "tasman-sea", name: "Tasman Sea", nameKo: "태즈먼해", lat: -38.0, lng: 162.0 },
  { id: "south-pacific-c", name: "Central South Pacific", nameKo: "남태평양 중앙", lat: -32.0, lng: -135.0 },
  { id: "humboldt", name: "Humboldt Current", nameKo: "훔볼트 해류", lat: -22.0, lng: -78.0 },
  { id: "drake-passage", name: "Drake Passage", nameKo: "드레이크 해협", lat: -58.5, lng: -64.0 },
  // Atlantic Ocean
  { id: "north-atlantic-n", name: "Icelandic Basin", nameKo: "북대서양 (아이슬란드 남방)", lat: 58.0, lng: -26.0 },
  { id: "north-sea", name: "North Sea", nameKo: "북해", lat: 56.0, lng: 3.5 },
  { id: "bay-biscay", name: "Bay of Biscay", nameKo: "비스케이만", lat: 45.5, lng: -6.0 },
  { id: "gulf-stream", name: "Gulf Stream", nameKo: "멕시코 만류", lat: 37.5, lng: -67.0 },
  { id: "sargasso-sea", name: "Sargasso Sea", nameKo: "사르가소해", lat: 28.0, lng: -62.0 },
  { id: "gulf-mexico", name: "Gulf of Mexico", nameKo: "멕시코만", lat: 25.0, lng: -90.0 },
  { id: "caribbean", name: "Caribbean Sea", nameKo: "카리브해", lat: 15.5, lng: -74.0 },
  { id: "azores-basin", name: "Azores Basin", nameKo: "아조레스 해역", lat: 36.0, lng: -32.0 },
  { id: "tropical-atlantic", name: "Tropical Atlantic", nameKo: "열대 대서양", lat: 11.0, lng: -40.0 },
  { id: "gulf-guinea", name: "Gulf of Guinea", nameKo: "기니만", lat: 1.5, lng: 1.0 },
  { id: "south-atlantic-w", name: "Brazil Current", nameKo: "브라질 해류", lat: -26.0, lng: -36.0 },
  { id: "south-atlantic-e", name: "Benguela Current", nameKo: "벵겔라 해류", lat: -24.0, lng: 8.0 },
  { id: "roaring-40s-atl", name: "Southern Atlantic", nameKo: "남대서양 편서풍대", lat: -48.0, lng: -18.0 },
  // Mediterranean & Indian Ocean
  { id: "mediterranean-w", name: "Western Mediterranean", nameKo: "서지중해", lat: 39.5, lng: 5.0 },
  { id: "mediterranean-e", name: "Eastern Mediterranean", nameKo: "동지중해", lat: 34.5, lng: 25.0 },
  { id: "arabian-sea", name: "Arabian Sea", nameKo: "아라비아해", lat: 15.0, lng: 64.0 },
  { id: "bay-bengal", name: "Bay of Bengal", nameKo: "벵골만", lat: 14.0, lng: 88.0 },
  { id: "somali-basin", name: "Somali Basin", nameKo: "소말리아 해역", lat: 5.0, lng: 55.0 },
  { id: "indian-central", name: "Central Indian Ocean", nameKo: "인도양 중앙", lat: -15.0, lng: 80.0 },
  { id: "java-trench", name: "Eastern Indian Ocean", nameKo: "자바 해구 해역", lat: -12.0, lng: 108.0 },
  { id: "agulhas", name: "Agulhas Current", nameKo: "아굴라스 해류", lat: -36.5, lng: 22.0 },
  { id: "southern-indian", name: "Southern Indian Ocean", nameKo: "남인도양 폭풍대", lat: -48.0, lng: 68.0 },
  { id: "great-australian", name: "Great Australian Bight", nameKo: "그레이트오스트레일리아만", lat: -38.0, lng: 132.0 },
  { id: "norwegian-sea", name: "Norwegian Sea", nameKo: "노르웨이해", lat: 67.0, lng: 4.0 },
  { id: "barents-sea", name: "Barents Sea", nameKo: "바렌츠해", lat: 73.0, lng: 34.0 },
  { id: "southern-pacific", name: "Southern Pacific", nameKo: "남태평양 남극해역", lat: -52.0, lng: -165.0 },
];

export const QUICK_JUMP_PRESETS: Array<{
  id: string;
  label: string;
  lat: number;
  lng: number;
  altitude?: number;
}> = [
  { id: "kr", label: "한반도", lat: 36.5, lng: 127.8, altitude: 2.25 },
  { id: "ring", label: "환태평양 지진대", lat: 34.0, lng: 141.0, altitude: 2.55 },
  { id: "eu", label: "유럽 센서망", lat: 49.5, lng: 10.5, altitude: 2.3 },
  { id: "us", label: "북미 서부", lat: 37.8, lng: -120.5, altitude: 2.45 },
  { id: "ocean", label: "북대서양 해류", lat: 44.0, lng: -34.0, altitude: 2.7 },
];
