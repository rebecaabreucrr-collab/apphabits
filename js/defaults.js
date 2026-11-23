// Dados iniciais: rotina, treinos, produtos, cronograma capilar, desafio.
import { dateKey, uid } from './utils.js';

export const ALL = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];

export const MASKS = {
  hidratacao: { label: 'Hidratação', icon: '💧', color: 'sky' },
  nutricao: { label: 'Nutrição', icon: '🥥', color: 'amber' },
  reconstrucao: { label: 'Reconstrução', icon: '🧬', color: 'violet' },
};

export const CATEGORIES = {
  skincare: 'Skincare', cabelo: 'Cabelo', corpo: 'Corpo', maquiagem: 'Maquiagem', outro: 'Outro',
};

export const TASK_TYPES = {
  normal: 'Tarefa comum',
  palavra: 'Link / áudio (ex.: Palavra do dia)',
  treino: 'Treino do dia',
  skincare: 'Skincare',
  cabelo: 'Cronograma capilar (só nos dias de lavar)',
  leitura: 'Leitura com cronômetro',
  estudo: 'Estudo com cronômetro',
  ingles: 'Inglês com cronômetro',
};

export const COLORS = ['rose', 'violet', 'amber', 'sky', 'emerald', 'orange', 'pink', 'slate'];

export const SKIN_EMOJIS = ['🧼', '🫧', '💧', '🧪', '🫙', '🎀', '🧴', '🛡️', '☀️', '🌙', '💆‍♀️', '🙂', '👀', '💋', '☁️', '🧊',
  '🌀', '🥒', '🪞', '🧖‍♀️', '🤲', '💅', '🌺', '🌹', '🌸', '🌿', '🪒', '🖌️', '🛁', '✨'];
/** ícones disponíveis, por categoria (o seletor mostra nesta ordem) */
export const EMOJI_GROUPS = {
  'Rotina': ['✅', '☀️', '🌅', '🌙', '⏰', '📋', '🎯', '📝', '✨', '❤️', '🛏️', '🔔', '📅', '🏁'],
  'Saúde e corpo': ['🏋️‍♀️', '🏃‍♀️', '🚴‍♀️', '🏊‍♀️', '🧘‍♀️', '🚶‍♀️', '💧', '🥗', '🍎', '💊', '🦷', '🩺', '💓', '🩹', '💪'],
  'Beleza': SKIN_EMOJIS.filter((e) => !['☀️', '🌙', '✨'].includes(e)).concat(['💇‍♀️', '🪮', '🪥', '👗', '👑', '💎']),
  'Casa': ['🏠', '🧹', '🧽', '🧺', '🍲', '🍽️', '🛒', '💡', '📶', '🔧', '🔑', '🗑️', '📦', '🐶', '🌱', '🌻', '👶'],
  'Finanças': ['💰', '👛', '💳', '🧾', '🐷', '🏦', '💵', '📊', '📈', '📉', '🛍️'],
  'Estudo e trabalho': ['📚', '📖', '💻', '💼', '🎓', '🖊️', '💬', '🌎', '📞', '✉️'],
  'Lazer': ['🎉', '🎁', '🎂', '☕', '🍷', '🎵', '📺', '🎬', '🎮', '✈️', '🚗', '🚌', '⛽', '☂️', '👕'],
  'Fé': ['🙏', '⛪', '🕯️', '📿'],
};
export const EMOJIS = [...new Set(Object.values(EMOJI_GROUPS).flat())];

const ex = (name, sets, reps, load = '', notes = '') => ({ id: uid(), name, sets, reps, load, notes });

export function defaultState() {
  const today = dateKey();
  return {
    version: 1,
    profile: { name: 'Rebeca' },

    routine: [
      { id: 'r-acordar', time: '05:00', title: 'Acordar', icon: '☀️', color: 'amber', days: ALL, type: 'normal' },
      { id: 'r-palavra', time: '05:10', title: 'Palavra do dia – Frei Gilson', icon: '🙏', color: 'violet', days: ALL, type: 'palavra',
        link: 'https://www.youtube.com/results?search_query=frei+gilson+palavra+do+dia' },
      { id: 'r-academia', time: '06:10', title: 'Academia', icon: '🏋️‍♀️', color: 'rose', days: [1, 2, 3, 4, 5, 6], type: 'treino' },
      { id: 'r-cabelo', time: '07:30', title: 'Cronograma capilar', icon: '💇‍♀️', color: 'pink', days: ALL, type: 'cabelo' },
      { id: 'r-skin-am', time: '07:50', title: 'Skincare da manhã', icon: '🧴', color: 'emerald', days: ALL, type: 'skincare', routineKey: 'am' },
      { id: 'r-estudo', time: '08:00', end: '10:00', title: 'Estudar (2h)', icon: '📚', color: 'sky', days: WEEKDAYS, type: 'estudo' },
      { id: 'r-trabalho', time: '10:00', end: '20:00', title: 'Trabalhar', icon: '💻', color: 'slate', days: WEEKDAYS, type: 'normal' },
      { id: 'r-leitura', time: '13:00', title: 'Leitura', icon: '📖', color: 'orange', days: ALL, type: 'leitura' },
      { id: 'r-casa', time: '20:15', title: 'Arrumar a casa', icon: '🧹', color: 'emerald', days: ALL, type: 'normal' },
      { id: 'r-roupa', time: '20:30', title: 'Lavar roupa', icon: '🧺', color: 'sky', days: [2], type: 'normal' },
      { id: 'r-comida', time: '20:45', title: 'Fazer comida da semana', icon: '🍲', color: 'orange', days: [4, 5], type: 'normal', flexWeekly: true },
      { id: 'r-faxina', time: '09:00', title: 'Limpar a casa (faxina)', icon: '🧽', color: 'violet', days: [6], type: 'normal' },
      { id: 'r-skin-pm', time: '21:30', title: 'Skincare da noite', icon: '🌙', color: 'violet', days: ALL, type: 'skincare', routineKey: 'pm' },
    ],
    oneOff: [],
    done: {},

    workouts: {
      plan: { 0: null, 1: 'w-quad', 2: 'w-costas', 3: 'w-post', 4: 'w-sup', 5: 'w-gluteo', 6: 'w-cardio' },
      list: [
        { id: 'w-quad', name: 'Quadríceps', color: 'rose', exercises: [
          ex('Agachamento livre', 4, '10'), ex('Leg press 45°', 4, '12'), ex('Cadeira extensora', 3, '15'),
          ex('Afundo / passada', 3, '12 cada perna'), ex('Agachamento búlgaro', 3, '10 cada perna')] },
        { id: 'w-costas', name: 'Costas e bíceps', color: 'sky', exercises: [
          ex('Puxada frontal', 4, '12'), ex('Remada baixa', 4, '12'), ex('Remada unilateral', 3, '10'),
          ex('Rosca direta', 3, '12'), ex('Rosca martelo', 3, '12')] },
        { id: 'w-post', name: 'Posterior e glúteo', color: 'violet', exercises: [
          ex('Stiff', 4, '10'), ex('Mesa flexora', 4, '12'), ex('Elevação pélvica', 4, '12'),
          ex('Cadeira abdutora', 3, '15'), ex('Glúteo no cabo', 3, '12 cada perna')] },
        { id: 'w-sup', name: 'Peito, ombro e tríceps', color: 'amber', exercises: [
          ex('Supino com halteres', 4, '12'), ex('Desenvolvimento', 3, '12'), ex('Elevação lateral', 3, '15'),
          ex('Tríceps corda', 3, '12'), ex('Tríceps francês', 3, '12')] },
        { id: 'w-gluteo', name: 'Glúteo e abdômen', color: 'pink', exercises: [
          ex('Elevação pélvica', 4, '10'), ex('Agachamento sumô', 4, '12'), ex('Coice na polia', 3, '12 cada perna'),
          ex('Prancha', 3, '40s'), ex('Abdominal infra', 3, '15')] },
        { id: 'w-cardio', name: 'Cardio + core', color: 'emerald', exercises: [
          ex('Esteira inclinada', 1, '30 min'), ex('Prancha lateral', 3, '30s cada lado'), ex('Abdominal bicicleta', 3, '20')] },
      ],
    },
    workoutLog: {},

    products: [
      { id: 'p-sab', name: 'Sabonete facial', brand: '', category: 'skincare', notes: '', low: false },
      { id: 'p-vitc', name: 'Sérum vitamina C', brand: '', category: 'skincare', notes: '', low: false },
      { id: 'p-hid', name: 'Hidratante facial', brand: '', category: 'skincare', notes: '', low: false },
      { id: 'p-fps', name: 'Protetor solar FPS 50', brand: '', category: 'skincare', notes: '', low: false },
      { id: 'p-noite', name: 'Sérum noturno (retinol/ácido)', brand: '', category: 'skincare', notes: '', low: false },
      { id: 'p-sh', name: 'Shampoo', brand: '', category: 'cabelo', notes: '', low: false },
      { id: 'p-cond', name: 'Condicionador', brand: '', category: 'cabelo', notes: '', low: false },
      { id: 'p-mh', name: 'Máscara de hidratação', brand: '', category: 'cabelo', notes: '', low: false },
      { id: 'p-mn', name: 'Máscara de nutrição', brand: '', category: 'cabelo', notes: '', low: false },
      { id: 'p-mr', name: 'Máscara de reconstrução', brand: '', category: 'cabelo', notes: '', low: false },
      { id: 'p-acid', name: 'Acidificante', brand: '', category: 'cabelo', notes: '', low: false },
      { id: 'p-ton', name: 'Tônico capilar', brand: '', category: 'cabelo', notes: '', low: false },
    ],

    skincare: {
      am: { name: 'Manhã', steps: [
        { id: 's1', icon: '🧼', productId: 'p-sab', how: 'Rosto todo, massagear por 1 min' },
        { id: 's2', icon: '🧪', productId: 'p-vitc', how: '3 gotas no rosto e pescoço' },
        { id: 's3', icon: '🫙', productId: 'p-hid', how: 'Rosto e pescoço' },
        { id: 's4', icon: '🛡️', productId: 'p-fps', how: 'Rosto, pescoço e orelhas (reaplicar ao longo do dia)' },
      ] },
      pm: { name: 'Noite', steps: [
        { id: 's5', icon: '🧼', productId: 'p-sab', how: 'Rosto todo' },
        { id: 's6', icon: '🧪', productId: 'p-noite', how: 'Camada fina, evitando a área dos olhos' },
        { id: 's7', icon: '🫙', productId: 'p-hid', how: 'Rosto e pescoço' },
      ] },
    },
    skinLog: {},

    hair: {
      interval: 3, // lava 1 dia sim e 2 não
      anchorDate: today,
      anchorIndex: 0,
      cycle: ['hidratacao', 'nutricao', 'hidratacao', 'nutricao', 'reconstrucao'],
      maskProducts: { hidratacao: ['p-mh'], nutricao: ['p-mn'], reconstrucao: ['p-mr'] },
      steps: [
        { id: 'h1', label: 'Shampoo', productIds: ['p-sh'], when: 'always' },
        { id: 'h2', label: 'Máscara do dia', productIds: [], when: 'mask' },
        { id: 'h3', label: 'Acidificante', productIds: ['p-acid'], when: 'reconstrucao' },
        { id: 'h4', label: 'Condicionador', productIds: ['p-cond'], when: 'always' },
        { id: 'h5', label: 'Tônico capilar', productIds: ['p-ton'], when: 'always' },
      ],
      log: {},
    },

    books: [],
    reading: { activeBookId: null, timer: { running: false, startedAt: null, acc: 0 }, sessions: [] },

    challenges: [defaultChallenge(today)],
    activeChallengeId: 'c-1',

    water: { goal: 3000, log: {} },

    meds: [
      { id: 'm-omega', name: 'Ômega 3', unit: 'cápsula', color: 'violet', active: true,
        schedule: [{ time: '08:00', qty: 1 }, { time: '13:00', qty: 1 }, { time: '20:00', qty: 1 }],
        info: { purpose: 'Suplemento de ômega 3', dose: '3 cápsulas por dia (pode tomar separado)', notes: '' } },
    ],
    medLog: {},

    finance: defaultFinance(),

    goals: [],
    reviews: {},
    sleep: { goalHours: 8, bedtime: '21:00', wake: '05:00', log: {} },
    streaks: { on: true, inList: true, hidden: [], pauses: {}, perMonth: 2 },
    focus: { foco: 25, pausa: 5 },

    study: { sessions: [], timer: { running: false, startedAt: null, acc: 0 } },
    english: { sessions: [], timer: { running: false, startedAt: null, acc: 0 } },

    settings: {
      layout: 'rosa', // rosa | lavanda | ceu | minimal
      theme: 'auto', // auto | light | dark
      tabs: [{ id: 'desafio', label: 'Desafio' }, { id: 'leitura', label: 'Leitura' }, { id: 'cuidados', label: 'Cuidados' }],
      dash: [{ id: 'frase', on: true }, { id: 'semanal', on: true }, { id: 'resumo', on: true }, { id: 'semana', on: true }, { id: 'agua', on: true }, { id: 'cards', on: true },
        { id: 'rotina', on: true }, { id: 'desafio', on: true }],
      home: defaultHome(),
    },

    cycle: {
      cycleLength: 28, // usado enquanto não houver histórico suficiente
      periodLength: 4,
      luteal: 14,
      periodDays: { '2026-11-10': true, '2026-11-11': true, '2026-11-12': true, '2026-11-13': true },
      logs: {},
    },
  };
}

export function defaultChallenge(start) {
  return {
    id: 'c-1', name: 'Desafio 20 dias – Rotina perfeita', startDate: start, days: 20, archived: false,
    goals: [
      { id: 'g1', text: 'Acordar às 5h', link: 'r-acordar' },
      { id: 'g2', text: 'Ouvir a Palavra do dia', link: 'r-palavra' },
      { id: 'g3', text: 'Treinar', link: 'r-academia' },
      { id: 'g4', text: 'Ler', link: 'r-leitura' },
      { id: 'g5', text: 'Bater a meta de água', link: '__agua' },
    ],
    checks: {},
  };
}

// abas que podem ir para a barra de baixo (Hoje e Mais são fixas)
export const TAB_DEFS = {
  hoje: { label: 'Hoje', icon: 'home' },
  desafio: { label: 'Desafio', icon: 'target' },
  leitura: { label: 'Leitura', icon: 'book' },
  cuidados: { label: 'Cuidados', icon: 'heart' },
  ciclo: { label: 'Ciclo', icon: 'flower' },
  remedios: { label: 'Remédios', icon: 'pill' },
  estudo: { label: 'Estudo', icon: 'books' },
  ingles: { label: 'Inglês', icon: 'chat' },
  financas: { label: 'Finanças', icon: 'wallet' },
  metas: { label: 'Metas', icon: 'target' },
  sono: { label: 'Sono', icon: 'moon' },
  sequencias: { label: 'Sequências', icon: 'flame' },
  relatorio: { label: 'Relatório', icon: 'pie' },
  treinos: { label: 'Treinos', icon: 'dumbbell' },
  rotina: { label: 'Rotina', icon: 'calendar' },
  mais: { label: 'Mais', icon: 'dots' },
};
export const LAYOUTS = {
  rosa: { name: 'Rosa', desc: 'Rosa com roxinho' },
  lavanda: { name: 'Lavanda', desc: 'Roxinho com azul' },
  ceu: { name: 'Céu', desc: 'Azulzinho com lilás' },
  minimal: { name: 'Minimalista', desc: 'Claro, com detalhes rosa' },
};
export const CARD_NAMES = {
  desafio: 'Desafio', metas: 'Metas', sequencias: 'Sequências', sono: 'Sono', treino: 'Treino', remedios: 'Remédios', estudo: 'Estudo', ingles: 'Inglês', financas: 'Finanças', cabelo: 'Cabelo', leitura: 'Leitura', skincare: 'Skincare',
  agua: 'Água', ciclo: 'Meu ciclo',
};
export const SQUARE_NAMES = { nenhum: 'Nenhum', ciclo: 'Meu ciclo', agua: 'Água', desafio: 'Desafio', leitura: 'Leitura', estudo: 'Estudo', ingles: 'Inglês', remedios: 'Remédios' };
export function defaultHome() {
  return {
    square2: 'ciclo',
    cards: ['metas', 'sequencias', 'sono', 'desafio', 'treino', 'remedios', 'estudo', 'ingles', 'financas', 'cabelo', 'leitura', 'skincare', 'agua', 'ciclo']
      .map((id) => ({ id, on: !['agua', 'ciclo'].includes(id) })),
    cardsLayout: 'grid',
    groupRoutine: true,
    hideDone: false,
    showFilters: true,
    phrase: '',
    showWeekCycle: true,
  };
}
export const PHRASES = [
  'Você não sobe ao nível das suas metas. Você cai ao nível dos seus sistemas. — James Clear, Hábitos Atômicos',
  'Todo hábito é um voto para o tipo de pessoa que você deseja se tornar. — James Clear, Hábitos Atômicos',
  'Se você ficar 1% melhor a cada dia, ao fim de um ano estará 37 vezes melhor. — James Clear, Hábitos Atômicos',
  'Os hábitos são os juros compostos do autodesenvolvimento. — James Clear, Hábitos Atômicos',
  'A mudança pode não ser rápida e nem sempre é fácil. Mas, com tempo e esforço, quase qualquer hábito pode ser remodelado. — Charles Duhigg, O Poder do Hábito',
  'Comece com o objetivo em mente. — Stephen R. Covey, Os 7 Hábitos das Pessoas Altamente Eficazes',
  'O importante não é priorizar o que está na agenda, mas agendar as prioridades. — Stephen R. Covey',
  'Primeiro o mais importante. — Stephen R. Covey',
  'Engula o sapo: faça primeiro a tarefa mais difícil do dia. — Brian Tracy, Comece pelo Mais Difícil',
  'A disciplina é a ponte entre metas e realizações. — Jim Rohn',
  'Você é a média das cinco pessoas com quem passa mais tempo. — Jim Rohn',
  'Cuide do seu corpo. É o único lugar que você tem para viver. — Jim Rohn',
  'Você não precisa ser ótima para começar, mas precisa começar para ser ótima. — Zig Ziglar',
  'As pessoas dizem que a motivação não dura. Bem, nem o banho; por isso recomendamos diariamente. — Zig Ziglar',
  'A mudança é difícil no começo, confusa no meio e linda no final. — Robin Sharma',
  'Pequenas melhorias diárias, ao longo do tempo, levam a resultados impressionantes. — Robin Sharma',
  'Domine sua manhã, eleve sua vida. — Robin Sharma, O Clube das 5 da Manhã',
  'Como você acorda cada dia determina o sucesso do seu dia. — Hal Elrod, O Milagre da Manhã',
  'Tudo o que a mente humana pode conceber e acreditar, ela pode alcançar. — Napoleon Hill, Quem Pensa Enriquece',
  'O ponto de partida de toda conquista é o desejo. — Napoleon Hill',
  'Se você fizer o que sempre fez, vai conseguir o que sempre conseguiu. — atribuída a Tony Robbins',
  'O caminho para o sucesso é tomar ações massivas e determinadas. — Tony Robbins',
  'É nos seus momentos de decisão que o seu destino é traçado. — Tony Robbins',
  'Você é mais corajosa do que acredita, mais forte do que parece e mais inteligente do que pensa. — A. A. Milne, Ursinho Pooh',
  'Ainda não é a palavra mais poderosa para quem está aprendendo. — Carol S. Dweck, Mindset',
  'Tornar-se é melhor do que ser. — Carol S. Dweck, Mindset',
  'Comece pelo porquê. — Simon Sinek',
  'O que pode ser medido pode ser melhorado. — atribuída a Peter Drucker',
  'Não existe nada tão inútil quanto fazer com grande eficiência algo que nem deveria ser feito. — Peter Drucker',
  'Trabalho profundo é a capacidade de se concentrar sem distração em uma tarefa exigente. — Cal Newport, Trabalho Focado',
  'Menos, porém melhor. — Greg McKeown, Essencialismo',
  'Se você não priorizar sua vida, alguém fará isso por você. — Greg McKeown, Essencialismo',
  'Garra é paixão e perseverança por metas de longo prazo. — Angela Duckworth, Garra',
  'Conte até cinco e aja antes que o seu cérebro te convença do contrário. — Mel Robbins, O Poder dos 5 Segundos',
  'Se você quer viver uma vida feliz, amarre-a a uma meta, não a pessoas ou coisas. — atribuída a Albert Einstein',
  'A jornada de mil quilômetros começa com um único passo. — Lao-Tsé',
  'Não importa o quão devagar você vá, desde que não pare. — Confúcio',
  'Somos o que repetidamente fazemos. A excelência, portanto, não é um ato, mas um hábito. — Will Durant, sobre Aristóteles',
  'A sorte é o que acontece quando a preparação encontra a oportunidade. — atribuída a Sêneca',
  'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis. — Sêneca',
  'Você tem poder sobre a sua mente, não sobre os acontecimentos. Perceba isso e encontrará força. — Marco Aurélio, Meditações',
  'A maneira de começar é parar de falar e começar a fazer. — atribuída a Walt Disney',
  'O futuro pertence àqueles que acreditam na beleza de seus sonhos. — atribuída a Eleanor Roosevelt',
  'A única maneira de fazer um ótimo trabalho é amar o que você faz. — Steve Jobs',
  'Se você pensa que pode ou se pensa que não pode, de qualquer forma você está certa. — atribuída a Henry Ford',
  'O segredo para progredir é começar. — atribuída a Mark Twain',
  'Daqui a vinte anos você estará mais decepcionada com as coisas que não fez do que com as que fez. — atribuída a Mark Twain',
  'Acredite que você pode, e você já está no meio do caminho. — Theodore Roosevelt',
  'Faça o que puder, com o que tiver, onde estiver. — Theodore Roosevelt',
  'O sucesso é a soma de pequenos esforços repetidos dia após dia. — Robert Collier',
  'Quem tem um porquê enfrenta qualquer como. — Friedrich Nietzsche',
  'Tudo posso naquele que me fortalece. — Filipenses 4,13',
  'Entrega o teu caminho ao Senhor, confia nele, e o mais Ele fará. — Salmo 37,5',
  'Sejam fortes e corajosos. Não tenham medo. — Deuteronômio 31,6',
  'Para tudo há um tempo, para cada coisa há um momento debaixo do céu. — Eclesiastes 3,1',
  'Comece fazendo o que é necessário; depois o que é possível; e de repente você estará fazendo o impossível. — atribuída a São Francisco de Assis',
  'Reze como se tudo dependesse de Deus e trabalhe como se tudo dependesse de você. — atribuída a Santo Agostinho',
  'O que você faz hoje pode melhorar todos os seus amanhãs. — Ralph Marston',
  'A persistência é o caminho do êxito. — atribuída a Charles Chaplin',
  'Nossa maior glória não está em nunca cair, mas em levantar cada vez que caímos. — Oliver Goldsmith',
  'Faça de cada dia a sua obra-prima. — John Wooden',
  'Não conte os dias, faça os dias contarem. — Muhammad Ali',
  'Pequenos passos todos os dias levam longe. 💜',
  'Disciplina é lembrar do que você quer de verdade.',
  'Feito é melhor que perfeito.',
  'Você não precisa ser perfeita, só constante.',
  'Hoje é um ótimo dia para cuidar de você. 🌸',
  'Um dia de cada vez, uma tarefa de cada vez.',
  'O que você faz todo dia importa mais do que o que faz de vez em quando.',
  'Seu futuro agradece cada escolha boa de hoje.',
  'Comece de onde está, com o que tem.',
  'A constância vence o talento que não se esforça.',
  'Cuide do seu corpo: é o único lugar onde você vai morar a vida inteira.',
  'Devagar também é caminho.',
  'Você já venceu dias difíceis antes. Vai vencer hoje também.',
  'Foco no progresso, não na perfeição. ✨',
  'Acordar cedo é um presente que você dá para si mesma.',
  'Seja a sua maior incentivadora.',
  'Grandes mudanças começam com hábitos pequenos.',
  'Descansar também faz parte do processo.',
  'Você é mais forte do que imagina. 💪',
  'Hoje, faça algo de que o seu eu de amanhã se orgulhe.',
  'A motivação te faz começar; o hábito te faz continuar.',
  'Não pare quando estiver cansada. Pare quando terminar.',
  'Cada página lida, cada treino feito: tudo soma.',
  'Seja gentil com você hoje. 💜',
  'Organização é amor-próprio em forma de rotina.',
  'Quem planta disciplina colhe liberdade.',
  'O segredo é não desistir nos dias comuns.',
  'Você está construindo a mulher que sonha ser.',
  'Um bom dia começa com uma boa intenção.',
  'Respire fundo. Você dá conta. 🌷',
  'Pouco a pouco, o pouco vira muito.',
  'Seu esforço de hoje é o resultado de amanhã.',
  'Acredite no processo, mesmo quando ele for lento.',
  'Sua rotina é a sua maior aliada.',
  'Faça hoje o que te aproxima dos seus sonhos.',
  'Você merece a melhor versão de si mesma.',
  'Gratidão transforma o que temos em suficiente.',
  'Entregue seu dia a Deus e faça a sua parte. 🙏',
  'Fé no coração e foco na rotina.',
  'Deus está no controle; você está no caminho certo.',
  'Coragem não é ausência de medo, é seguir mesmo assim.',
  'Brilhe do seu jeito. ✨',
  'Seu ritmo, suas regras, sua evolução.',
  'Celebre cada pequena vitória do dia. 🎉',
  'A disciplina de hoje é a paz de amanhã.',
  'Persistir é o que separa o sonho da conquista.',
  'Hoje é página nova: escreva uma boa história.',
  'Você não está atrasada, está no seu tempo.',
  'Cuidar de si não é luxo, é prioridade. 🌸',
  'Termine o dia sabendo que fez o seu melhor.',
];
export const DASH_NAMES = {
  frase: 'Frase do dia',
  semanal: 'Prioridades e revisão da semana',
  resumo: 'Hábitos + quadrado da direita', semana: 'Semana', agua: 'Água', cards: 'Cards de resumo',
  rotina: 'Rotina do dia', desafio: 'Metas do desafio',
};

/** ícone sugerido para um passo de skincare, pelo nome do produto */
export function guessSkinIcon(name = '') {
  const n = name.toLowerCase();
  if (/sabonete|limpez|gel de limpeza|espuma|cleanser/.test(n)) return '🧼';
  if (/protetor|fps|solar|spf/.test(n)) return '🛡️';
  if (/s[ée]rum|vitamina|[áa]cido|retinol|niacinamida|ampola/.test(n)) return '🧪';
  if (/olho|olheira/.test(n)) return '👀';
  if (/l[áa]bio|balm|batom/.test(n)) return '💋';
  if (/m[áa]scara|argila/.test(n)) return '💆‍♀️';
  if (/t[ôo]nico|[áa]gua micelar|bruma|água termal/.test(n)) return '💧';
  if (/esfolia/.test(n)) return '🫧';
  if (/hidratante|creme|gel/.test(n)) return '🫙';
  if (/[óo]leo/.test(n)) return '🌿';
  return '✨';
}

// Finanças: categorias iniciais (dá para editar tudo no app)
export const DEFAULT_FIN_CATEGORIES = [
  { id: 'fc-moradia', name: 'Moradia', icon: '🏠', color: 'violet', kind: 'despesa', limit: 0 },
  { id: 'fc-contas', name: 'Contas da casa', icon: '💡', color: 'slate', kind: 'despesa', limit: 0 },
  { id: 'fc-mercado', name: 'Mercado', icon: '🛒', color: 'pink', kind: 'despesa', limit: 0 },
  { id: 'fc-alimentacao', name: 'Alimentação fora', icon: '🍽️', color: 'rose', kind: 'despesa', limit: 0 },
  { id: 'fc-transporte', name: 'Transporte', icon: '🚗', color: 'sky', kind: 'despesa', limit: 0 },
  { id: 'fc-saude', name: 'Saúde e remédios', icon: '💊', color: 'emerald', kind: 'despesa', limit: 0 },
  { id: 'fc-beleza', name: 'Beleza e autocuidado', icon: '💅', color: 'amber', kind: 'despesa', limit: 0 },
  { id: 'fc-educacao', name: 'Educação', icon: '🎓', color: 'orange', kind: 'despesa', limit: 0 },
  { id: 'fc-lazer', name: 'Lazer', icon: '🎉', color: 'pink', kind: 'despesa', limit: 0 },
  { id: 'fc-assinaturas', name: 'Assinaturas', icon: '📺', color: 'slate', kind: 'despesa', limit: 0 },
  { id: 'fc-roupas', name: 'Roupas e compras', icon: '🛍️', color: 'rose', kind: 'despesa', limit: 0 },
  { id: 'fc-outros', name: 'Outros', icon: '📦', color: 'violet', kind: 'despesa', limit: 0 },
  { id: 'fr-salario', name: 'Salário', icon: '💰', color: 'emerald', kind: 'receita', limit: 0 },
  { id: 'fr-extra', name: 'Renda extra', icon: '💵', color: 'sky', kind: 'receita', limit: 0 },
  { id: 'fr-outros', name: 'Outras receitas', icon: '🐷', color: 'violet', kind: 'receita', limit: 0 },
];
export const defaultFinance = () => ({ categories: DEFAULT_FIN_CATEGORIES.map((c) => ({ ...c })), totalLimit: 0, entries: [], bills: [] });

