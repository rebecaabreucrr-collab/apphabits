<?php
// Ao excluir o plugin, apaga o backup e as configurações guardadas no WordPress.
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;
delete_option( 'minha_rotina_backup' );
delete_option( 'minha_rotina_backup_stamp' );
delete_option( 'minha_rotina_acesso' );
