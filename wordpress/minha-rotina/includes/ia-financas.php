<?php
/**
 * IA das finanças: recebe texto, fotos e arquivos do app e devolve lançamentos prontos para conferir.
 * Usa o SDK oficial da Anthropic (pasta vendor/) e a chave guardada no WordPress.
 */
defined( 'ABSPATH' ) || exit;

function mr_ai_models() {
	return array(
		'claude-opus-5-5'   => 'Claude Opus 5.5 (mais inteligente — recomendado)',
		'claude-sonnet-5-5' => 'Claude Sonnet 5.5 (mais rápido e mais barato)',
		'claude-haiku-5-5'  => 'Claude Haiku 5.5 (o mais barato)',
	);
}
function mr_ai_model() {
	$m = get_option( MR_OPT_AI_MODEL, 'claude-opus-5-5' );
	return isset( mr_ai_models()[ $m ] ) ? $m : 'claude-opus-5-5';
}
function mr_ai_sdk_ok() {
	return PHP_VERSION_ID >= 80100 && file_exists( MR_DIR . 'vendor/autoload.php' );
}
function mr_ai_ready() {
	return (bool) get_option( MR_OPT_AI_KEY ) && mr_ai_sdk_ok();
}
/** cliente da API (só carrega o SDK quando a IA é usada) */
function mr_ai_client() {
	require_once MR_DIR . 'vendor/autoload.php';
	$base = defined( 'MR_AI_BASE_URL' ) ? MR_AI_BASE_URL : null; // só para testes
	return new \Anthropic\Client( apiKey: (string) get_option( MR_OPT_AI_KEY ), baseUrl: $base );
}

/* ------------------------------------------------------------------ */
/* Endereço: POST /wp-json/minha-rotina/v1/financas-ia                 */
/* ------------------------------------------------------------------ */
add_action( 'rest_api_init', function () {
	register_rest_route( 'minha-rotina/v1', '/financas-ia', array(
		'methods'             => 'POST',
		'callback'            => 'mr_ai_finance',
		'permission_callback' => 'mr_can_access',
	) );
} );

/** categoria "Outros" do tipo certo (ou a última desse tipo) */
function mr_ai_other_cat( $cats, $kind ) {
	$same = array_values( array_filter( $cats, fn( $c ) => $c['kind'] === $kind ) );
	foreach ( $same as $c ) {
		if ( preg_match( '/outr/i', $c['name'] ) ) {
			return $c['id'];
		}
	}
	return $same ? end( $same )['id'] : '';
}

function mr_ai_error( $msg, $status = 400 ) {
	return new WP_REST_Response( array( 'message' => $msg ), $status );
}

const MR_AI_SYSTEM = <<<'TXT'
Você é a assistente financeira do app "Minha Rotina". Sua tarefa é transformar o que a usuária enviar (mensagem escrita, foto de cupom fiscal, nota, comprovante, boleto, fatura, print de extrato, PDF ou arquivo de extrato CSV/OFX) em lançamentos financeiros.

Regras:
- Cada compra, pagamento, conta ou recebimento distinto vira um lançamento. Em cupom ou nota fiscal, use o VALOR TOTAL pago (um lançamento só), não cada item. Em extrato, um lançamento por linha de movimentação; ignore saldos, totais e transferências entre contas da própria usuária quando isso estiver claro.
- kind: "despesa" para gastos/saídas/contas; "receita" para salário, vendas, recebimentos, reembolsos e entradas.
- amount: número positivo em reais, com ponto decimal (ex.: 1234.56). Nunca negativo.
- date: data do gasto/recebimento no formato AAAA-MM-DD. Use a data do documento quando houver; se a mensagem disser "hoje", "ontem", "dia 5" etc., calcule a partir da data de hoje informada (dia sem mês = mês atual). Sem nenhuma pista, use a data de hoje.
- status: "pendente" para boleto ou conta ainda não paga, fatura a vencer, ou algo "a receber"; "pago" para o que já aconteceu.
- due: vencimento no formato AAAA-MM-DD quando houver (obrigatório para "pendente"); senão, string vazia.
- cat: escolha SEMPRE o id da categoria mais adequada da lista enviada, respeitando o tipo (categorias de despesa para despesas, de receita para receitas). Na dúvida, a categoria "Outros"/"Outras" do tipo certo.
- desc: descrição curta e clara em português (ex.: "Mercado Extra", "Conta de luz", "Salário"), sem valor.
- note: detalhe útil curto (ex.: "3x de 50,00 — parcela 1", "pago no Pix") ou string vazia.
- Parcelamento: lance só a parcela do mês, a menos que a usuária peça todas.
- Se algo estiver ilegível ou ambíguo, faça a melhor estimativa e explique em "message". Não invente lançamentos que não estão no conteúdo.
- message: 1 ou 2 frases curtas, simpáticas, em português, resumindo o que foi encontrado (ex.: "Encontrei 3 gastos e 1 conta a pagar. Confira antes de salvar 💜"). Se não houver nada financeiro, entries vazio e explique.
TXT;

function mr_ai_finance( WP_REST_Request $req ) {
	if ( ! mr_ai_ready() ) {
		return mr_ai_error( mr_ai_sdk_ok() ? 'A chave da IA não foi configurada no WordPress.' : 'A IA precisa de PHP 8.1 ou mais novo na hospedagem.', 503 );
	}
	$p = $req->get_json_params();
	if ( ! is_array( $p ) ) {
		return mr_ai_error( 'Pedido inválido.' );
	}
	$text  = isset( $p['text'] ) ? mb_substr( (string) $p['text'], 0, 20000 ) : '';
	$today = isset( $p['today'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $p['today'] ) ? $p['today'] : wp_date( 'Y-m-d' );

	// categorias da usuária (o id é o que a IA precisa devolver)
	$cats = array();
	foreach ( (array) ( $p['categories'] ?? array() ) as $c ) {
		$id = isset( $c['id'] ) ? preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $c['id'] ) : '';
		if ( $id && isset( $c['name'], $c['kind'] ) && in_array( $c['kind'], array( 'despesa', 'receita' ), true ) ) {
			$cats[ $id ] = array( 'id' => $id, 'name' => mb_substr( sanitize_text_field( $c['name'] ), 0, 60 ), 'kind' => $c['kind'] );
		}
	}
	if ( ! $cats ) {
		return mr_ai_error( 'Nenhuma categoria enviada.' );
	}

	// anexos: fotos, PDFs e arquivos de texto (CSV, OFX, TXT)
	$content = array();
	$files   = array_slice( (array) ( $p['files'] ?? array() ), 0, 8 );
	foreach ( $files as $f ) {
		$name = isset( $f['name'] ) ? sanitize_file_name( (string) $f['name'] ) : 'arquivo';
		$kind = $f['kind'] ?? '';
		if ( 'image' === $kind || 'pdf' === $kind ) {
			$data = (string) ( $f['data'] ?? '' );
			$raw  = base64_decode( $data, true );
			if ( false === $raw || strlen( $raw ) > 20 * 1024 * 1024 ) {
				return mr_ai_error( "Não consegui ler o arquivo {$name}." );
			}
			if ( 'image' === $kind ) {
				$mt = in_array( $f['media_type'] ?? '', array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ), true ) ? $f['media_type'] : 'image/jpeg';
				$content[] = array( 'type' => 'image', 'source' => array( 'type' => 'base64', 'mediaType' => $mt, 'data' => $data ) );
			} else {
				$content[] = array( 'type' => 'document', 'source' => array( 'type' => 'base64', 'mediaType' => 'application/pdf', 'data' => $data ) );
			}
		} elseif ( 'text' === $kind ) {
			$content[] = array( 'type' => 'text', 'text' => "Arquivo \"{$name}\":\n" . mb_substr( (string) ( $f['text'] ?? '' ), 0, 150000 ) );
		}
	}
	if ( '' === trim( $text ) && ! $content ) {
		return mr_ai_error( 'Escreva algo ou anexe uma foto/arquivo.' );
	}

	$lista     = implode( "\n", array_map( fn( $c ) => "- {$c['id']}: {$c['name']} ({$c['kind']})", array_values( $cats ) ) );
	$content[] = array(
		'type' => 'text',
		'text' => "Hoje é {$today}.\n\nCategorias disponíveis (id: nome (tipo)):\n{$lista}\n\nMensagem da usuária:\n" . ( '' !== trim( $text ) ? $text : '(sem mensagem — use os anexos acima)' ),
	);

	$schema = array(
		'type'                 => 'object',
		'properties'           => array(
			'entries' => array(
				'type'  => 'array',
				'items' => array(
					'type'                 => 'object',
					'properties'           => array(
						'kind'   => array( 'type' => 'string', 'enum' => array( 'despesa', 'receita' ) ),
						'amount' => array( 'type' => 'number' ),
						'desc'   => array( 'type' => 'string' ),
						'date'   => array( 'type' => 'string' ),
						'cat'    => array( 'type' => 'string', 'enum' => array_keys( $cats ) ),
						'status' => array( 'type' => 'string', 'enum' => array( 'pago', 'pendente' ) ),
						'due'    => array( 'type' => 'string' ),
						'note'   => array( 'type' => 'string' ),
					),
					'required'             => array( 'kind', 'amount', 'desc', 'date', 'cat', 'status', 'due', 'note' ),
					'additionalProperties' => false,
				),
			),
			'message' => array( 'type' => 'string' ),
		),
		'required'             => array( 'entries', 'message' ),
		'additionalProperties' => false,
	);

	if ( function_exists( 'set_time_limit' ) ) {
		@set_time_limit( 180 ); // phpcs:ignore -- leitura de fotos/PDF pode levar mais de 30s
	}

	try {
		$msg = mr_ai_client()->beta->messages->create(
			model: mr_ai_model(),
			maxTokens: 16000,
			system: MR_AI_SYSTEM,
			messages: array( array( 'role' => 'user', 'content' => $content ) ),
			outputConfig: array( 'format' => array( 'type' => 'json_schema', 'schema' => $schema ) ),
			betas: array( 'server-side-fallback-2026-07-01' ),
			fallbacks: 'default',
		);
	} catch ( \Anthropic\Core\Exceptions\AuthenticationException $e ) {
		return mr_ai_error( 'A chave da IA é inválida. Confira no painel do WordPress.', 502 );
	} catch ( \Anthropic\Core\Exceptions\RateLimitException $e ) {
		return mr_ai_error( 'Muitos pedidos seguidos. Espere um minuto e tente de novo.', 429 );
	} catch ( \Anthropic\Core\Exceptions\APIStatusException $e ) {
		$type = $e->type?->value ?? '';
		if ( 'overloaded_error' === $type ) {
			return mr_ai_error( 'A IA está sobrecarregada agora. Tente de novo em instantes.', 503 );
		}
		if ( false !== stripos( $e->getMessage(), 'credit' ) ) {
			return mr_ai_error( 'Sem créditos na conta da Anthropic. Adicione créditos para continuar usando a IA.', 402 );
		}
		return mr_ai_error( 'A IA recusou o pedido (' . ( $type ?: 'erro' ) . '). Tente com outra foto ou arquivo.', 502 );
	} catch ( \Throwable $e ) {
		return mr_ai_error( 'Não foi possível falar com a IA: ' . mb_substr( $e->getMessage(), 0, 160 ), 502 );
	}

	if ( 'refusal' === $msg->stopReason ) {
		return mr_ai_error( 'A IA não conseguiu processar esse conteúdo. Tente descrever por texto.', 422 );
	}
	$json = '';
	foreach ( $msg->content as $block ) {
		if ( 'text' === $block->type ) {
			$json .= $block->text;
		}
	}
	$data = json_decode( $json, true );
	if ( ! is_array( $data ) || ! isset( $data['entries'] ) ) {
		return mr_ai_error( 'A resposta da IA veio incompleta. Tente de novo.', 502 );
	}
	// confere o que veio antes de devolver ao app
	$out = array();
	foreach ( (array) $data['entries'] as $e ) {
		$amount = round( abs( (float) ( $e['amount'] ?? 0 ) ), 2 );
		if ( $amount <= 0 ) {
			continue;
		}
		$kind = 'receita' === ( $e['kind'] ?? '' ) ? 'receita' : 'despesa';
		$cat  = isset( $cats[ $e['cat'] ?? '' ] ) && $cats[ $e['cat'] ]['kind'] === $kind ? $e['cat'] : mr_ai_other_cat( $cats, $kind );
		$date = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $e['date'] ?? '' ) ) ? $e['date'] : $today;
		$due  = preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) ( $e['due'] ?? '' ) ) ? $e['due'] : '';
		$out[] = array(
			'kind'   => $kind,
			'amount' => $amount,
			'desc'   => mb_substr( sanitize_text_field( (string) ( $e['desc'] ?? '' ) ), 0, 80 ),
			'date'   => $date,
			'cat'    => $cat,
			'status' => 'pendente' === ( $e['status'] ?? '' ) ? 'pendente' : 'pago',
			'due'    => $due,
			'note'   => mb_substr( sanitize_text_field( (string) ( $e['note'] ?? '' ) ), 0, 160 ),
		);
	}
	return new WP_REST_Response( array( 'entries' => $out, 'message' => mb_substr( sanitize_text_field( (string) ( $data['message'] ?? '' ) ), 0, 300 ) ), 200 );
}

/* ------------------------------------------------------------------ */
/* Painel: chave, modelo e teste                                       */
/* ------------------------------------------------------------------ */
function mr_ai_admin_section() {
	$key = (string) get_option( MR_OPT_AI_KEY );
	?>
	<h2>✨ Inteligência artificial (Finanças)</h2>
	<p>A IA lê o que você escreve, fotos de cupons/boletos e arquivos (PDF, extrato CSV/OFX) e prepara os lançamentos para você conferir.
		Ela usa o Claude, da Anthropic. Para funcionar, crie uma chave de API em <strong>console.anthropic.com</strong> → <em>API Keys</em> e coloque abaixo.
		A cobrança é feita pela Anthropic por uso (centavos por lançamento, mais com fotos e PDFs grandes).</p>
	<?php if ( ! mr_ai_sdk_ok() ) : ?>
		<div class="notice notice-warning inline"><p>A IA precisa de <strong>PHP 8.1 ou mais novo</strong>. Sua hospedagem está com PHP <?php echo esc_html( PHP_VERSION ); ?>. O resto do app funciona normalmente.</p></div>
	<?php endif; ?>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<?php wp_nonce_field( 'mr_ai' ); ?>
		<input type="hidden" name="action" value="mr_ai_save">
		<table class="form-table" role="presentation">
			<tr><th scope="row"><label for="mr_ai_key">Chave da API</label></th>
				<td><input type="password" id="mr_ai_key" name="chave" class="regular-text" autocomplete="off" placeholder="<?php echo $key ? esc_attr( 'Guardada (termina em ' . substr( $key, -4 ) . ') — deixe em branco para manter' ) : 'sk-ant-...'; ?>">
					<p class="description">Fica guardada só no WordPress. Nunca é enviada para o navegador nem aparece no app.</p></td></tr>
			<tr><th scope="row"><label for="mr_ai_model">Modelo</label></th>
				<td><select id="mr_ai_model" name="modelo"><?php foreach ( mr_ai_models() as $id => $label ) : ?>
					<option value="<?php echo esc_attr( $id ); ?>" <?php selected( mr_ai_model(), $id ); ?>><?php echo esc_html( $label ); ?></option>
				<?php endforeach; ?></select></td></tr>
		</table>
		<p><button class="button button-primary">Salvar IA</button>
			<?php if ( $key ) : ?><button class="button" name="testar" value="1">Salvar e testar</button>
			<button class="button button-link-delete" name="apagar" value="1" onclick="return confirm('Apagar a chave da IA?');">Apagar chave</button><?php endif; ?></p>
	</form>
	<p class="description">Ao usar a IA, o texto, as fotos e os arquivos que você enviar vão para a Anthropic para serem lidos. Nada é enviado sem você tocar em "Enviar para a IA".</p>
	<?php
}

add_action( 'admin_post_mr_ai_save', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'Sem permissão', 403 );
	}
	check_admin_referer( 'mr_ai' );
	if ( ! empty( $_POST['apagar'] ) ) {
		delete_option( MR_OPT_AI_KEY );
		wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=ia_salva' ) );
		exit;
	}
	$key = isset( $_POST['chave'] ) ? trim( sanitize_text_field( wp_unslash( $_POST['chave'] ) ) ) : '';
	if ( '' !== $key ) {
		update_option( MR_OPT_AI_KEY, $key, false );
	}
	$model = isset( $_POST['modelo'] ) ? sanitize_text_field( wp_unslash( $_POST['modelo'] ) ) : '';
	if ( isset( mr_ai_models()[ $model ] ) ) {
		update_option( MR_OPT_AI_MODEL, $model, false );
	}
	$msg = 'ia_salva';
	$err = '';
	if ( ! empty( $_POST['testar'] ) || '' !== $key ) {
		if ( ! mr_ai_sdk_ok() ) {
			$msg = 'ia_erro';
			$err = 'precisa de PHP 8.1 ou mais novo';
		} else {
			try {
				$r = mr_ai_client()->messages->create(
					model: mr_ai_model(),
					maxTokens: 300,
					messages: array( array( 'role' => 'user', 'content' => 'Responda apenas: OK' ) ),
				);
				$msg = 'ia_ok';
			} catch ( \Anthropic\Core\Exceptions\AuthenticationException $e ) {
				$msg = 'ia_erro';
				$err = 'chave inválida';
			} catch ( \Throwable $e ) {
				$msg = 'ia_erro';
				$err = mb_substr( $e->getMessage(), 0, 120 );
			}
		}
	}
	wp_safe_redirect( admin_url( 'admin.php?page=minha-rotina&mr_msg=' . $msg . ( $err ? '&mr_err=' . rawurlencode( $err ) : '' ) ) );
	exit;
} );
