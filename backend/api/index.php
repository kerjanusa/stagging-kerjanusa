<?php

declare(strict_types=1);

$storagePath = getenv('APP_STORAGE_PATH');

if (!is_string($storagePath) || $storagePath === '') {
    $storagePath = sys_get_temp_dir() . '/kerjanusa-storage';
}
$requiredDirectories = [
    $storagePath,
    $storagePath . '/app',
    $storagePath . '/framework',
    $storagePath . '/framework/cache',
    $storagePath . '/framework/cache/data',
    $storagePath . '/framework/sessions',
    $storagePath . '/framework/testing',
    $storagePath . '/framework/views',
    $storagePath . '/logs',
];

foreach ($requiredDirectories as $directory) {
    if (is_dir($directory)) {
        continue;
    }

    if (!mkdir($directory, 0777, true) && !is_dir($directory)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'message' => 'Failed to prepare writable storage path for the runtime environment.',
        ]);
        exit;
    }
}

putenv("APP_STORAGE_PATH={$storagePath}");
$_ENV['APP_STORAGE_PATH'] = $storagePath;
$_SERVER['APP_STORAGE_PATH'] = $storagePath;

require __DIR__ . '/../public/index.php';
