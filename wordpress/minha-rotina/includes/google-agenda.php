<?php
/**
 * Google Agenda pela API oficial: ver, criar, editar e apagar eventos das agendas escolhidas.
 * A chave de acesso (refresh token) fica só no perfil da usuária no WordPress; o navegador nunca a recebe.
 */
defined( 'ABSPATH' ) || exit;

define( 'MR_OPT_GCLIENT', 'minha_rotina_google_client' );
define( 'MR_OPT_GSECRET', 'minha_rotina_google_secret' );
// endereços do Google (podem ser trocados só para testes)
defined( 'MR_GOOGLE_AUTH' ) || define( 'MR_GOOGLE_AUTH', 'https://accounts.google.com/o/oauth2/v2/auth' );
defined( 'MR_GOOGLE_TOKEN' ) || define( 'MR_GOOGLE_TOKEN', 'https://oauth2.googleapis.com/token' );
defined( 'MR_GOOGLE_REVOKE' ) || define( 'MR_GOOGLE_REVOKE', 'https://oauth2.googleapis.com/revoke' );
defined( 'MR_GOOGLE_API' ) || define( 'MR_GOOGLE_API', 'https://www.googleapis.com/calendar/v3' );

function mr_g_redirect_uri() {
	return add_query_arg( 'minha_rotina_gcb', '1', home_url( '/' ) );
}
function mr_g_configured() {
	return get_option( MR_OPT_GCLIENT ) && get_option( MR_OPT_GSECRET );
}

add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'minha_rotina_gcb';
	$vars[] = 'minha_rotina_gauth';
	return $vars;
} );

/* ---------- login no Google (vai e volta) ---------- */
add_action( 'template_redirect', function () {
	if ( get_query_var( 'minha_rotina_gauth' ) ) {
		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}
		if ( ! mr_can_access() || ! mr_g_configured() ) {
			wp_die( 'A Google Agenda ainda não foi configurada no painel do plugin.', 403 );
		}
		$state = wp_generate_password( 24, false );
		set_transient( 'mr_gstate_' . get_current_user_id(), $state, 15 * MINUTE_IN_SECONDS );
		$url = add_query_arg( array(
			'client_id'     => rawurlencode( get_option( MR_OPT_GCLIENT ) ),
			'redirect_uri'  => rawurlencode( mr_g_redirect_uri() ),
			'response_type' => 'code',
			'scope'         => rawurlencode( 'https://www.googleapis.com/auth/calendar' ),
			'access_type'   => 'offline',
			'prompt'        => 'consent',
			'state'         => $state,
		), MR_GOOGLE_AUTH );
		wp_redirect( $url ); // phpcs:ignore WordPress.Security.SafeRedirect -- endereço do Google
		exit;
	}
	if ( get_query_var( 'minha_rotina_gcb' ) ) {
		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}
		$uid   = get_current_user_id();
		$state = get_transient( 'mr_gstate_' . $uid );
		delete_transient( 'mr_gstate_' . $uid );
		$back = mr_app_url() . '#/agenda';
		// phpcs:disable WordPress.Security.NonceVerification -- o "state" do Google faz esse papel
		if ( ! $state || ! isset( $_GET['state'] ) || ! hash_equals( $state, (string) $_GET['state'] ) || empty( $_GET['code'] ) ) {
			wp_safe_redirect( $back . '?g=erro' );
			exit;
		}
		$res = wp_remote_post( MR_GOOGLE_TOKEN, array( 'timeout' => 20, 'body' => array(
			'code'          => sanitize_text_field( wp_unslash( $_GET['code'] ) ),
			'client_id'     => get_option( MR_OPT_GCLIENT ),
			'client_secret' => get_option( MR_OPT_GSECRET ),
			'redirect_uri'  => mr_g_redirect_uri(),
			'grant_type'    => 'authorization_code',
		) ) );
		// phpcs:enable
		$tok = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $tok['refresh_token'] ) ) {
			wp_safe_redirect( $back . '?g=erro' );
			exit;
		}
		update_user_meta( $uid, 'minha_rotina_gtoken', $tok['refresh_token'] );
		set_transient( 'mr_gat_' . $uid, $tok['access_token'], max( 60, (int) ( $tok['expires_in'] ?? 3600 ) - 120 ) );
		wp_safe_redirect( $back . '?g=ok' );
		exit;
	}
}, 5 );

/** chave de acesso válida (renova sozinha); null se não estiver conectada */
function mr_g_token( $uid ) {
	$at = get_transient( 'mr_gat_' . $uid );
	if ( $at ) {
		return $at;
	}
	$rt = get_user_meta( $uid, 'minha_rotina_gtoken', true );
	if ( ! $rt || ! mr_g_configured() ) {
		return null;
	}
	$res = wp_remote_post( MR_GOOGLE_TOKEN, array( 'timeout' => 20, 'body' => array(
		'client_id'     => get_option( MR_OPT_GCLIENT ),
		'client_secret' => get_option( MR_OPT_GSECRET ),
		'refresh_token' => $rt,
		'grant_type'    => 'refresh_token',
	) ) );
	$tok = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( empty( $tok['access_token'] ) ) {
		if ( ( $tok['error'] ?? '' ) === 'invalid_grant' ) {
			delete_user_meta( $uid, 'minha_rotina_gtoken' ); // acesso revogado ou expirado: precisa conectar de novo
		}
		return null;
	}
	set_transient( 'mr_gat_' . $uid, $tok['access_token'], max( 60, (int) ( $tok['expires_in'] ?? 3600 ) - 120 ) );
	return $tok['access_token'];
}
/** chamada à API do Google Agenda */
function mr_g_api( $method, $path, $query = array(), $body = null ) {
	$at = mr_g_token( get_current_user_id() );
	if ( ! $at ) {
		return new WP_Error( 'mr_g', 'A Google Agenda não está conectada.' );
	}
	$url  = MR_GOOGLE_API . $path . ( $query ? '?' . http_build_query( $query ) : '' );
	$args = array( 'method' => $method, 'timeout' => 20, 'headers' => array( 'Authorization' => 'Bearer ' . $at ) );
	if ( null !== $body ) {
		$args['headers']['Content-Type'] = 'application/json';
		$args['body']                    = wp_json_encode( $body );
	}
	$res  = wp_remote_request( $url, $args );
	$code = (int) wp_remote_retrieve_response_code( $res );
	$data = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( $code < 200 || $code >= 300 ) {
		return new WP_Error( 'mr_g', $data['error']['message'] ?? 'O Google não respondeu (' . $code . ').' );
	}
	return is_array( $data ) ? $data : array();
}
function mr_g_err( $e, $code = 502 ) {
	return new WP_REST_Response( array( 'message' => $e instanceof WP_Error ? $e->get_error_message() : (string) $e ), $code );
}
/** agendas escolhidas que a usuária pode usar (só ids que existem na conta dela) */
function mr_g_calendars( $force = false ) {
	$uid  = get_current_user_id();
	$list = $force ? false : get_transient( 'mr_gcals_' . $uid );
	if ( ! $list ) {
		$r = mr_g_api( 'GET', '/users/me/calendarList', array( 'maxResults' => 100 ) );
		if ( is_wp_error( $r ) ) {
			return $r;
		}
		$list = array_map( function ( $c ) {
			return array(
				'id'      => $c['id'],
				'name'    => $c['summaryOverride'] ?? $c['summary'] ?? $c['id'],
				'color'   => $c['backgroundColor'] ?? '#a78bfa',
				'write'   => in_array( $c['accessRole'] ?? '', array( 'owner', 'writer' ), true ),
				'primary' => ! empty( $c['primary'] ),
			);
		}, $r['items'] ?? array() );
		set_transient( 'mr_gcals_' . $uid, $list, 30 * MINUTE_IN_SECONDS );
	}
	return $list;
}
function mr_g_selected() {
	$s = get_user_meta( get_current_user_id(), 'minha_rotina_gsel', true );
	return is_array( $s ) ? $s : array();
}
function mr_g_cal_ok( $id, $need_write = false ) {
	$cals = mr_g_calendars();
	if ( is_wp_error( $cals ) || ! in_array( $id, mr_g_selected(), true ) ) {
		return false;
	}
	foreach ( $cals as $c ) {
		if ( $c['id'] === $id ) {
			return $need_write ? $c['write'] : true;
		}
	}
	return false;
}

/* ---------- rotas para o app ---------- */
add_action( 'rest_api_init', function () {
	$ns = 'minha-rotina/v1';
	$p  = 'mr_can_access';
	register_rest_route( $ns, '/google', array( 'methods' => 'GET', 'callback' => 'mr_g_status', 'permission_callback' => $p ) );
	register_rest_route( $ns, '/google/agendas', array(
		array( 'methods' => 'GET', 'callback' => 'mr_g_cals_get', 'permission_callback' => $p ),
		array( 'methods' => 'POST', 'callback' => 'mr_g_cals_set', 'permission_callback' => $p ),
	) );
	register_rest_route( $ns, '/google/eventos', array(
		array( 'methods' => 'GET', 'callback' => 'mr_g_events', 'permission_callback' => $p ),
		array( 'methods' => 'POST', 'callback' => 'mr_g_event_save', 'permission_callback' => $p ),
		array( 'methods' => 'DELETE', 'callback' => 'mr_g_event_del', 'permission_callback' => $p ),
	) );
	register_rest_route( $ns, '/google/desconectar', array( 'methods' => 'POST', 'callback' => 'mr_g_disconnect', 'permission_callback' => $p ) );
} );

function mr_g_status() {
	$uid = get_current_user_id();
	return new WP_REST_Response( array(
		'configured' => (bool) mr_g_configured(),
		'connected'  => (bool) get_user_meta( $uid, 'minha_rotina_gtoken', true ),
		'connect'    => add_query_arg( 'minha_rotina_gauth', '1', home_url( '/' ) ),
		'selected'   => mr_g_selected(),
	), 200 );
}
function mr_g_cals_get( WP_REST_Request $req ) {
	$cals = mr_g_calendars( (bool) $req->get_param( 'refresh' ) );
	return is_wp_error( $cals ) ? mr_g_err( $cals ) : new WP_REST_Response( array( 'calendars' => $cals, 'selected' => mr_g_selected() ), 200 );
}
function mr_g_cals_set( WP_REST_Request $req ) {
	$cals = mr_g_calendars();
	if ( is_wp_error( $cals ) ) {
		return mr_g_err( $cals );
	}
	$ids = wp_list_pluck( $cals, 'id' );
	$sel = array_values( array_intersect( (array) ( $req->get_json_params()['selected'] ?? array() ), $ids ) );
	update_user_meta( get_current_user_id(), 'minha_rotina_gsel', $sel );
	return new WP_REST_Response( array( 'selected' => $sel ), 200 );
}
function mr_g_date( $s ) {
	return preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $s ) ? (string) $s : '';
}
function mr_g_events( WP_REST_Request $req ) {
	$start = mr_g_date( $req->get_param( 'start' ) );
	$end   = mr_g_date( $req->get_param( 'end' ) );
	$tz    = preg_match( '#^[A-Za-z_]+(/[A-Za-z_+-]+){0,2}$#', (string) $req->get_param( 'tz' ) ) ? (string) $req->get_param( 'tz' ) : 'America/Sao_Paulo';
	if ( ! $start || ! $end ) {
		return mr_g_err( 'Período inválido.', 400 );
	}
	$cals = mr_g_calendars();
	if ( is_wp_error( $cals ) ) {
		return mr_g_err( $cals );
	}
	$sel = mr_g_selected();
	$out = array();
	try {
		$zone = new DateTimeZone( $tz );
	} catch ( Exception $e ) {
		$zone = new DateTimeZone( 'America/Sao_Paulo' );
	}
	$tmin = ( new DateTime( $start . ' 00:00:00', $zone ) )->format( DATE_RFC3339 );
	$tmax = ( new DateTime( $end . ' 23:59:59', $zone ) )->format( DATE_RFC3339 );
	foreach ( $cals as $c ) {
		if ( ! in_array( $c['id'], $sel, true ) ) {
			continue;
		}
		$r = mr_g_api( 'GET', '/calendars/' . rawurlencode( $c['id'] ) . '/events', array(
			'singleEvents' => 'true', 'orderBy' => 'startTime', 'timeMin' => $tmin, 'timeMax' => $tmax, 'maxResults' => 250, 'timeZone' => $tz,
		) );
		if ( is_wp_error( $r ) ) {
			continue;
		}
		foreach ( $r['items'] ?? array() as $e ) {
			if ( ( $e['status'] ?? '' ) === 'cancelled' ) {
				continue;
			}
			$all = isset( $e['start']['date'] );
			if ( $all ) {
				$sd = $e['start']['date'];
				$ed = gmdate( 'Y-m-d', strtotime( $e['end']['date'] ?? $sd ) - 86400 ); // fim exclusivo
				$t1 = '';
				$t2 = '';
			} else {
				$s  = new DateTime( $e['start']['dateTime'] );
				$f  = new DateTime( $e['end']['dateTime'] ?? $e['start']['dateTime'] );
				$s->setTimezone( $zone );
				$f->setTimezone( $zone );
				$sd = $s->format( 'Y-m-d' );
				$ed = $f->format( 'Y-m-d' );
				$t1 = $s->format( 'H:i' );
				$t2 = $f->format( 'H:i' );
			}
			$out[] = array(
				'id' => $e['id'], 'cal' => $c['id'], 'calName' => $c['name'], 'color' => $c['color'], 'edit' => $c['write'] && ( $e['eventType'] ?? 'default' ) === 'default',
				'title' => $e['summary'] ?? '(sem título)', 'date' => $sd, 'endDate' => $ed, 'time' => $t1, 'end' => $t2, 'allDay' => $all,
				'location' => $e['location'] ?? '', 'notes' => wp_strip_all_tags( $e['description'] ?? '' ), 'recurring' => ! empty( $e['recurringEventId'] ),
			);
		}
	}
	return new WP_REST_Response( array( 'events' => $out, 'at' => (int) round( microtime( true ) * 1000 ) ), 200 );
}
function mr_g_event_save( WP_REST_Request $req ) {
	$p   = $req->get_json_params();
	$cal = (string) ( $p['cal'] ?? '' );
	if ( ! mr_g_cal_ok( $cal, true ) ) {
		return mr_g_err( 'Essa agenda não pode ser alterada pelo app.', 403 );
	}
	$date = mr_g_date( $p['date'] ?? '' );
	$tz   = preg_match( '#^[A-Za-z_]+(/[A-Za-z_+-]+){0,2}$#', (string) ( $p['tz'] ?? '' ) ) ? $p['tz'] : 'America/Sao_Paulo';
	$title = sanitize_text_field( $p['title'] ?? '' );
	if ( ! $date || '' === $title ) {
		return mr_g_err( 'Preencha o nome e a data.', 400 );
	}
	$hm = function ( $v ) { return preg_match( '/^\d{2}:\d{2}$/', (string) $v ) ? $v : ''; };
	$t1 = $hm( $p['time'] ?? '' );
	$t2 = $hm( $p['end'] ?? '' );
	$ev = array(
		'summary'     => $title,
		'location'    => sanitize_text_field( $p['location'] ?? '' ),
		'description' => sanitize_textarea_field( $p['notes'] ?? '' ),
	);
	if ( ! empty( $p['allDay'] ) || ! $t1 ) {
		$ev['start'] = array( 'date' => $date );
		$ev['end']   = array( 'date' => gmdate( 'Y-m-d', strtotime( $date . ' +1 day' ) ) );
	} else {
		if ( ! $t2 || $t2 <= $t1 ) {
			$t2 = gmdate( 'H:i', min( strtotime( "$date $t1 +1 hour" ), strtotime( "$date 23:59" ) ) );
		}
		$ev['start'] = array( 'dateTime' => "{$date}T{$t1}:00", 'timeZone' => $tz );
		$ev['end']   = array( 'dateTime' => "{$date}T{$t2}:00", 'timeZone' => $tz );
	}
	$id = (string) ( $p['id'] ?? '' );
	if ( $id ) {
		// ao editar, limpa o outro formato (dia todo <-> com horário)
		foreach ( array( 'start', 'end' ) as $k ) {
			if ( isset( $ev[ $k ]['date'] ) ) {
				$ev[ $k ]['dateTime'] = null;
				$ev[ $k ]['timeZone'] = null;
			} else {
				$ev[ $k ]['date'] = null;
			}
		}
	}
	$r  = $id
		? mr_g_api( 'PATCH', '/calendars/' . rawurlencode( $cal ) . '/events/' . rawurlencode( $id ), array(), $ev )
		: mr_g_api( 'POST', '/calendars/' . rawurlencode( $cal ) . '/events', array(), $ev );
	return is_wp_error( $r ) ? mr_g_err( $r ) : new WP_REST_Response( array( 'ok' => true, 'id' => $r['id'] ?? $id ), 200 );
}
function mr_g_event_del( WP_REST_Request $req ) {
	$cal = (string) $req->get_param( 'cal' );
	$id  = (string) $req->get_param( 'id' );
	if ( ! $id || ! mr_g_cal_ok( $cal, true ) ) {
		return mr_g_err( 'Esse evento não pode ser apagado pelo app.', 403 );
	}
	$r = mr_g_api( 'DELETE', '/calendars/' . rawurlencode( $cal ) . '/events/' . rawurlencode( $id ) );
	return is_wp_error( $r ) ? mr_g_err( $r ) : new WP_REST_Response( array( 'ok' => true ), 200 );
}
function mr_g_disconnect() {
	$uid = get_current_user_id();
	$rt  = get_user_meta( $uid, 'minha_rotina_gtoken', true );
	if ( $rt ) {
		wp_remote_post( MR_GOOGLE_REVOKE, array( 'timeout' => 10, 'body' => array( 'token' => $rt ) ) );
	}
	delete_user_meta( $uid, 'minha_rotina_gtoken' );
	delete_transient( 'mr_gat_' . $uid );
	delete_transient( 'mr_gcals_' . $uid );
	return new WP_REST_Response( array( 'connected' => false ), 200 );
}

/* ---------- painel: onde colar o ID e a chave do Google ---------- */
add_action( 'admin_post_mr_google', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Sem permissão', 403 );
	}
	check_admin_referer( 'mr_google' );
	$id  = isset( $_POST['client_id'] ) ? sanitize_text_field( wp_unslash( $_POST['client_id'] ) ) : '';
	$sec = isset( $_POST['client_secret'] ) ? sanitize_text_field( wp_unslash( $_POST['client_secret'] ) ) : '';
	update_option( MR_OPT_GCLIENT, $id, false );
	if ( '' !== $sec ) {
		update_option( MR_OPT_GSECRET, $sec, false );
	}
	if ( '' === $id ) {
		delete_option( MR_OPT_GSECRET );
	}
	wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=saved#google' ) );
	exit;
} );
function mr_google_admin_section() {
	$id  = get_option( MR_OPT_GCLIENT );
	$has = (bool) get_option( MR_OPT_GSECRET );
	?>
	<h2 id="google">📅 Google Agenda</h2>
	<p>Para ver, criar e editar eventos da sua Google Agenda pelo app, crie uma ligação gratuita no Google (uma vez só):</p>
	<ol>
		<li>Entre em <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">console.cloud.google.com</a> com a sua conta Google e crie um projeto (ex.: “Minha Rotina”).</li>
		<li>Em <b>APIs e serviços → Biblioteca</b>, procure <b>Google Calendar API</b> e clique em <b>Ativar</b>.</li>
		<li>Em <b>APIs e serviços → Tela de consentimento OAuth</b> (ou “Google Auth Platform”): tipo <b>Externo</b>, nome do app, seu e-mail. Em <b>Público-alvo</b>, adicione o seu e-mail como usuário de teste e depois clique em <b>Publicar aplicativo</b> (assim a conexão não expira a cada 7 dias).</li>
		<li>Em <b>Credenciais → Criar credenciais → ID do cliente OAuth</b>: tipo <b>Aplicativo da Web</b>. Em <b>URIs de redirecionamento autorizados</b>, cole exatamente:<br><code><?php echo esc_html( mr_g_redirect_uri() ); ?></code></li>
		<li>Copie o <b>ID do cliente</b> e a <b>Chave secreta do cliente</b> e cole abaixo.</li>
		<li>No app, abra <b>Agenda → Conectar com o Google</b>. O Google vai avisar que o app “não foi verificado”: é o seu próprio app; toque em <b>Avançado → Acessar</b> e permita.</li>
	</ol>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<?php wp_nonce_field( 'mr_google' ); ?>
		<input type="hidden" name="action" value="mr_google">
		<p><label>ID do cliente<br><input type="text" class="large-text" name="client_id" value="<?php echo esc_attr( $id ); ?>" placeholder="....apps.googleusercontent.com"></label></p>
		<p><label>Chave secreta do cliente<br><input type="password" class="regular-text" name="client_secret" value="" placeholder="<?php echo $has ? '•••••••• (já salva — deixe em branco para manter)' : ''; ?>" autocomplete="new-password"></label></p>
		<p><button class="button button-primary">Salvar</button> <?php echo $id && $has ? '<span style="color:#15803d">✓ configurado</span>' : ''; ?></p>
	</form>
	<?php
}
