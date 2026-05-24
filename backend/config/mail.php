<?php

return [

    'default' => env('MAIL_MAILER', 'log'),

    'password_reset_transport' => env(
        'PASSWORD_RESET_TRANSPORT',
        env('BREVO_API_KEY') ? 'brevo_api' : 'mail'
    ),

    'password_reset_log_fallback' => (bool) env('PASSWORD_RESET_LOG_FALLBACK', false),

    'password_reset_expose_link' => (bool) env('PASSWORD_RESET_EXPOSE_LINK', false),

    'brevo' => [
        'api_key' => env('BREVO_API_KEY'),
        'endpoint' => env('BREVO_API_ENDPOINT', 'https://api.brevo.com/v3/smtp/email'),
        'timeout' => (int) env('BREVO_API_TIMEOUT', 15),
    ],

    'mailers' => [
        'smtp' => [
            'transport' => 'smtp',
            'host' => env('MAIL_HOST', '127.0.0.1'),
            'port' => env('MAIL_PORT', 2525),
            'encryption' => env('MAIL_ENCRYPTION'),
            'username' => env('MAIL_USERNAME'),
            'password' => env('MAIL_PASSWORD'),
            'timeout' => null,
            'local_domain' => env('MAIL_EHLO_DOMAIN'),
        ],

        'log' => [
            'transport' => 'log',
            'channel' => env('MAIL_LOG_CHANNEL'),
        ],
    ],

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
        'name' => env('MAIL_FROM_NAME', 'KerjaNusa'),
    ],

];
