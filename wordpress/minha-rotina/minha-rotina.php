<?php
/**
 * Plugin Name:       Minha Rotina
 * Description:       App de rotina, hábitos e autocuidado dentro do WordPress. Abra em /minha-rotina/ (somente usuárias logadas).
 * Version: 1.4.8
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Rebeca
 * License:           GPL-2.0-or-later
 * Text Domain:       minha-rotina
 */

defined( 'ABSPATH' ) || exit;

define( 'MR_VERSION', '1.4.8' );
define( 'MR_DIR', plugin_dir_path( __FILE__ ) );
define( 'MR_URL', plugin_dir_url( __FILE__ ) );
define( 'MR_OPT_DATA', 'minha_rotina_backup' );
define( 'MR_OPT_STAMP', 'minha_rotina_backup_stamp' );
define( 'MR_OPT_ACCESS', 'minha_rotina_acesso' ); // 'admin' (padrão) ou 'logado'
// a IA paga foi removida: apaga a chave antiga, se tiver ficado guardada
add_action( 'admin_init', function () {
	if ( get_option( 'minha_rotina_ia_chave' ) !== false ) {
		delete_option( 'minha_rotina_ia_chave' );
		delete_option( 'minha_rotina_ia_modelo' );
	}
} );

/* ------------------------------------------------------------------ */
/* Endereço do app: /minha-rotina/ (ou ?minha_rotina_app=1 sem links permanentes) */
/* ------------------------------------------------------------------ */
function mr_add_rewrite() {
	add_rewrite_rule( '^minha-rotina/?$', 'index.php?minha_rotina_app=1', 'top' );
}
add_action( 'init', 'mr_add_rewrite' );

add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'minha_rotina_app';
	$vars[] = 'minha_rotina_manifest';
	$vars[] = 'minha_rotina_sw';
	return $vars;
} );

function mr_app_url() {
	return get_option( 'permalink_structure' )
		? home_url( '/minha-rotina/' )
		: add_query_arg( 'minha_rotina_app', '1', home_url( '/' ) );
}

/* ------------------------------------------------------------------ */
/* Ativação: cria o endereço e carrega o backup inicial (se houver)    */
/* ------------------------------------------------------------------ */
register_activation_hook( __FILE__, function () {
	mr_add_rewrite();
	flush_rewrite_rules();
	if ( ! get_option( MR_OPT_ACCESS ) ) {
		add_option( MR_OPT_ACCESS, 'admin', '', false );
	}
	$file = MR_DIR . 'includes/backup-inicial.php';
	if ( ! get_option( MR_OPT_DATA ) && file_exists( $file ) ) {
		$json = include $file; // arquivo PHP: não pode ser lido pelo navegador
		if ( is_string( $json ) && mr_is_valid_backup( $json ) ) {
			update_option( MR_OPT_DATA, $json, false );
			update_option( MR_OPT_STAMP, time(), false );
		}
	}
} );

register_deactivation_hook( __FILE__, 'flush_rewrite_rules' );

function mr_is_valid_backup( $json ) {
	$data = json_decode( $json, true );
	return is_array( $data ) && isset( $data['routine'] ) && is_array( $data['routine'] );
}

/* ------------------------------------------------------------------ */
/* Quem pode abrir o app                                               */
/* ------------------------------------------------------------------ */
function mr_can_access() {
	if ( ! is_user_logged_in() ) {
		return false;
	}
	return get_option( MR_OPT_ACCESS, 'admin' ) === 'logado' || current_user_can( 'manage_options' );
}

/* ------------------------------------------------------------------ */
/* Página do app                                                       */
/* ------------------------------------------------------------------ */
add_action( 'template_redirect', function () {
	if ( get_query_var( 'minha_rotina_manifest' ) ) {
		mr_render_manifest();
		exit;
	}
	if ( get_query_var( 'minha_rotina_sw' ) ) {
		mr_render_sw();
		exit;
	}
	if ( get_query_var( 'minha_rotina_app' ) ) {
		mr_render_app();
		exit;
	}
} );

/* ------------------------------------------------------------------ */
/* Instalar no celular a partir do WordPress: manifesto e modo offline */
/* ------------------------------------------------------------------ */
function mr_app_path() {
	$p = wp_parse_url( mr_app_url(), PHP_URL_PATH );
	return $p ? $p : '/';
}
function mr_render_manifest() {
	$icons = MR_URL . 'app/icons/';
	header( 'Content-Type: application/manifest+json; charset=utf-8' );
	echo wp_json_encode( array(
		'name'             => 'Minha Rotina',
		'short_name'       => 'Rotina',
		'lang'             => 'pt-BR',
		'start_url'        => mr_app_url() . '#/hoje',
		'scope'            => mr_app_path(),
		'display'          => 'standalone',
		'orientation'      => 'portrait',
		'background_color' => '#fff7f8',
		'theme_color'      => '#f43f5e',
		'icons'            => array(
			array( 'src' => $icons . 'icon-192.png', 'sizes' => '192x192', 'type' => 'image/png' ),
			array( 'src' => $icons . 'icon-512.png', 'sizes' => '512x512', 'type' => 'image/png' ),
			array( 'src' => $icons . 'icon-512-maskable.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable' ),
		),
	), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
}
/** modo offline: só cuida da página do app e dos arquivos do plugin; o resto do site passa direto */
function mr_render_sw() {
	header( 'Content-Type: application/javascript; charset=utf-8' );
	header( 'Cache-Control: no-cache' );
	$base = wp_json_encode( MR_URL . 'app/' );
	$page = wp_json_encode( mr_app_path() );
	$ver  = wp_json_encode( 'mr-wp-' . MR_VERSION );
	echo <<<JS
const CACHE = {$ver}; const BASE = {$base}; const PAGE = {$page};
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('mr-wp-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const isPage = u.origin === location.origin && u.pathname === PAGE && (PAGE !== '/' || u.searchParams.has('minha_rotina_app'));
  if (!isPage && !req.url.startsWith(BASE)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) c.put(isPage ? PAGE : req, r.clone()); return r; }
    catch { return (await c.match(isPage ? PAGE : req, { ignoreSearch: !isPage })) || Response.error(); }
  }));
});
JS;
}

/* ------------------------------------------------------------------ */
/* Sincronização: os dados de cada usuária ficam no perfil dela        */
/* ------------------------------------------------------------------ */
add_action( 'rest_api_init', function () {
	register_rest_route( 'minha-rotina/v1', '/dados', array(
		array( 'methods' => 'GET', 'callback' => 'mr_sync_get', 'permission_callback' => 'mr_can_access' ),
		array( 'methods' => 'POST', 'callback' => 'mr_sync_post', 'permission_callback' => 'mr_can_access' ),
	) );
} );
function mr_sync_get() {
	$uid  = get_current_user_id();
	$json = get_user_meta( $uid, 'minha_rotina_dados', true );
	return new WP_REST_Response( array(
		'data'      => $json ? json_decode( $json, true ) : null,
		'updatedAt' => (int) get_user_meta( $uid, 'minha_rotina_dados_em', true ),
	), 200 );
}
function mr_sync_post( WP_REST_Request $req ) {
	$uid  = get_current_user_id();
	$p    = $req->get_json_params();
	$data = $p['data'] ?? null;
	$at   = (int) ( $p['updatedAt'] ?? 0 );
	if ( ! is_array( $data ) || ! isset( $data['routine'] ) ) {
		return new WP_REST_Response( array( 'message' => 'Dados inválidos.' ), 400 );
	}
	$json = wp_json_encode( $data, JSON_UNESCAPED_UNICODE );
	if ( strlen( $json ) > 8 * 1024 * 1024 ) {
		return new WP_REST_Response( array( 'message' => 'Dados grandes demais (máx. 8 MB).' ), 413 );
	}
	$cur = (int) get_user_meta( $uid, 'minha_rotina_dados_em', true );
	if ( $cur && $at && $at + 500 < $cur ) {
		// outro aparelho salvou algo mais novo: devolve para o app atualizar
		$saved = get_user_meta( $uid, 'minha_rotina_dados', true );
		return new WP_REST_Response( array( 'message' => 'Há dados mais novos.', 'data' => json_decode( $saved, true ), 'updatedAt' => $cur ), 409 );
	}
	update_user_meta( $uid, 'minha_rotina_dados', wp_slash( $json ) );
	update_user_meta( $uid, 'minha_rotina_dados_em', $at ? $at : (int) round( microtime( true ) * 1000 ) );
	return new WP_REST_Response( array( 'ok' => true, 'updatedAt' => $at ), 200 );
}

function mr_render_app() {
	if ( ! is_user_logged_in() ) {
		auth_redirect(); // manda para o login e volta depois
	}
	if ( ! mr_can_access() ) {
		wp_die( esc_html__( 'Você não tem permissão para abrir o Minha Rotina.', 'minha-rotina' ), 403 );
	}

	$html = file_get_contents( MR_DIR . 'app/index.html' );
	$app  = MR_URL . 'app/';

	// caminhos dos arquivos do app apontam para a pasta do plugin
	$manifest = add_query_arg( 'minha_rotina_manifest', '1', home_url( '/' ) );
	$html     = str_replace(
		array( 'href="manifest.webmanifest"', 'href="icons/', 'href="css/', 'src="js/' ),
		array( 'href="' . esc_url( $manifest ) . '"', 'href="' . esc_url( $app . 'icons/' ), 'href="' . esc_url( $app . 'css/' ), 'src="' . esc_url( $app . 'js/' ) ),
		$html
	);

	$head = '<meta name="robots" content="noindex, nofollow">';

	// carrega o backup no aparelho na primeira vez (e quando um backup novo for enviado)
	$data  = get_option( MR_OPT_DATA );
	$stamp = (int) get_option( MR_OPT_STAMP, 0 );
	if ( $data && current_user_can( 'manage_options' ) ) {
		$flags = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE;
		$head .= '<script>(function(){try{var s=' . (int) $stamp . ';'
			. 'if(localStorage.getItem("minharotina.boot")!==String(s)){'
			. 'var d=' . wp_json_encode( $data, $flags ) . ';JSON.parse(d);'
			. 'localStorage.setItem("minharotina.v1",d);localStorage.setItem("minharotina.boot",String(s));}'
			. '}catch(e){console.warn("Minha Rotina: backup não carregado",e);}})();</script>';
	}

	// dados para o app falar com o WordPress (sincronização entre aparelhos e modo offline)
	$head .= '<script>window.MR_WP=' . wp_json_encode( array(
		'rest'  => esc_url_raw( rest_url( 'minha-rotina/v1/' ) ),
		'nonce' => wp_create_nonce( 'wp_rest' ),
		'sw'    => esc_url_raw( add_query_arg( 'minha_rotina_sw', '1', home_url( '/' ) ) ),
		'scope' => mr_app_path(),
	) ) . ';</script>';

	$html = preg_replace( '/<head>/', '<head>' . $head, $html, 1 );

	nocache_headers();
	header( 'Content-Type: text/html; charset=utf-8' );
	header( 'X-Robots-Tag: noindex, nofollow' );
	echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- página do próprio app
}

/* ------------------------------------------------------------------ */
/* Shortcode: [minha_rotina] ou [minha_rotina modo="incorporado" altura="850"] */
/* ------------------------------------------------------------------ */
add_shortcode( 'minha_rotina', function ( $atts ) {
	$atts = shortcode_atts( array( 'modo' => 'botao', 'altura' => '850' ), $atts, 'minha_rotina' );
	if ( ! mr_can_access() ) {
		return '<p>' . esc_html__( 'Faça login para acessar o Minha Rotina.', 'minha-rotina' ) . '</p>';
	}
	$url = mr_app_url();
	if ( 'incorporado' === $atts['modo'] ) {
		return '<iframe src="' . esc_url( $url ) . '" title="Minha Rotina" style="width:100%;max-width:480px;height:' . absint( $atts['altura'] ) . 'px;border:0;border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,.12)"></iframe>';
	}
	return '<a href="' . esc_url( $url ) . '" style="display:inline-block;padding:14px 22px;border-radius:16px;background:linear-gradient(135deg,#f472b6,#c084fc);color:#fff;font-weight:700;text-decoration:none">' . esc_html__( 'Abrir Minha Rotina', 'minha-rotina' ) . '</a>';
} );

/* ------------------------------------------------------------------ */
/* Painel no WordPress                                                 */
/* ------------------------------------------------------------------ */
add_action( 'admin_menu', function () {
	add_menu_page( 'Minha Rotina', 'Minha Rotina', 'manage_options', 'minha-rotina', 'mr_admin_page', 'dashicons-heart', 58 );
} );

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	array_unshift( $links, '<a href="' . esc_url( mr_app_url() ) . '" target="_blank">' . esc_html__( 'Abrir app', 'minha-rotina' ) . '</a>' );
	return $links;
} );

function mr_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$data   = get_option( MR_OPT_DATA );
	$stamp  = (int) get_option( MR_OPT_STAMP, 0 );
	$access = get_option( MR_OPT_ACCESS, 'admin' );
	$info   = $data ? json_decode( $data, true ) : null;
	$msg    = isset( $_GET['mr_msg'] ) ? sanitize_key( wp_unslash( $_GET['mr_msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	$msgs   = array(
		'ok'      => array( 'success', 'Backup carregado! Abra o app para ver os dados.' ),
		'removed' => array( 'success', 'Backup removido do WordPress.' ),
		'invalid' => array( 'error', 'Arquivo inválido. Use o backup gerado em Mais → Backup → Salvar backup.' ),
		'saved'   => array( 'success', 'Configuração salva.' ),
	);
	?>
	<div class="wrap">
		<h1>💜 Minha Rotina</h1>
		<?php if ( isset( $msgs[ $msg ] ) ) : ?>
			<div class="notice notice-<?php echo esc_attr( $msgs[ $msg ][0] ); ?> is-dismissible"><p><?php echo esc_html( $msgs[ $msg ][1] ); ?></p></div>
		<?php endif; ?>

		<p><a class="button button-primary button-hero" href="<?php echo esc_url( mr_app_url() ); ?>" target="_blank">Abrir o app</a></p>
		<p>Endereço: <code><?php echo esc_html( mr_app_url() ); ?></code> — só abre para quem está logada.
			Se der "página não encontrada", vá em <strong>Configurações → Links permanentes</strong> e clique em <strong>Salvar</strong>.</p>

		<h2>Backup</h2>
		<?php if ( $info ) : ?>
			<p>Backup carregado<?php echo $stamp ? ' em ' . esc_html( wp_date( 'd/m/Y H:i', $stamp ) ) : ''; ?>:
				<strong><?php echo esc_html( $info['profile']['name'] ?? '' ); ?></strong> ·
				<?php echo (int) count( $info['routine'] ?? array() ); ?> tarefas na rotina ·
				<?php echo (int) count( $info['meds'] ?? array() ); ?> remédios.</p>
			<p class="description">Ao abrir o app neste computador, esses dados entram nele. Depois disso, o que você fizer fica salvo no navegador.
				Enviar um backup novo substitui os dados do app neste navegador na próxima vez que abrir.</p>
		<?php else : ?>
			<p>Nenhum backup carregado. O app abre vazio (ou com o que já estiver salvo neste navegador).</p>
		<?php endif; ?>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
			<?php wp_nonce_field( 'mr_upload' ); ?>
			<input type="hidden" name="action" value="mr_upload">
			<p><input type="file" name="mr_backup" accept=".json,application/json" required>
				<button class="button">Enviar backup novo</button></p>
		</form>
		<?php if ( $info ) : ?>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('Remover o backup guardado no WordPress?');">
				<?php wp_nonce_field( 'mr_remove' ); ?>
				<input type="hidden" name="action" value="mr_remove">
				<p><button class="button button-link-delete">Remover backup do WordPress</button></p>
			</form>
		<?php endif; ?>

		<h2>🔄 Sincronização entre aparelhos</h2>
		<?php $em = (int) get_user_meta( get_current_user_id(), 'minha_rotina_dados_em', true ); ?>
		<p><?php echo $em ? 'Seus dados estão guardados no WordPress (última atualização em ' . esc_html( wp_date( 'd/m/Y H:i', (int) ( $em / 1000 ) ) ) . ').' : 'Ainda não há dados sincronizados. Eles aparecem aqui assim que você abrir o app.'; ?></p>
		<p class="description">Use o app sempre pelo endereço acima (no PC e no celular). No iPhone: abra o endereço no Safari, entre com seu usuário do WordPress e toque em Compartilhar → Adicionar à Tela de Início. O que você fizer num aparelho aparece no outro.</p>

		<h2>Quem pode abrir</h2>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'mr_access' ); ?>
			<input type="hidden" name="action" value="mr_access">
			<p><label><input type="radio" name="acesso" value="admin" <?php checked( $access, 'admin' ); ?>> Só administradoras (recomendado)</label><br>
				<label><input type="radio" name="acesso" value="logado" <?php checked( $access, 'logado' ); ?>> Qualquer usuário logado (cada um com seus dados no próprio aparelho)</label></p>
			<p><button class="button">Salvar</button></p>
		</form>

		<h2>Colocar numa página</h2>
		<p>Botão que abre o app: <code>[minha_rotina]</code><br>
			App dentro da página: <code>[minha_rotina modo="incorporado" altura="850"]</code></p>
		<p class="description">Os dados do app ficam no navegador de quem usa. O backup acima fica no banco de dados do WordPress e só é entregue para administradoras logadas.</p>
	</div>
	<?php
}

add_action( 'admin_post_mr_upload', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Sem permissão', 403 );
	}
	check_admin_referer( 'mr_upload' );
	$ok = false;
	if ( ! empty( $_FILES['mr_backup']['tmp_name'] ) && is_uploaded_file( $_FILES['mr_backup']['tmp_name'] ) ) { // phpcs:ignore
		$json = file_get_contents( $_FILES['mr_backup']['tmp_name'] ); // phpcs:ignore
		if ( $json && strlen( $json ) < 15 * 1024 * 1024 && mr_is_valid_backup( $json ) ) {
			update_option( MR_OPT_DATA, $json, false );
			update_option( MR_OPT_STAMP, time(), false );
			$ok = true;
		}
	}
	wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=' . ( $ok ? 'ok' : 'invalid' ) ) );
	exit;
} );

add_action( 'admin_post_mr_remove', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Sem permissão', 403 );
	}
	check_admin_referer( 'mr_remove' );
	delete_option( MR_OPT_DATA );
	delete_option( MR_OPT_STAMP );
	wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=removed' ) );
	exit;
} );

add_action( 'admin_post_mr_access', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Sem permissão', 403 );
	}
	check_admin_referer( 'mr_access' );
	$v = isset( $_POST['acesso'] ) && 'logado' === $_POST['acesso'] ? 'logado' : 'admin';
	update_option( MR_OPT_ACCESS, $v, false );
	wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=saved' ) );
	exit;
} );
