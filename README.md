# Minha Rotina 📱

App de rotina diária instalável no iPhone (PWA). Funciona offline e guarda os dados no próprio celular.

## O que tem no app

- **Hoje (dashboard)**: progresso do dia com "Agora/A seguir", semana com anel de progresso e fase do ciclo, cards coloridos (ciclo, desafio, treino, cabelo, leitura, skincare), tarefas agrupadas por manhã/tarde/noite, linha do tempo com todas as tarefas e botão **+** para adicionar qualquer coisa (só no dia ou repetindo na semana).
- **Rotina fixa** (editável): 05:00 acordar · 05:10 Palavra do dia (Frei Gilson, com link) · 06:10 academia · cronograma capilar (só nos dias de lavar) · skincare · 08:00–10:00 estudo · 10:00–20:00 trabalho · 13:00 leitura · arrumar a casa todo dia · terça: lavar roupa · quinta **ou** sexta: fazer comida (marcou em um dia, o outro já aparece como feito) · sábado: faxina.
- **Treino**: plano fixo da semana (ex.: segunda = quadríceps). No dia, toque em "Academia" para abrir o treino, marcar os exercícios e anotar a carga (a última carga fica salva).
- **Skincare**: passos da manhã e da noite com o produto e **o que foi aplicado**, produtos extras do dia, anotações da pele e histórico.
- **Cronograma capilar**: lava 1 dia sim e 2 não; ciclo de máscaras (hidratação → nutrição → hidratação → nutrição → reconstrução ≈ 2 reconstruções por mês); acidificante só na reconstrução; tônico em toda lavagem. Dá para trocar a máscara do dia, adiar a lavagem ou registrar uma lavagem fora do dia (o cronograma recalcula).
- **Produtos**: cadastro de tudo que você usa. O app conta quantas vezes e quando usou cada um, mostra os mais usados e monta a lista de compras com o que está acabando.
- **Leitura**: cronômetro (continua contando mesmo se fechar o app), livros com total de páginas, quantas páginas leu em quantos minutos no dia, ritmo (pág/min), quanto falta para terminar e diário de anotações.
- **Desafio de 20 dias**: metas diárias (que podem ser marcadas automaticamente pela rotina), calendário colorido, sequência e dias perfeitos. No fim você pode editar/estender ou criar outro desafio, e os anteriores ficam no histórico.
- **Meu ciclo**: roda do ciclo, previsão da próxima menstruação, período fértil, ovulação e chance de engravidar; botão "minha menstruação desceu hoje", calendário editável e registro de fluxo, sintomas e humor. As previsões são estimativas e não servem como método contraceptivo.
- **Backup**: em Mais → Perfil e backup.

## Como colocar no ar (uma vez só)

1. No GitHub, abra o repositório → **Settings** → **Pages**.
2. Em **Source**, escolha **Deploy from a branch**, selecione a branch onde está o código (ex.: `main`) e a pasta **/ (root)** → **Save**.
3. Em 1–2 minutos aparece o endereço, algo como `https://SEU-USUARIO.github.io/apphabits/`.

> O GitHub Pages é gratuito para repositórios públicos. Os seus dados **não** vão para o GitHub: ficam só no seu iPhone.

## Como instalar no iPhone

1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar** (quadrado com a seta).
3. Toque em **Adicionar à Tela de Início** → **Adicionar**.

## Para rodar no computador

```bash
python3 -m http.server 8000
```
e abra `http://localhost:8000`.

## Estrutura

- `index.html`, `css/styles.css`, `manifest.webmanifest`, `sw.js` (offline), `icons/`
- `js/app.js`: rotas e eventos · `js/logic.js`: regras (tarefas do dia, cronograma capilar, desafio, leitura) · `js/defaults.js`: rotina inicial · `js/view-*.js`: telas
