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
};

export const COLORS = ['rose', 'violet', 'amber', 'sky', 'emerald', 'orange', 'pink', 'slate'];

export const EMOJIS = ['✅', '☀️', '🙏', '🏋️‍♀️', '🧴', '💇‍♀️', '📚', '💻', '📖', '🧹', '🧺', '🍲', '🧽', '💧',
  '🥗', '🛒', '💊', '🧘‍♀️', '🚶‍♀️', '📞', '💰', '🛏️', '🐶', '🌱', '✨', '❤️', '🎯', '📝'];

const ex = (name, sets, reps, load = '', notes = '') => ({ id: uid(), name, sets, reps, load, notes });

export function defaultState() {
  const today = dateKey();
  return {
    version: 1,
    profile: { name: '' },

    routine: [
      { id: 'r-acordar', time: '05:00', title: 'Acordar', icon: '☀️', color: 'amber', days: ALL, type: 'normal' },
      { id: 'r-palavra', time: '05:10', title: 'Palavra do dia – Frei Gilson', icon: '🙏', color: 'violet', days: ALL, type: 'palavra',
        link: 'https://www.youtube.com/results?search_query=frei+gilson+palavra+do+dia' },
      { id: 'r-academia', time: '06:10', title: 'Academia', icon: '🏋️‍♀️', color: 'rose', days: [1, 2, 3, 4, 5, 6], type: 'treino' },
      { id: 'r-cabelo', time: '07:30', title: 'Cronograma capilar', icon: '💇‍♀️', color: 'pink', days: ALL, type: 'cabelo' },
      { id: 'r-skin-am', time: '07:50', title: 'Skincare da manhã', icon: '🧴', color: 'emerald', days: ALL, type: 'skincare', routineKey: 'am' },
      { id: 'r-estudo', time: '08:00', end: '10:00', title: 'Estudar (2h)', icon: '📚', color: 'sky', days: WEEKDAYS, type: 'normal' },
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
        { id: 's1', productId: 'p-sab', how: 'Rosto todo, massagear por 1 min' },
        { id: 's2', productId: 'p-vitc', how: '3 gotas no rosto e pescoço' },
        { id: 's3', productId: 'p-hid', how: 'Rosto e pescoço' },
        { id: 's4', productId: 'p-fps', how: 'Rosto, pescoço e orelhas (reaplicar ao longo do dia)' },
      ] },
      pm: { name: 'Noite', steps: [
        { id: 's5', productId: 'p-sab', how: 'Rosto todo' },
        { id: 's6', productId: 'p-noite', how: 'Camada fina, evitando a área dos olhos' },
        { id: 's7', productId: 'p-hid', how: 'Rosto e pescoço' },
      ] },
    },
    skinLog: {},

    hair: {
      interval: 3, // lava 1 dia sim e 2 não
      anchorDate: today,
      anchorIndex: 0,
      cycle: ['hidratacao', 'nutricao', 'hidratacao', 'nutricao', 'reconstrucao'],
      maskProducts: { hidratacao: 'p-mh', nutricao: 'p-mn', reconstrucao: 'p-mr' },
      steps: [
        { id: 'h1', label: 'Shampoo', productId: 'p-sh', when: 'always' },
        { id: 'h2', label: 'Máscara do dia', productId: null, when: 'mask' },
        { id: 'h3', label: 'Acidificante', productId: 'p-acid', when: 'reconstrucao' },
        { id: 'h4', label: 'Condicionador', productId: 'p-cond', when: 'always' },
        { id: 'h5', label: 'Tônico capilar', productId: 'p-ton', when: 'always' },
      ],
      log: {},
    },

    books: [],
    reading: { activeBookId: null, timer: { running: false, startedAt: null, acc: 0 }, sessions: [] },

    challenges: [defaultChallenge(today)],
    activeChallengeId: 'c-1',

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
      { id: 'g5', text: 'Beber 2L de água', link: null },
    ],
    checks: {},
  };
}
