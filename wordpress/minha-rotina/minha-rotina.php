<?php
/**
 * Plugin Name:       Minha Rotina
 * Description:       App de rotina, hábitos e autocuidado dentro do WordPress. Abra em /minha-rotina/ (somente usuárias logadas).
 * Version:           1.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Rebeca
 * License:           GPL-2.0-or-later
 * Text Domain:       minha-rotina
 */

defined( 'ABSPATH' ) || exit;

define( 'MR_VERSION', '1.1.0' );
define( 'MR_DIR', plugin_dir_path( __FILE__ ) );
define( 'MR_URL', plugin_dir_url( __FILE__ ) );
define( 'MR_OPT_DATA', 'minha_rotina_backup' );
define( 'MR_OPT_STAMP', 'minha_rotina_backup_stamp' );
define( 'MR_OPT_ACCESS', 'minha_rotina_acesso' ); // 'admin' (padrão) ou 'logado'
define( 'MR_OPT_AI_KEY', 'minha_rotina_ia_chave' );
define( 'MR_OPT_AI_MODEL', 'minha_rotina_ia_modelo' );

if ( PHP_VERSION_ID >= 80100 ) {
	require_once MR_DIR . 'includes/ia-financas.php';
} else {
	// hospedagem com PHP antigo: o app funciona, só a IA fica desligada
	function mr_ai_ready() {
		return false;
	}
	function mr_ai_admin_section() {
		echo '<h2>✨ Inteligência artificial (Finanças)</h2><div class="notice notice-warning inline"><p>A IA precisa de <strong>PHP 8.1 ou mais novo</strong>. Sua hospedagem está com PHP ' . esc_html( PHP_VERSION ) . '. Peça à hospedagem para atualizar; o resto do app funciona normalmente.</p></div>';
	}
}

/* ------------------------------------------------------------------ */
/* Endereço do app: /minha-rotina/ (ou ?minha_rotina_app=1 sem links permanentes) */
/* ------------------------------------------------------------------ */
function mr_add_rewrite() {
	add_rewrite_rule( '^minha-rotina/?$', 'index.php?minha_rotina_app=1', 'top' );
}
add_action( 'init', 'mr_add_rewrite' );

add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'minha_rotina_app';
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
	if ( get_query_var( 'minha_rotina_app' ) ) {
		mr_render_app();
		exit;
	}
} );

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
	$html = str_replace(
		array( 'href="manifest.webmanifest"', 'href="icons/', 'href="css/', 'src="js/' ),
		array( 'href="' . esc_url( $app . 'manifest.webmanifest' ) . '"', 'href="' . esc_url( $app . 'icons/' ), 'href="' . esc_url( $app . 'css/' ), 'src="' . esc_url( $app . 'js/' ) ),
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

	// o app usa isto para falar com a IA das finanças (a chave nunca vai para o navegador)
	$head .= '<script>window.MR_WP=' . wp_json_encode( array(
		'rest'  => esc_url_raw( rest_url( 'minha-rotina/v1/' ) ),
		'nonce' => wp_create_nonce( 'wp_rest' ),
		'ia'    => mr_ai_ready(),
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
		'ia_ok'   => array( 'success', 'IA configurada e funcionando! ✨' ),
		'ia_salva'=> array( 'success', 'Configuração da IA salva.' ),
		'ia_erro' => array( 'error', 'A IA não respondeu: ' . ( isset( $_GET['mr_err'] ) ? sanitize_text_field( wp_unslash( $_GET['mr_err'] ) ) : '' ) ), // phpcs:ignore
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

		<?php mr_ai_admin_section(); ?>

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
