// Ícones de linha (vazados) que substituem os emojis coloridos em todo o app.
const P = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M5.6 9.6l1.4 1.4M18.4 9.6 17 11M3 14h1.5M19.5 14H21"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cross: '<path d="M12 3v18M7 8.5h10"/>',
  dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8.2 8 20 18M8.2 16 20 6"/>',
  bottle: '<path d="M9.5 3h5M10.5 3v3.5L8 9.5V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9.5l-2.5-3V3M8 13h8"/>',
  books: '<path d="M4 4h4v16H4zM8 4h4v16H8zM13 5.5l3.8-1 3.7 14.2-3.8 1z"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
  book: '<path d="M3 5.5C5.5 4 8.5 4 12 6c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5zM12 6v13.5"/>',
  broom: '<path d="M15 3l-3.5 8M6.5 11h9l2 9H4.5zM9 15v5M12.5 15v5"/>',
  basket: '<path d="M3.5 10h17l-1.6 9.2a1 1 0 0 1-1 .8H6.1a1 1 0 0 1-1-.8zM8 10l3-6M16 10l-3-6M9 13.5v3M12 13.5v3M15 13.5v3"/>',
  pot: '<path d="M4 10h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2 10h2M20 10h2M9 7c0-1.2 1-1.3 1-2.5M13.5 7c0-1.2 1-1.3 1-2.5"/>',
  sparkles: '<path d="M11 3.5l1.7 4.8L17.5 10l-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  drop: '<path d="M12 3.2s6 6.4 6 10.8a6 6 0 0 1-12 0c0-4.4 6-10.8 6-10.8z"/>',
  leaf: '<path d="M5 19c0-8 5-13.5 14-14 0 9-5 14-13 14zM5 19l8.5-8.5"/>',
  cart: '<path d="M3 4h2.2l2.3 11h10.2l2-7.5H6.5"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  pill: '<path d="M10.6 3.6a5 5 0 0 1 7.1 7.1l-7 7a5 5 0 0 1-7.1-7.1zM7.1 7.1l7.1 7.1"/>',
  lotus: '<path d="M12 19.5c-3.8 0-7.5-1.8-9-5.5 3.2 0 6.4 1.3 9 4 2.6-2.7 5.8-4 9-4-1.5 3.7-5.2 5.5-9 5.5zM12 18c-2.2-3.4-2.2-7.3 0-11 2.2 3.7 2.2 7.6 0 11z"/>',
  walk: '<circle cx="13" cy="4.5" r="1.6"/><path d="M10 21l2.2-6.3L10.5 12l1-4 3.2 3.2H18M8 11.5 10.8 8M12.2 14.7 15.5 21"/>',
  phone: '<path d="M5 4h3.8l1.7 4.6-2.3 1.5a11 11 0 0 0 5.7 5.7l1.5-2.3 4.6 1.7V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.4c-.4-.9-1.4-1.4-2.6-1.4-1.4 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.2 2-2.6 2c-1.2 0-2.2-.5-2.6-1.4M12 6.5V8M12 16v1.5"/>',
  bed: '<path d="M3 18.5V6.5M3 14h18v4.5M21 14v-2.5a3 3 0 0 0-3-3h-7V14"/><circle cx="7" cy="11" r="1.6"/>',
  paw: '<circle cx="7" cy="9" r="1.7"/><circle cx="10.5" cy="5.8" r="1.7"/><circle cx="14.5" cy="5.8" r="1.7"/><circle cx="18" cy="9" r="1.7"/><path d="M12.5 11c2.5 0 5 3.3 5 6a2.5 2.5 0 0 1-3 2.4c-1.3-.3-2.7-.3-4 0a2.5 2.5 0 0 1-3-2.4c0-2.7 2.5-6 5-6z"/>',
  sprout: '<path d="M12 21v-8.5M12 12.5C12 8.5 9 6.5 5 6.5c0 4 3 6 7 6zM12 10.5c0-4 3-6 7-6 0 4-3 6-7 6z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  note: '<path d="M5.5 3.5h9l4 4v13h-13zM14.5 3.5v4h4M8.5 12h7M8.5 16h5"/>',
  checkc: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16 9.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4 3.5-6 3.5-10.3 2.6 1.5 4 4 4 6.3 1-.9 1.5-2 1.5-3.3 2 1.9 4 4.6 4 7.3 0 3.6-2.6 6.2-6.5 6.2z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  chart: '<path d="M4 20h16M6 16l4-5 3 3 5-7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5"/>',
  warning: '<path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.3"/>',
  egg: '<path d="M12 3c3.6 0 6.2 6 6.2 10.2a6.2 6.2 0 0 1-12.4 0C5.8 9 8.4 3 12 3z"/>',
  flower: '<circle cx="12" cy="12" r="2.3"/><path d="M12 9.7C10 7.5 10.3 4 12 3.5c1.7.5 2 4 0 6.2zM14.2 11.3c1.3-2.7 4.7-3.6 5.8-2.2.2 1.8-2.9 3.6-5.8 2.2zM13.4 14c2.9.5 4.4 3.6 3.4 5.1-1.7.6-4.3-1.8-3.4-5.1zM10.6 14c.9 3.3-1.7 5.7-3.4 5.1-1-1.5.5-4.6 3.4-5.1zM9.8 11.3C6.9 12.7 3.8 10.9 4 9.1c1.1-1.4 4.5-.5 5.8 2.2z"/>',
  dna: '<path d="M7 3c0 7 10 7 10 18M17 3c0 7-10 7-10 18M8.6 6.5h6.8M8.6 17.5h6.8M10 12h4"/>',
  shower: '<path d="M4 21V8a4 4 0 0 1 8 0M8.5 8h7M10 12v.5M13 12v.5M16 12v.5M11.5 15v.5M14.5 15v.5M13 18v.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20.5h7M10 16.5h4v4h-4z"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  bag: '<path d="M5 8h14l-1 12.5H6zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
  sliders: '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M9 5.5v13M15 5.5v13"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10M10 2.5h4M18.5 6l1-1"/>',
  page: '<path d="M6 3.5h8.5l3.5 3.5v13.5H6zM14.5 3.5V7H18"/>',
  pin: '<path d="M12 16.5V21M8.5 3.5h7l-1 5.5 3 3V14h-11v-2l3-3z"/>',
  refresh: '<path d="M19.5 11a7.5 7.5 0 0 0-13.4-4.4L4 8.7M4 4v4.7h4.7M4.5 13a7.5 7.5 0 0 0 13.4 4.4L20 15.3M20 20v-4.7h-4.7"/>',
  pencil: '<path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c1.8 2.2 5.2 2.2 7 0M9 9.5v.5M15 9.5v.5"/>',
  sad: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 16c1.8-2 5.2-2 7 0M9 9.5v.5M15 9.5v.5"/>',
  meh: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 15h7M9 9.5v.5M15 9.5v.5"/>',
  cloud: '<path d="M7 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.2 9a4.75 4.75 0 0 1 .3 9.5z"/>',
  rocket: '<path d="M12 3c3 2.2 4.5 5.5 4 10l-2 3h-4l-2-3c-.5-4.5 1-7.8 4-10zM8 13l-3 2 1 4 3-2M16 13l3 2-1 4-3-2M12 9.5v.5"/>',
  glass: '<path d="M6 3.5h12l-1.6 16a1 1 0 0 1-1 .9H8.6a1 1 0 0 1-1-.9zM6.6 9h10.8"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  tabs: '<rect x="3.5" y="14.5" width="17" height="6" rx="2"/><path d="M7 17.5h.5M12 17.5h.5M17 17.5h.5M5 4h14M5 8h14M5 11.5h9"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.5-1.8-.4-1.2.3-2.2 1.6-2.2h1.8a3.6 3.6 0 0 0 3.6-3.6C20.5 7.3 16.7 3.5 12 3.5z"/><circle cx="8" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8" r="1"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  dropper: '<path d="M14.5 3.5l6 6M13 5l6 6M16.5 8 8 16.5l-3.5 1 1-3.5L14 5.5"/><path d="M5.5 18.5 4 20"/>',
  jar: '<rect x="5" y="5.5" width="14" height="3.5" rx="1"/><path d="M6 9h12v9.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM9.5 14h5"/>',
  tube: '<path d="M8.5 3h7l-.8 3H9.3zM9 6h6l1.6 13.2a1.6 1.6 0 0 1-1.6 1.8H9a1.6 1.6 0 0 1-1.6-1.8zM10 11h4"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><circle cx="12" cy="11.5" r="2.3"/><path d="M12 6.8v1.2M12 15v1.2M7.3 11.5h1.2M15.5 11.5h1.2"/>',
  soap: '<rect x="3.5" y="10" width="17" height="9.5" rx="3.2"/><circle cx="9" cy="6" r="2"/><circle cx="14.5" cy="4.2" r="1.3"/><path d="M8 14.8h8"/>',
  bubbles: '<circle cx="9" cy="14" r="5.2"/><circle cx="17" cy="7.5" r="3"/><circle cx="18" cy="16.8" r="1.8"/><path d="M6.5 12.5a3 3 0 0 1 2.2-1.8"/>',
  mirror: '<ellipse cx="12" cy="9.5" rx="6" ry="6.5"/><path d="M12 16v4.5M9 21h6M9.5 8l2.2-2.2M10.5 10.8l3.5-3.5"/>',
  face: '<path d="M12 3c-4 0-6.5 3-6.5 7.5 0 5 3 10.5 6.5 10.5s6.5-5.5 6.5-10.5C18.5 6 16 3 12 3z"/><path d="M9.5 10.5v.3M14.5 10.5v.3M10 15c1.2.9 2.8.9 4 0"/>',
  facemask: '<path d="M12 3c-4 0-6.5 3-6.5 7.5 0 5 3 10.5 6.5 10.5s6.5-5.5 6.5-10.5C18.5 6 16 3 12 3z"/><path d="M8.3 9.5a1.6 1 0 0 0 3 0M12.7 9.5a1.6 1 0 0 0 3 0M10.2 15.5h3.6M7 13h.01M17 13h.01M9 6.5h.01M15 6.5h.01"/>',
  towel: '<path d="M5 5.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 5.5a3 3 0 0 0-3 3V17M8 20V8.5a3 3 0 0 0-3-3M11 12h5M11 15.5h5"/>',
  lips: '<path d="M3 11.5c2-3 4.5-4.5 6.5-3.5.9.4 1.6.4 2.5 0 .9.4 1.6.4 2.5 0 2-1 4.5.5 6.5 3.5-2.5 4-5.5 6-9 6s-6.5-2-9-6z"/><path d="M3 11.5c3 .8 6 1.1 9 1.1s6-.3 9-1.1"/>',
  hand: '<path d="M8 20.5c-2.4-1-4-3.4-4-6V9a1.5 1.5 0 0 1 3 0v3M7 11.5V5.5a1.5 1.5 0 0 1 3 0v5.5M10 10.5V4.5a1.5 1.5 0 0 1 3 0v6M13 11V6a1.5 1.5 0 0 1 3 0v8c0 3.2-2.2 5.8-5.3 6.5"/>',
  nail: '<rect x="6.5" y="11" width="11" height="10" rx="2.2"/><path d="M9.5 11V8h5v3M11 8V3h2v5"/>',
  branch: '<path d="M6 21c4-4 6.5-9 7-17M13 4c3 1.2 4.8 4 4 7-2.2-.2-4-1.4-4-3.5M10.3 11C7.5 11 5.5 9 5.3 6c2.9 0 5 2 5 5zM11.5 16c3 0 5.5-1.6 6.5-4.6-3 0-5.5 1.6-6.5 4.6z"/>',
  razor: '<rect x="5" y="3.5" width="14" height="4.5" rx="1.2"/><path d="M12 8v13M9.5 11.5h5"/>',
  brush: '<path d="M14 3.5l6.5 6.5-4.5 3-5-5zM11.3 8.3l4.4 4.4-6 6a3.1 3.1 0 0 1-4.4-4.4z"/>',
  comb: '<rect x="3.5" y="7" width="17" height="4.5" rx="1.2"/><path d="M6 11.5v6M9 11.5v6M12 11.5v6M15 11.5v6M18 11.5v6"/>',
  toothbrush: '<path d="M4 20 15 9M15 9l3.5-3.5 2 2L17 11zM14.5 5.5v2.2M17.5 3v2M12.5 7.5l1.2 1.2"/>',
  bath: '<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zM6 12V6.5a2.3 2.3 0 0 1 4.3-1.1M7.5 19l-1 2M16.5 19l1 2"/>',
  rose: '<path d="M12 12.5c-3 0-5-2-5-4.8 1.6.6 2.7 0 3.6-1.6 1 1.6 2 2 3 1.6s1.6-1.6 2-2.6c1.1 1 1.4 2.1 1.4 3 0 2.7-2 4.4-5 4.4z"/><path d="M12 12.5V21M12 16.5c-2 0-3.6-1-4.2-3.2M12 18.5c2 0 3.6-1 4.2-3.2"/>',
  ice: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  cucumber: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2"/><path d="M12 9.6v.2M14.2 13.2v.2M9.8 13.2v.2"/>',
  cotton: '<circle cx="12" cy="12" r="8"/><path d="M8 10.5c1-.8 2-.8 3 0s2 .8 3 0 2-.8 2.5-.3M8 14c1-.8 2-.8 3 0s2 .8 3 0 2-.8 2.5-.3"/>',
  roller: '<path d="M5 8.5h10M7 5.5h6a2 2 0 0 1 0 6H7a2 2 0 0 1 0-6zM10 11.5v3.5l6 6"/>',
  perfume: '<rect x="5.5" y="9" width="13" height="12" rx="3"/><path d="M10 9V6.5h4V9M12 6.5V4M14 4h3M9 15h6"/>',
  eyedrop: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/><path d="M19.5 3.5s1.8 2 1.8 3.2a1.8 1.8 0 0 1-3.6 0c0-1.2 1.8-3.2 1.8-3.2z"/>',
  sponge: '<rect x="3.5" y="7" width="17" height="11" rx="3"/><path d="M3.5 11.5h17"/><circle cx="8" cy="14.8" r=".9"/><circle cx="12.5" cy="15.2" r=".9"/><circle cx="16.5" cy="14.5" r=".9"/><path d="M15 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

const EMOJI = {
  '🩸': 'drop', '🌱': 'sprout', '🥚': 'egg', '🌸': 'flower', '🌙': 'moon', '😊': 'smile', '😌': 'smile', '🥺': 'heart', '😤': 'flame',
  '😰': 'warning', '😢': 'sad', '⚡': 'bolt', '💧': 'drop', '🥥': 'leaf', '🧬': 'dna', '✅': 'checkc', '☀️': 'sun', '☀': 'sun', '🙏': 'cross',
  '🏋️‍♀️': 'dumbbell', '🧴': 'bottle', '💇‍♀️': 'scissors', '📚': 'books', '💻': 'laptop', '📖': 'book', '🧹': 'broom', '🧺': 'basket',
  '🍲': 'pot', '🧽': 'sponge', '🥗': 'leaf', '🛒': 'cart', '💊': 'pill', '🧘‍♀️': 'lotus', '🚶‍♀️': 'walk', '📞': 'phone', '💰': 'coin',
  '🛏️': 'bed', '🐶': 'paw', '✨': 'sparkles', '❤️': 'heart', '🎯': 'target', '📝': 'note', '😴': 'moon', '🏁': 'flag', '💪': 'flame',
  '🚿': 'shower', '⚠️': 'warning', '⭐': 'star', '🛍️': 'bag', '🎉': 'sparkles', '🏆': 'trophy', '🔥': 'flame', '📈': 'chart', '😉': 'smile',
  '🚀': 'rocket', '🔄': 'refresh', '✏️': 'pencil', '🗓️': 'calendar', '⚙️': 'gear', '📲': 'mobile', '⬇︎': 'download', '⬆︎': 'upload',
  '⬇': 'download', '⬆': 'upload', '⏸': 'pause', '⏹': 'stop', '▶︎': 'play', '▶': 'play', '⏱️': 'timer', '📄': 'page', '📕': 'book',
  '📌': 'pin', '🌅': 'sunrise', '🕐': 'clock', '⏳': 'hourglass', '🌤️': 'cloud', '🥤': 'glass', '👤': 'user', '🎨': 'palette',
  '🧩': 'grid', '📱': 'mobile', '🏠': 'home', '💦': 'drop', '🫶': 'heart', '💜': 'heart', '💗': 'heart', '🔔': 'clock', '🧪': 'dropper', '🫙': 'jar', '🪥': 'toothbrush', '🛡️': 'shield', '🧼': 'soap', '🫧': 'bubbles', '🪞': 'mirror',
  '💆‍♀️': 'facemask', '🙂': 'face', '🧖‍♀️': 'towel', '💋': 'lips', '🤲': 'hand', '💅': 'nail', '🌿': 'branch', '🪒': 'razor', '🖌️': 'brush',
  '🪮': 'comb', '🛁': 'bath', '🌹': 'rose', '🧊': 'ice', '🥒': 'cucumber', '☁️': 'cotton', '🎀': 'tube', '🌀': 'roller', '🌸️': 'flower',
  '🍯': 'jar', '🌺': 'perfume', '👀': 'eyedrop', '👁': 'eye', '👁️': 'eye', '📷': 'camera', '📸': 'camera', '⏰': 'clock', 'ℹ️': 'note',
};

const RE = /\p{Extended_Pictographic}(?:️|︎|‍(?:\p{Extended_Pictographic}|[♀♂])️?|[\u{1F3FB}-\u{1F3FF}])*/gu;
const norm = (e) => EMOJI[e] || EMOJI[e.replace(/[️︎]/g, '')] || EMOJI[e + '️'] || 'sparkles';

export const svg = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.sparkles}</svg>`;
export const iconFor = (emoji) => svg(norm(emoji));
export const ICON_NAMES = Object.keys(P);

const SKIP = new Set(['OPTION', 'TEXTAREA', 'SELECT', 'SCRIPT', 'STYLE', 'TITLE']);
const tpl = document.createElement('template');

/** troca os emojis do texto por ícones de linha; em <option> só remove o emoji */
export function iconize(root) {
  if (!root) return;
  root.querySelectorAll('option').forEach((o) => {
    if (RE.test(o.textContent)) o.textContent = o.textContent.replace(RE, '').replace(/\s{2,}/g, ' ').trim();
    RE.lastIndex = 0;
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (SKIP.has(n.parentNode.nodeName)) continue;
    RE.lastIndex = 0;
    if (RE.test(n.nodeValue)) nodes.push(n);
  }
  for (const n of nodes) {
    RE.lastIndex = 0;
    const html = n.nodeValue.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(RE, (e) => iconFor(e));
    tpl.innerHTML = html;
    n.parentNode.replaceChild(tpl.content, n);
  }
}
export const stripEmoji = (s) => String(s).replace(RE, '').replace(/\s{2,}/g, ' ').trim();
