<?php
/**
 * Google Agenda: ver, criar, editar e apagar eventos das agendas escolhidas.
 * Três formas de ligar (a primeira que estiver pronta vale):
 *  - "oauth": ligação própria pela API oficial (ID do cliente e chave do Google Cloud).
 *  - "script": ponte própria do Minha Rotina no Google Apps Script (grátis, sem Google Cloud). Faz tudo que a API faz.
 *  - "ponte": usa a ligação com o Google que o plugin Recontar Gestão já tem (Apps Script ou login do Google).
 *    Não precisa configurar nada aqui. Só administradoras usam, porque a agenda é a da dona do site.
 * As chaves ficam só no WordPress; o navegador nunca as recebe.
 */
defined( 'ABSPATH' ) || exit;

define( 'MR_OPT_GCLIENT', 'minha_rotina_google_client' );
define( 'MR_OPT_GSECRET', 'minha_rotina_google_secret' );
define( 'MR_OPT_GASURL', 'minha_rotina_gas_url' );     // endereço do app da Web do Apps Script
define( 'MR_OPT_GASTOKEN', 'minha_rotina_gas_token' ); // senha que o script gerou ao parear
define( 'MR_OPT_GASEMAIL', 'minha_rotina_gas_email' );
// cores de evento do Google (colorId → nome e cor que aparece na tela)
const MR_G_COLORS = array(
	'1' => array( 'Lavanda', '#7986CB' ), '2' => array( 'Sálvia', '#33B679' ), '3' => array( 'Uva', '#8E24AA' ), '4' => array( 'Flamingo', '#E67C73' ),
	'5' => array( 'Banana', '#F6BF26' ), '6' => array( 'Tangerina', '#F4511E' ), '7' => array( 'Pavão', '#039BE5' ), '8' => array( 'Grafite', '#616161' ),
	'9' => array( 'Mirtilo', '#3F51B5' ), '10' => array( 'Manjericão', '#0B8043' ), '11' => array( 'Tomate', '#D50000' ),
);
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
/** a ligação do Recontar Gestão está ativa? */
function mr_g_bridge_ready() {
	return class_exists( 'RCG_Google' ) && method_exists( 'RCG_Google', 'configured' ) && method_exists( 'RCG_Google', 'call' ) && RCG_Google::configured();
}
function mr_g_script_ready() {
	return get_option( MR_OPT_GASURL ) && get_option( MR_OPT_GASTOKEN );
}
/** 'oauth' (ligação própria), 'script' (ponte própria no Apps Script), 'ponte' (do Recontar Gestão) ou '' (sem ligação) */
function mr_g_mode() {
	if ( mr_g_configured() && get_user_meta( get_current_user_id(), 'minha_rotina_gtoken', true ) ) {
		return 'oauth';
	}
	if ( ! current_user_can( 'manage_options' ) ) {
		return ''; // as pontes são a agenda da dona do site
	}
	if ( mr_g_script_ready() ) {
		return 'script';
	}
	return mr_g_bridge_ready() ? 'ponte' : '';
}
/** todos os campos do Google (oauth ou script) */
function mr_g_full() {
	return in_array( mr_g_mode(), array( 'oauth', 'script' ), true );
}

/* ---------- ponte própria (Apps Script) ---------- */
/** manda um pedido para o app da Web do Apps Script (o Google responde com um redirecionamento que é lido com GET) */
function mr_g_gas_call( $payload, $url = null ) {
	$url = $url ? $url : get_option( MR_OPT_GASURL );
	$res = wp_remote_post( $url, array(
		'timeout' => 30, 'redirection' => 0, 'headers' => array( 'Content-Type' => 'application/json' ), 'body' => wp_json_encode( $payload ),
	) );
	for ( $i = 0; $i < 5 && ! is_wp_error( $res ); $i++ ) {
		$code = (int) wp_remote_retrieve_response_code( $res );
		$loc  = wp_remote_retrieve_header( $res, 'location' );
		if ( $code < 300 || $code > 399 || ! $loc ) {
			break;
		}
		$res = wp_remote_get( $loc, array( 'timeout' => 30, 'redirection' => 0 ) );
	}
	if ( is_wp_error( $res ) ) {
		return new WP_Error( 'mr_g', 'Não consegui falar com o Google: ' . $res->get_error_message() );
	}
	$body = json_decode( wp_remote_retrieve_body( $res ), true );
	if ( ! is_array( $body ) ) {
		return new WP_Error( 'mr_g', 'A ponte do Google não respondeu como esperado. Confira se o script foi implantado como app da Web, com acesso "Qualquer pessoa", e se o URL termina em /exec.' );
	}
	if ( ! empty( $body['error'] ) ) {
		return new WP_Error( 'mr_g', 'Google: ' . $body['error'] );
	}
	return $body;
}
/** a ponte repassa o pedido para a API do Google Agenda com a permissão da conta dona do script */
function mr_g_gas_api( $method, $path, $query = array(), $body = null ) {
	$r = mr_g_gas_call( array(
		'token' => get_option( MR_OPT_GASTOKEN ), 'action' => 'api', 'method' => $method, 'path' => $path,
		'query' => $query ? $query : new stdClass(), 'body' => $body,
	) );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	$code = (int) ( $r['code'] ?? 0 );
	$data = json_decode( (string) ( $r['body'] ?? '' ), true );
	if ( $code < 200 || $code >= 300 ) {
		return new WP_Error( 'mr_g', $data['error']['message'] ?? 'O Google não respondeu (' . $code . ').' );
	}
	return is_array( $data ) ? $data : array();
}
/** liga a ponte: o script gera uma senha só dele e devolve para o WordPress guardar */
function mr_g_gas_pair( $url ) {
	$url = trim( (string) $url );
	if ( ! preg_match( '#^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$#', $url ) && ! apply_filters( 'mr_allow_test_gas', false ) ) {
		return new WP_Error( 'mr_g', 'Cole o URL do app da Web, que começa com https://script.google.com/macros/s/ e termina em /exec.' );
	}
	$r = mr_g_gas_call( array( 'action' => 'pair' ), $url );
	if ( is_wp_error( $r ) ) {
		return $r;
	}
	if ( empty( $r['token'] ) ) {
		return new WP_Error( 'mr_g', 'A ponte não devolveu a senha de ligação.' );
	}
	update_option( MR_OPT_GASURL, esc_url_raw( $url ), false );
	update_option( MR_OPT_GASTOKEN, sanitize_text_field( $r['token'] ), false );
	update_option( MR_OPT_GASEMAIL, sanitize_email( $r['email'] ?? '' ), false );
	delete_transient( 'mr_gcals_' . get_current_user_id() );
	return true;
}
function mr_g_gas_unpair() {
	delete_option( MR_OPT_GASURL );
	delete_option( MR_OPT_GASTOKEN );
	delete_option( MR_OPT_GASEMAIL );
	delete_transient( 'mr_gcals_' . get_current_user_id() );
}
/** código que vai no script.google.com (não tem senha: ela é criada pelo próprio script ao parear) */
function mr_g_script_code() {
	return <<<'GAS'
// Minha Rotina — ponte com a Google Agenda.
// 1. Cole este código em script.google.com (logada na conta da sua agenda).
// 2. Em "Serviços" (+), adicione "Google Calendar API".
// 3. Implantar → Nova implantação → App da Web: executar como "Eu" e acesso "Qualquer pessoa".
// 4. Cole o URL do app da Web (termina em /exec) no WordPress: Minha Rotina → Google Agenda.
// Para ligar outro site depois, rode a função resetarPareamento aqui no editor.
var API = 'https://www.googleapis.com/calendar/v3';

function doGet() {
  return ContentService.createTextOutput('Minha Rotina: ponte da Google Agenda ativa.');
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('MR_TOKEN');
    if (req.action === 'pair') {
      if (token) throw new Error('Esta ponte já está ligada a um site. Para ligar de novo, rode resetarPareamento no editor do script.');
      token = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('MR_TOKEN', token);
      out = { token: token, email: Session.getEffectiveUser().getEmail() };
    } else {
      if (!token || req.token !== token) throw new Error('Senha de ligação inválida');
      out = api(req);
    }
  } catch (err) {
    out = { error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function api(req) {
  var m = String(req.method || 'GET').toUpperCase();
  var path = String(req.path || '');
  if (['GET', 'POST', 'PATCH', 'DELETE'].indexOf(m) < 0 || !/^\/(calendars\/|users\/me\/calendarList)/.test(path) || path.indexOf('..') >= 0) {
    throw new Error('Pedido não permitido');
  }
  var q = req.query || {};
  var qs = Object.keys(q).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
  var opt = { method: m.toLowerCase(), muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (req.body) {
    opt.contentType = 'application/json';
    opt.payload = JSON.stringify(req.body);
  }
  var r = UrlFetchApp.fetch(API + path + (qs ? '?' + qs : ''), opt);
  return { code: r.getResponseCode(), body: r.getContentText() };
}

function resetarPareamento() {
  PropertiesService.getScriptProperties().deleteProperty('MR_TOKEN');
}

// Rode esta função uma vez para o Google pedir a permissão da agenda.
function autorizar() {
  CalendarApp.getDefaultCalendar();
  Calendar.CalendarList.list({ maxResults: 1 });
}
GAS;
}
/** chamada à ponte do Recontar Gestão */
function mr_g_bridge( $action, $data = array() ) {
	$r = RCG_Google::call( $action, $data );
	if ( is_wp_error( $r ) ) {
		return new WP_Error( 'mr_g', $r->get_error_message() );
	}
	return is_array( $r ) ? $r : array();
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
	if ( 'script' === mr_g_mode() ) {
		return mr_g_gas_api( $method, $path, $query, $body );
	}
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
	if ( 'ponte' === mr_g_mode() ) {
		if ( $force && method_exists( 'RCG_Google', 'refresh_calendars' ) ) {
			RCG_Google::refresh_calendars();
		}
		$cfg = method_exists( 'RCG_Google', 'cfg' ) ? RCG_Google::cfg() : array();
		return array_values( array_map( function ( $c ) {
			return array(
				'id'      => (string) $c['id'],
				'name'    => (string) ( $c['nome'] ?? $c['id'] ),
				'color'   => (string) ( $c['cor'] ?? '#a78bfa' ),
				'write'   => ! isset( $c['minha'] ) || ! empty( $c['minha'] ),
				'primary' => false,
			);
		}, (array) ( $cfg['calendars'] ?? array() ) ) );
	}
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
		// os aniversários do Google ficam dentro da agenda principal: viram uma agenda própria no app (só visualização)
		$list[] = array( 'id' => '__aniversarios', 'name' => 'Aniversários', 'color' => '#60a5fa', 'write' => false, 'primary' => false, 'virtual' => true );
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
	$mode = mr_g_mode();
	$cfg  = 'ponte' === $mode && method_exists( 'RCG_Google', 'cfg' ) ? RCG_Google::cfg() : array();
	$acc  = 'script' === $mode ? (string) get_option( MR_OPT_GASEMAIL ) : (string) ( $cfg['email'] ?? '' );
	return new WP_REST_Response( array(
		'configured' => mr_g_configured() || in_array( $mode, array( 'ponte', 'script' ), true ),
		'connected'  => '' !== $mode,
		'mode'       => $mode,
		'full'       => mr_g_full(),
		'account'    => $acc,
		'colors'     => array_map( function ( $c ) { return array( 'name' => $c[0], 'hex' => $c[1] ); }, MR_G_COLORS ),
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
/** descrição do Google (pode vir em HTML) → texto com quebras de linha */
function mr_g_text( $html ) {
	$t = preg_replace( '#<br\s*/?>|</p>|</div>|</li>#i', "\n", (string) $html );
	return trim( html_entity_decode( wp_strip_all_tags( $t ), ENT_QUOTES, 'UTF-8' ) );
}
/** regra de repetição do Google a partir da data de início */
function mr_g_rrule( $repeat, $date ) {
	$days = array( 'SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA' );
	$ts   = strtotime( $date . ' 12:00:00 UTC' );
	switch ( $repeat ) {
		case 'daily':
			return 'RRULE:FREQ=DAILY';
		case 'weekly':
			return 'RRULE:FREQ=WEEKLY;BYDAY=' . $days[ (int) gmdate( 'w', $ts ) ];
		case 'monthly':
			return 'RRULE:FREQ=MONTHLY;BYMONTHDAY=' . (int) gmdate( 'j', $ts );
		case 'yearly':
			return 'RRULE:FREQ=YEARLY';
		case 'weekdays':
			return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
	}
	return '';
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
	$sel  = mr_g_selected();
	$out  = array();
	$fail = null;
	$okn  = 0;
	try {
		$zone = new DateTimeZone( $tz );
	} catch ( Exception $e ) {
		$zone = new DateTimeZone( 'America/Sao_Paulo' );
	}
	$tmin = ( new DateTime( $start . ' 00:00:00', $zone ) )->format( DATE_RFC3339 );
	$tmax = ( new DateTime( $end . ' 23:59:59', $zone ) )->format( DATE_RFC3339 );
	if ( 'ponte' === mr_g_mode() ) {
		return mr_g_bridge_events( $cals, $sel, $tmin, $tmax, $zone );
	}
	$bday = in_array( '__aniversarios', $sel, true );
	foreach ( $cals as $c ) {
		if ( ! empty( $c['virtual'] ) ) {
			continue;
		}
		$on = in_array( $c['id'], $sel, true );
		if ( ! $on && ! ( $bday && ! empty( $c['primary'] ) ) ) {
			continue;
		}
		$r = mr_g_api( 'GET', '/calendars/' . rawurlencode( $c['id'] ) . '/events', array(
			'singleEvents' => 'true', 'orderBy' => 'startTime', 'timeMin' => $tmin, 'timeMax' => $tmax, 'maxResults' => 250, 'timeZone' => $tz,
		) );
		if ( is_wp_error( $r ) ) {
			$fail = $fail ? $fail : $r;
			continue;
		}
		$okn++;
		foreach ( $r['items'] ?? array() as $e ) {
			if ( ( $e['status'] ?? '' ) === 'cancelled' ) {
				continue;
			}
			$is_bday = ( $e['eventType'] ?? '' ) === 'birthday';
			if ( $is_bday ? ! $bday : ! $on ) {
				continue;
			}
			$cc  = $is_bday ? array( 'id' => '__aniversarios', 'name' => 'Aniversários', 'color' => '#60a5fa', 'write' => false ) : $c;
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
			$cid   = (string) ( $e['colorId'] ?? '' );
			$rem   = $e['reminders'] ?? array( 'useDefault' => true );
			$out[] = array(
				'id' => $e['id'], 'cal' => $cc['id'], 'calName' => $cc['name'], 'color' => isset( MR_G_COLORS[ $cid ] ) && ! $is_bday ? MR_G_COLORS[ $cid ][1] : $cc['color'],
				'edit' => $cc['write'] && ( $e['eventType'] ?? 'default' ) === 'default' && empty( $e['attendeesOmitted'] ) && ( ! isset( $e['organizer']['self'] ) || $e['organizer']['self'] || empty( $e['attendees'] ) ),
				'title' => $e['summary'] ?? '(sem título)', 'date' => $sd, 'endDate' => $ed, 'time' => $t1, 'end' => $t2, 'allDay' => $all,
				'location' => $e['location'] ?? '', 'notes' => mr_g_text( $e['description'] ?? '' ), 'recurring' => ! empty( $e['recurringEventId'] ),
				'colorId' => $cid,
				'reminders' => ! empty( $rem['useDefault'] ) ? 'default' : array_values( array_map( function ( $o ) { return (int) $o['minutes']; }, (array) ( $rem['overrides'] ?? array() ) ) ),
				'guests' => array_values( array_map( function ( $a ) { return (string) $a['email']; }, array_filter( (array) ( $e['attendees'] ?? array() ), function ( $a ) { return empty( $a['self'] ) && empty( $a['resource'] ) && ! empty( $a['email'] ); } ) ) ),
				'meet' => (string) ( $e['hangoutLink'] ?? '' ),
				'link' => (string) ( $e['htmlLink'] ?? '' ),
			);
		}
	}
	if ( $fail && ! $okn ) {
		return mr_g_err( $fail ); // nenhuma agenda respondeu: mostra o motivo no app
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
	$d2 = mr_g_date( $p['endDate'] ?? '' );
	if ( ! $d2 || $d2 < $date ) {
		$d2 = $date;
	}
	if ( ! empty( $p['allDay'] ) || ! $t1 ) {
		$ev['start'] = array( 'date' => $date );
		$ev['end']   = array( 'date' => gmdate( 'Y-m-d', strtotime( $d2 . ' 12:00:00 UTC +1 day' ) ) ); // fim exclusivo
	} else {
		if ( ! $t2 || ( $d2 === $date && $t2 <= $t1 ) ) {
			$d2 = $date;
			$t2 = gmdate( 'H:i', min( strtotime( "$date $t1 UTC +1 hour" ), strtotime( "$date 23:59 UTC" ) ) );
		}
		$ev['start'] = array( 'dateTime' => "{$date}T{$t1}:00", 'timeZone' => $tz );
		$ev['end']   = array( 'dateTime' => "{$d2}T{$t2}:00", 'timeZone' => $tz );
	}
	$query = array();
	if ( mr_g_full() ) {
		// cor do evento ('' = cor da agenda)
		$cid = (string) ( $p['colorId'] ?? '' );
		if ( isset( MR_G_COLORS[ $cid ] ) ) {
			$ev['colorId'] = $cid;
		} elseif ( ! empty( $p['id'] ) ) {
			$ev['colorId'] = null;
		}
		// notificações: 'default' (padrão da agenda) ou lista de minutos antes (vazia = nenhuma)
		$rem = $p['reminders'] ?? 'default';
		if ( 'default' === $rem ) {
			$ev['reminders'] = array( 'useDefault' => true );
		} else {
			$mins = array_slice( array_unique( array_filter( array_map( 'intval', (array) $rem ), function ( $m ) { return $m >= 0 && $m <= 40320; } ) ), 0, 5 );
			$ev['reminders'] = array( 'useDefault' => false, 'overrides' => array_values( array_map( function ( $m ) { return array( 'method' => 'popup', 'minutes' => $m ); }, $mins ) ) );
		}
		// repetição (só vale para evento novo ou evento que ainda não se repete)
		$rule = mr_g_rrule( (string) ( $p['repeat'] ?? '' ), $date );
		if ( $rule ) {
			$ev['recurrence'] = array( $rule );
		}
		// convidados: o app só manda a lista quando ela mudou
		if ( isset( $p['guests'] ) && is_array( $p['guests'] ) ) {
			$ev['attendees'] = array();
			foreach ( array_slice( $p['guests'], 0, 50 ) as $g ) {
				$g = sanitize_email( (string) $g );
				if ( $g && is_email( $g ) ) {
					$ev['attendees'][] = array( 'email' => $g );
				}
			}
			$query['sendUpdates'] = ! empty( $p['notify'] ) ? 'all' : 'none';
		}
		// Google Meet
		if ( ! empty( $p['meet'] ) ) {
			$ev['conferenceData'] = array( 'createRequest' => array( 'requestId' => wp_generate_password( 16, false ), 'conferenceSolutionKey' => array( 'type' => 'hangoutsMeet' ) ) );
			$query['conferenceDataVersion'] = 1;
		}
	}
	$id = (string) ( $p['id'] ?? '' );
	if ( 'ponte' === mr_g_mode() ) {
		if ( $id ) {
			// a ponte troca a descrição inteira do evento e não sabe qual era: editar fica pelo Google
			return mr_g_err( 'Para mudar este evento, abra na Google Agenda.', 400 );
		}
		$desc = trim( ( $ev['location'] ? '📍 ' . $ev['location'] . "\n" : '' ) . $ev['description'] );
		$r    = mr_g_bridge( 'upsert', array( 'cal' => $cal, 'id' => '', 'titulo' => $title, 'descricao' => $desc, 'data' => $date, 'hora' => isset( $ev['start']['date'] ) ? '' : $t1 ) );
		return is_wp_error( $r ) ? mr_g_err( $r ) : new WP_REST_Response( array( 'ok' => true, 'id' => $r['id'] ?? '' ), 200 );
	}
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
		? mr_g_api( 'PATCH', '/calendars/' . rawurlencode( $cal ) . '/events/' . rawurlencode( $id ), $query, $ev )
		: mr_g_api( 'POST', '/calendars/' . rawurlencode( $cal ) . '/events', $query, $ev );
	return is_wp_error( $r ) ? mr_g_err( $r ) : new WP_REST_Response( array( 'ok' => true, 'id' => $r['id'] ?? $id, 'meet' => (string) ( $r['hangoutLink'] ?? '' ) ), 200 );
}
function mr_g_event_del( WP_REST_Request $req ) {
	$cal = (string) $req->get_param( 'cal' );
	$id  = (string) $req->get_param( 'id' );
	if ( ! $id || ! mr_g_cal_ok( $cal, true ) ) {
		return mr_g_err( 'Esse evento não pode ser apagado pelo app.', 403 );
	}
	$r = 'ponte' === mr_g_mode()
		? mr_g_bridge( 'remove', array( 'cal' => $cal, 'id' => $id ) )
		: mr_g_api( 'DELETE', '/calendars/' . rawurlencode( $cal ) . '/events/' . rawurlencode( $id ) );
	return is_wp_error( $r ) ? mr_g_err( $r ) : new WP_REST_Response( array( 'ok' => true ), 200 );
}
function mr_g_disconnect() {
	$uid = get_current_user_id();
	if ( 'ponte' === mr_g_mode() ) {
		return mr_g_err( 'Esta ligação é a do Recontar Gestão. Para desligar, use a página Agenda de lá.', 400 );
	}
	if ( 'script' === mr_g_mode() ) {
		mr_g_gas_unpair();
		return new WP_REST_Response( array( 'connected' => false ), 200 );
	}
	$rt  = get_user_meta( $uid, 'minha_rotina_gtoken', true );
	if ( $rt ) {
		wp_remote_post( MR_GOOGLE_REVOKE, array( 'timeout' => 10, 'body' => array( 'token' => $rt ) ) );
	}
	delete_user_meta( $uid, 'minha_rotina_gtoken' );
	delete_transient( 'mr_gat_' . $uid );
	delete_transient( 'mr_gcals_' . $uid );
	return new WP_REST_Response( array( 'connected' => false ), 200 );
}

/** eventos pela ponte do Recontar Gestão, no mesmo formato da API */
function mr_g_bridge_events( $cals, $sel, $tmin, $tmax, $zone ) {
	$r = mr_g_bridge( 'events', array( 'de' => $tmin, 'ate' => $tmax, 'ids' => array_values( $sel ) ) );
	if ( is_wp_error( $r ) ) {
		return mr_g_err( $r );
	}
	$by = array();
	foreach ( $cals as $c ) {
		$by[ $c['id'] ] = $c;
	}
	$items = array_values( array_filter( (array) ( $r['events'] ?? array() ), function ( $e ) use ( $sel, $by ) {
		return is_array( $e ) && isset( $e['cal'], $e['id'], $e['inicio'], $by[ $e['cal'] ] ) && in_array( $e['cal'], $sel, true );
	} ) );
	// evento que se repete: na ponte, todas as vezes têm o mesmo id; pelo login do Google, o id termina com a data
	$seen = array_count_values( array_map( function ( $e ) {
		return $e['cal'] . '|' . $e['id'];
	}, $items ) );
	$out = array();
	foreach ( $items as $e ) {
		try {
			$s = new DateTime( $e['inicio'] );
			$f = new DateTime( $e['fim'] ?? $e['inicio'] );
		} catch ( Exception $ex ) {
			continue;
		}
		$s->setTimezone( $zone );
		$f->setTimezone( $zone );
		$all = ! empty( $e['dia_todo'] );
		$sd  = $s->format( 'Y-m-d' );
		if ( $all ) {
			$f->modify( '-1 day' ); // fim exclusivo
			$ed = max( $sd, $f->format( 'Y-m-d' ) );
		} else {
			$ed = $f->format( 'Y-m-d' );
		}
		$c   = $by[ $e['cal'] ];
		$rec = $seen[ $e['cal'] . '|' . $e['id'] ] > 1 || preg_match( '/_\d{8}(T\d{6}Z)?$/', (string) $e['id'] );
		$out[] = array(
			'id' => (string) $e['id'], 'cal' => $c['id'], 'calName' => $c['name'], 'color' => ! empty( $e['cor'] ) ? $e['cor'] : $c['color'],
			'edit' => false, 'del' => $c['write'] && ! $rec,
			'title' => (string) ( $e['titulo'] ?? '' ) !== '' ? (string) $e['titulo'] : '(sem título)', 'date' => $sd, 'endDate' => $ed,
			'time' => $all ? '' : $s->format( 'H:i' ), 'end' => $all ? '' : $f->format( 'H:i' ), 'allDay' => $all,
			'location' => (string) ( $e['local'] ?? '' ), 'notes' => '', 'recurring' => (bool) $rec,
		);
	}
	return new WP_REST_Response( array( 'events' => $out, 'at' => (int) round( microtime( true ) * 1000 ) ), 200 );
}

/* ---------- painel: ponte própria (Apps Script) ---------- */
add_action( 'admin_post_mr_gas', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Sem permissão', 403 );
	}
	check_admin_referer( 'mr_gas' );
	if ( ! empty( $_POST['desligar'] ) ) {
		mr_g_gas_unpair();
		wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=saved#google' ) );
		exit;
	}
	$r = mr_g_gas_pair( isset( $_POST['gas_url'] ) ? esc_url_raw( wp_unslash( $_POST['gas_url'] ) ) : '' );
	if ( is_wp_error( $r ) ) {
		set_transient( 'mr_gas_err_' . get_current_user_id(), $r->get_error_message(), 300 );
		wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=gaserr#google' ) );
		exit;
	}
	wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=gasok#google' ) );
	exit;
} );
function mr_gas_admin_section() {
	$on  = mr_g_script_ready();
	$err = get_transient( 'mr_gas_err_' . get_current_user_id() );
	if ( $err ) {
		delete_transient( 'mr_gas_err_' . get_current_user_id() );
	}
	?>
	<h3 id="google-script">Ponte própria do Minha Rotina (Apps Script) — recomendada</h3>
	<?php if ( $on ) : ?>
		<p><span style="color:#15803d">✓ Ligada</span><?php echo get_option( MR_OPT_GASEMAIL ) ? ' na conta <b>' . esc_html( get_option( MR_OPT_GASEMAIL ) ) . '</b>' : ''; ?>.
			O app usa todos os campos da Google Agenda: início e fim, dia inteiro, repetição, local, notificações, cor, Google Meet, convidados e descrição.</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('Desligar a ponte? O app volta a usar a ligação do Recontar Gestão (se houver).');">
			<?php wp_nonce_field( 'mr_gas' ); ?><input type="hidden" name="action" value="mr_gas"><input type="hidden" name="desligar" value="1">
			<p><button class="button button-link-delete">Desligar a ponte</button></p>
		</form>
	<?php else : ?>
		<?php if ( $err ) : ?><div class="notice notice-error inline"><p><?php echo esc_html( $err ); ?></p></div><?php endif; ?>
		<p>Grátis e sem Google Cloud. Dá ao app todos os campos da Google Agenda (início e fim, repetição, notificações, cor, Meet, convidados). Uns 5 minutos, uma vez só:</p>
		<ol>
			<li>Entre em <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com</a> logada na conta da sua agenda. Abre um projeto novo: dê o nome <b>Minha Rotina — Agenda</b>.</li>
			<li>Apague o que estiver no editor e cole o código abaixo. Salve.</li>
			<li>Na lateral, em <b>Serviços</b> (+), escolha <b>Google Calendar API</b> e clique em <b>Adicionar</b>.</li>
			<li>Escolha a função <b>autorizar</b> no topo e clique em <b>Executar</b>. Permita o acesso (se aparecer “app não verificado”: <b>Avançado → Acessar</b>; é o seu próprio script).</li>
			<li><b>Implantar → Nova implantação</b> → tipo <b>App da Web</b>: executar como <b>Eu</b>, quem pode acessar <b>Qualquer pessoa</b>. Copie o <b>URL do app da Web</b> (termina em <code>/exec</code>) e cole abaixo.</li>
		</ol>
		<p><textarea readonly class="large-text code" rows="8" id="mr-gas-code" onclick="this.select()"><?php echo esc_textarea( mr_g_script_code() ); ?></textarea>
			<button type="button" class="button" onclick="var t=document.getElementById('mr-gas-code');t.select();navigator.clipboard?navigator.clipboard.writeText(t.value):document.execCommand('copy');this.textContent='Copiado ✓'">Copiar código</button></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<?php wp_nonce_field( 'mr_gas' ); ?><input type="hidden" name="action" value="mr_gas">
			<p><label>URL do app da Web<br><input type="url" class="large-text" name="gas_url" placeholder="https://script.google.com/macros/s/…/exec" required></label></p>
			<p><button class="button button-primary">Ligar</button></p>
		</form>
	<?php endif; ?>
	<?php
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
	$id     = get_option( MR_OPT_GCLIENT );
	$has    = (bool) get_option( MR_OPT_GSECRET );
	$bridge = mr_g_bridge_ready();
	$cfg    = $bridge && method_exists( 'RCG_Google', 'cfg' ) ? RCG_Google::cfg() : array();
	?>
	<h2 id="google">📅 Google Agenda</h2>
	<?php mr_gas_admin_section(); ?>
	<h3>Outras formas</h3>
	<?php if ( $bridge ) : ?>
		<p><span style="color:#15803d">✓ Ligação do Recontar Gestão encontrada.</span> Sem a ponte própria acima, o app usa a mesma ligação com o Google do <b>Recontar Gestão</b><?php echo ! empty( $cfg['email'] ) ? ' (conta <b>' . esc_html( $cfg['email'] ) . '</b>)' : ''; ?>.
			No app, abra <b>Agenda</b> e marque as agendas que quer ver.</p>
		<p class="description">Por essa ligação o app mostra os eventos, cria eventos novos (com horário, ficam com 30 minutos) e apaga eventos. Para mudar um evento que já existe, use a Google Agenda.</p>
		<details><summary>Outra forma: ligação própria pelo Google Cloud (opcional)</summary>
	<?php else : ?>
		<p>Se o plugin <b>Recontar Gestão</b> estiver ligado ao Google, o app usa essa ligação e não precisa de nada aqui. Sem ele, crie uma ligação gratuita no Google (uma vez só):</p>
	<?php endif; ?>
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
	<?php echo $bridge ? '</details>' : ''; ?>
	<?php
}
