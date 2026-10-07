<?php

ini_set('display_errors', '0');
error_reporting(E_ALL);

function getRequestId(): string
{
    static $requestId = null;
    if ($requestId !== null) {
        return $requestId;
    }

    try {
        $requestId = bin2hex(random_bytes(8));
    } catch (Throwable $error) {
        $requestId = uniqid('req_', true);
    }

    return $requestId;
}

function loadLocalConfig(): array
{
    static $localConfig = null;
    if ($localConfig !== null) {
        return $localConfig;
    }

    $configPath = __DIR__ . '/config.local.php';
    if (!is_file($configPath)) {
        $localConfig = [];
        return $localConfig;
    }

    $loaded = require $configPath;
    $localConfig = is_array($loaded) ? $loaded : [];
    return $localConfig;
}

function getConfigValue(string $key, $default = '')
{
    $localConfig = loadLocalConfig();
    if (array_key_exists($key, $localConfig) && $localConfig[$key] !== '' && $localConfig[$key] !== null) {
        return $localConfig[$key];
    }

    $envValue = getenv($key);
    if ($envValue !== false && $envValue !== '') {
        return $envValue;
    }

    return $default;
}

function normalizeOriginHost(string $value): string
{
    return strtolower(preg_replace('/:\d+$/', '', trim($value)) ?? '');
}

function isLoopbackHost(string $host): bool
{
    return in_array($host, ['localhost', '127.0.0.1', '::1', '[::1]'], true);
}

function isAllowedCorsOrigin(string $origin, array $allowedOrigins): bool
{
    if ($origin === '') {
        return false;
    }

    if (in_array($origin, $allowedOrigins, true)) {
        return true;
    }

    $parsedOrigin = parse_url($origin);
    if (!is_array($parsedOrigin)) {
        return false;
    }

    $originHost = normalizeOriginHost((string) ($parsedOrigin['host'] ?? ''));
    if ($originHost === '') {
        return false;
    }

    $requestHost = normalizeOriginHost((string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? ''));
    if ($requestHost === '') {
        return false;
    }

    if ($originHost === $requestHost) {
        return true;
    }

    return isLoopbackHost($originHost) && isLoopbackHost($requestHost);
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOriginsSource = getConfigValue('CORS_ORIGINS', '');
$allowedOrigins = is_array($allowedOriginsSource)
    ? array_filter(array_map('trim', $allowedOriginsSource))
    : array_filter(array_map('trim', explode(',', (string) $allowedOriginsSource)));

if (!empty($allowedOrigins)) {
    if ($origin && isAllowedCorsOrigin($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: {$origin}");
        header('Vary: Origin');
    } elseif ($origin) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Origen no permitido',
            'request_id' => getRequestId(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
} else {
    header('Access-Control-Allow-Origin: *');
}

header('X-Request-Id: ' . getRequestId());
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-API-KEY');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=UTF-8');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbConfig = [
    'host' => (string) getConfigValue('DB_HOST', ''),
    'port' => (string) getConfigValue('DB_PORT', '3306'),
    'name' => (string) getConfigValue('DB_NAME', ''),
    'user' => (string) getConfigValue('DB_USER', ''),
    'pass' => (string) getConfigValue('DB_PASS', ''),
    'charset' => 'utf8mb4',
];

$apiKey = (string) getConfigValue('API_KEY', '');

function logApiError(string $message, array $context = []): void
{
    $payload = array_merge([
        'request_id' => getRequestId(),
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'CLI',
        'uri' => $_SERVER['REQUEST_URI'] ?? '',
        'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ], $context);

    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        $encoded = '{"request_id":"' . getRequestId() . '"}';
    }

    error_log('[INVITARTE_API] ' . $message . ' | ' . $encoded);
}

function sendJson($data, int $code = 200): void
{
    if (is_array($data) && !array_key_exists('request_id', $data)) {
        $data['request_id'] = getRequestId();
    }

    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJsonInput(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        sendJson([
            'success' => false,
            'message' => 'JSON inválido',
        ], 400);
    }

    return $decoded;
}

function getRequestHeaderValue(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return $_SERVER[$key] ?? '';
}

function requireApiKey(): void
{
    global $apiKey;
    if ($apiKey === '') {
        return;
    }

    $headerKey = getRequestHeaderValue('X-API-KEY');
    $authorization = getRequestHeaderValue('Authorization');
    $bearer = '';
    if ($authorization && stripos($authorization, 'Bearer ') === 0) {
        $bearer = trim(substr($authorization, 7));
    }

    $provided = $headerKey !== '' ? $headerKey : $bearer;
    if ($provided === '' || !hash_equals($apiKey, $provided)) {
        sendJson([
            'success' => false,
            'message' => 'No autorizado',
        ], 401);
    }
}

function isRetriableDatabaseConnectionError(PDOException $error): bool
{
    $message = strtolower($error->getMessage());

    return strpos($message, '[2002]') !== false
        || strpos($message, 'timed out') !== false
        || strpos($message, 'tiempo de espera') !== false
        || strpos($message, 'no ha podido responder') !== false
        || strpos($message, 'connection refused') !== false;
}

function getDbConnection(): PDO
{
    global $dbConfig;

    $requiredKeys = ['host', 'name', 'user'];
    foreach ($requiredKeys as $key) {
        if (trim((string) ($dbConfig[$key] ?? '')) === '') {
            logApiError('Database configuration missing', ['missing_key' => $key]);
            throw new RuntimeException('Configuración de base de datos incompleta.');
        }
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $dbConfig['host'],
        $dbConfig['port'],
        $dbConfig['name'],
        $dbConfig['charset']
    );

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ];

    $attempts = 3;
    $lastError = null;

    for ($attempt = 1; $attempt <= $attempts; $attempt += 1) {
        try {
            return new PDO($dsn, $dbConfig['user'], $dbConfig['pass'], $options);
        } catch (PDOException $error) {
            $lastError = $error;

            logApiError('Database connection error', [
                'message' => $error->getMessage(),
                'attempt' => $attempt,
                'attempts' => $attempts,
            ]);

            if ($attempt >= $attempts || !isRetriableDatabaseConnectionError($error)) {
                throw $error;
            }

            usleep($attempt * 250000);
        }
    }

    throw $lastError ?? new RuntimeException('No pudimos establecer la conexión con la base de datos.');
}

function isSafeSqlIdentifier(string $identifier): bool
{
    return preg_match('/^[A-Za-z0-9_]+$/', $identifier) === 1;
}

function dbTableExists(PDO $pdo, string $table): bool
{
    if (!isSafeSqlIdentifier($table)) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1'
    );
    $stmt->execute([$table]);
    return $stmt->fetchColumn() !== false;
}

function dbColumnExists(PDO $pdo, string $table, string $column): bool
{
    if (!isSafeSqlIdentifier($table) || !isSafeSqlIdentifier($column)) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1'
    );
    $stmt->execute([$table, $column]);
    return $stmt->fetchColumn() !== false;
}

function dbIndexExists(PDO $pdo, string $table, string $index): bool
{
    if (!isSafeSqlIdentifier($table) || !isSafeSqlIdentifier($index)) {
        return false;
    }

    $stmt = $pdo->prepare(
        'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1'
    );
    $stmt->execute([$table, $index]);
    return $stmt->fetchColumn() !== false;
}

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    logApiError('PHP runtime warning', [
        'severity' => $severity,
        'message' => $message,
        'file' => $file,
        'line' => $line,
    ]);

    return false;
});

set_exception_handler(function (Throwable $error): void {
    logApiError('Uncaught exception', [
        'message' => $error->getMessage(),
        'file' => $error->getFile(),
        'line' => $error->getLine(),
    ]);

    if (!headers_sent()) {
        sendJson([
            'success' => false,
            'message' => 'Error interno del servidor',
        ], 500);
    }
});

register_shutdown_function(function (): void {
    $error = error_get_last();
    if ($error === null) {
        return;
    }

    if (!in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }

    logApiError('Fatal PHP error', [
        'message' => $error['message'] ?? '',
        'file' => $error['file'] ?? '',
        'line' => $error['line'] ?? 0,
        'type' => $error['type'] ?? 0,
    ]);

    if (!headers_sent()) {
        sendJson([
            'success' => false,
            'message' => 'Error interno del servidor',
        ], 500);
    }
});
