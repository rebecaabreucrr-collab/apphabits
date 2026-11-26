// Configuração do login (Supabase).
// Enquanto o endereço e a chave estiverem vazios, o app funciona sem login.
// Os dois valores ficam em: Supabase → Project Settings → API.
// A chave "anon public" pode ficar aqui: ela é feita para ficar dentro do app.
export const CONFIG = {
  supabaseUrl: '',      // ex.: 'https://abcdefgh.supabase.co'
  supabaseKey: '',      // a chave "anon" / "public"
  requireLogin: true,   // com URL e chave preenchidas, pede login para usar o app
};

// número da versão (aparece em Mais) — muda a cada atualização do app
export const APP_VERSION = 36;
