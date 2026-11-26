<?php
// Ao excluir o plugin, apaga o backup e as configurações guardadas no WordPress.
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;
delete_option( 'minha_rotina_backup' );
delete_option( 'minha_rotina_backup_stamp' );
delete_option( 'minha_rotina_acesso' );
delete_option( 'minha_rotina_ia_chave' );
delete_option( 'minha_rotina_ia_modelo' );
delete_metadata( 'user', 0, 'minha_rotina_dados', '', true );
delete_metadata( 'user', 0, 'minha_rotina_dados_em', '', true );
delete_metadata( 'user', 0, 'minha_rotina_ical', '', true );
delete_metadata( 'user', 0, 'minha_rotina_gtoken', '', true );
delete_metadata( 'user', 0, 'minha_rotina_gsel', '', true );
delete_option( 'minha_rotina_google_client' );
delete_option( 'minha_rotina_google_secret' );
delete_option( 'minha_rotina_gas_url' );
delete_option( 'minha_rotina_gas_token' );
delete_option( 'minha_rotina_gas_email' );
