<?php

return [
    'state_ttl_seconds' => (int) env('OAUTH_STATE_TTL_SECONDS', 600),

    'google' => [
        'client_id' => env('GOOGLE_OAUTH_CLIENT_ID'),
        'client_secret' => env('GOOGLE_OAUTH_CLIENT_SECRET'),
        'redirect_uri' => env('GOOGLE_OAUTH_REDIRECT_URI'),
    ],

    'facebook' => [
        'client_id' => env('FACEBOOK_OAUTH_CLIENT_ID'),
        'client_secret' => env('FACEBOOK_OAUTH_CLIENT_SECRET'),
        'redirect_uri' => env('FACEBOOK_OAUTH_REDIRECT_URI'),
    ],
];
