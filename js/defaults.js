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
};

export const COLORS = ['rose', 'violet', 'amber', 'sky', 'emerald', 'orange', 'pink', 'slate'];

export const SKIN_EMOJIS = ['🧼', '🫧', '💧', '🧪', '🫙', '🎀', '🧴', '🛡️', '☀️', '🌙', '💆‍♀️', '🙂', '👀', '💋', '☁️', '🧊',
  '🌀', '🥒', '🪞', '🧖‍♀️', '🤲', '💅', '🌺', '🌹', '🌸', '🌿', '🪒', '🖌️', '🛁', '✨'];
export const EMOJIS = ['✅', '☀️', '🙏', '🏋️‍♀️', '🧴', '💇‍♀️', '📚', '💻', '📖', '🧹', '🧺', '🍲', '🧽', '💧',
  '🥗', '🛒', '💊', '🧘‍♀️', '🚶‍♀️', '📞', '💰', '🛏️', '🐶', '🌱', '✨', '❤️', '🎯', '📝',
  '🧼', '🫧', '🧪', '🫙', '🎀', '🛡️', '💆‍♀️', '👀', '💋', '☁️', '🧊', '🌀', '🪞', '🧖‍♀️', '💅', '🌺', '🌹', '🌿', '🪒', '🖌️',
  '🪮', '🪥', '🛁', '🥒', '🌙', '🌸', '🎉', '⏰'];

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

    study: { sessions: [], timer: { running: false, startedAt: null, acc: 0 } },

    settings: {
      layout: 'rosa', // rosa | lavanda | ceu | minimal
      theme: 'auto', // auto | light | dark
      tabs: [{ id: 'desafio', label: 'Desafio' }, { id: 'leitura', label: 'Leitura' }, { id: 'cuidados', label: 'Cuidados' }],
      dash: [{ id: 'frase', on: true }, { id: 'resumo', on: true }, { id: 'semana', on: true }, { id: 'agua', on: true }, { id: 'cards', on: true },
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
  desafio: 'Desafio', treino: 'Treino', remedios: 'Remédios', estudo: 'Estudo', cabelo: 'Cabelo', leitura: 'Leitura', skincare: 'Skincare',
  agua: 'Água', ciclo: 'Meu ciclo',
};
export const SQUARE_NAMES = { nenhum: 'Nenhum', ciclo: 'Meu ciclo', agua: 'Água', desafio: 'Desafio', leitura: 'Leitura', estudo: 'Estudo', remedios: 'Remédios' };
export function defaultHome() {
  return {
    square2: 'ciclo',
    cards: ['desafio', 'treino', 'remedios', 'estudo', 'cabelo', 'leitura', 'skincare', 'agua', 'ciclo']
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
