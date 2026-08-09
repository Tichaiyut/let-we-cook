<?php
/**
 * Let We Cook – PHP release
 *
 * Keep this file together with index.html, assets/, and avatars/ from the
 * php-release folder. Upload the whole folder to the same location on cpfrun.
 *
 * Required setup:
 * - Create Google Apps Script for the NEW Google Sheet and paste its /exec URL.
 * - Configure the Script to accept the API contract documented in PHP_HANDOFF.md.
 */

const SESSION_COOKIE = 'lwc_session';
const SESSION_SECONDS = 7200;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_SECONDS = 7200;

// --- Deployment configuration (edit these three values before upload) ---
$APPS_SCRIPT_URL = 'PASTE_NEW_APPS_SCRIPT_EXEC_URL_HERE';
$SHEET_API_SECRET = 'PASTE_A_SHARED_SECRET_HERE';
$SITE_PASSWORD_HASH = 'lEwFMyQrNjeIpG6uBbmCBp8XckAwyngK9gPUeLTUYek'; // SHA-256 of the shared password
$SESSION_SECRET = 'CHANGE_THIS_TO_A_LONG_RANDOM_DEPLOYMENT_SECRET';

function json_response($value, $status = 200, $headers = []) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    foreach ($headers as $name => $content) header($name . ': ' . $content);
    echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json() {
    $input = file_get_contents('php://input');
    $decoded = json_decode($input ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

function base64url($value) {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function sign_value($value, $secret) {
    return base64url(hash_hmac('sha256', $value, $secret, true));
}

function password_hash_value($value) {
    return base64url(hash('sha256', $value, true));
}

function is_https() {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function session_is_valid($secret) {
    $token = $_COOKIE[SESSION_COOKIE] ?? '';
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2 || !ctype_digit($parts[0]) || (int) $parts[0] <= time()) return false;
    return hash_equals(sign_value($parts[0], $secret), $parts[1]);
}

function issue_session($secret) {
    $expires = (string) (time() + SESSION_SECONDS);
    setcookie(SESSION_COOKIE, $expires . '.' . sign_value($expires, $secret), [
        'expires' => time() + SESSION_SECONDS,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function clear_session() {
    setcookie(SESSION_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Lax']);
}

function client_key($secret) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown-ip';
    $agent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown-agent', 0, 180);
    return sign_value($ip . '|' . $agent, $secret);
}

function update_login_state($callback) {
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'let_we_cook_login_attempts.json';
    $handle = fopen($path, 'c+');
    if (!$handle) return $callback([]);
    flock($handle, LOCK_EX);
    rewind($handle);
    $state = json_decode(stream_get_contents($handle) ?: '{}', true);
    if (!is_array($state)) $state = [];
    $result = $callback($state);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($state));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

function apps_script_request($url, $secret, $method, $payload = null) {
    if (strpos($url, 'script.google.com/macros/s/') === false) {
        json_response(['ok' => false, 'error' => 'Google Apps Script is not configured yet.'], 503);
    }
    if (!function_exists('curl_init')) {
        json_response(['ok' => false, 'error' => 'PHP cURL must be enabled on this server.'], 503);
    }

    if ($method === 'GET') {
        $separator = strpos($url, '?') === false ? '?' : '&';
        $url .= $separator . 'secret=' . rawurlencode($secret);
    }
    $request = curl_init($url);
    curl_setopt_array($request, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    if ($method === 'POST') {
        $payload['secret'] = $secret;
        curl_setopt($request, CURLOPT_POST, true);
        curl_setopt($request, CURLOPT_HTTPHEADER, ['Content-Type: application/json; charset=utf-8']);
        curl_setopt($request, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    $body = curl_exec($request);
    $error = curl_error($request);
    $status = (int) curl_getinfo($request, CURLINFO_HTTP_CODE);
    curl_close($request);
    if ($error || $body === false || $status >= 400) json_response(['ok' => false, 'error' => $error ?: 'Google Apps Script returned HTTP ' . $status], 502);
    $decoded = json_decode(trim(preg_replace('/^\xEF\xBB\xBF/', '', $body)), true);
    if (json_last_error() !== JSON_ERROR_NONE) json_response(['ok' => false, 'error' => 'Invalid response from Google Apps Script.'], 502);
    json_response($decoded, ($decoded['ok'] ?? true) === false ? 502 : 200);
}

// Browser API endpoints used by the React page.
if (isset($_GET['api'])) {
    $api = $_GET['api'];
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($api === 'session' && $method === 'GET') json_response(['authenticated' => session_is_valid($SESSION_SECRET)]);
    if ($api === 'logout' && $method === 'POST') { clear_session(); json_response(['authenticated' => false]); }
    if ($api === 'login' && $method === 'POST') {
        $now = time();
        $key = client_key($SESSION_SECRET);
        $attempt = update_login_state(function (&$state) use ($key) { return $state[$key] ?? null; });
        if ($attempt && (int) ($attempt['lockedUntil'] ?? 0) > $now) {
            $retry = (int) $attempt['lockedUntil'] - $now;
            json_response(['authenticated' => false, 'locked' => true, 'retryAfter' => $retry, 'error' => 'กรอกรหัสผิดครบ 5 ครั้ง กรุณารอ 2 ชั่วโมง'], 429, ['Retry-After' => $retry]);
        }
        $password = (string) (request_json()['password'] ?? '');
        if (!hash_equals($SITE_PASSWORD_HASH, password_hash_value($password))) {
            $failure = update_login_state(function (&$state) use ($key, $now) {
                $current = $state[$key] ?? [];
                $windowExpired = empty($current) || $now - (int) ($current['startedAt'] ?? 0) >= LOGIN_LOCK_SECONDS;
                $count = $windowExpired ? 1 : (int) ($current['count'] ?? 0) + 1;
                $lockedUntil = $count >= MAX_LOGIN_FAILURES ? $now + LOGIN_LOCK_SECONDS : 0;
                $state[$key] = ['count' => $count, 'startedAt' => $windowExpired ? $now : (int) $current['startedAt'], 'lockedUntil' => $lockedUntil];
                return $state[$key];
            });
            if ((int) $failure['lockedUntil'] > $now) json_response(['authenticated' => false, 'locked' => true, 'retryAfter' => LOGIN_LOCK_SECONDS, 'error' => 'กรอกรหัสผิดครบ 5 ครั้ง ระบบล็อกไว้ 2 ชั่วโมง'], 429, ['Retry-After' => LOGIN_LOCK_SECONDS]);
            json_response(['authenticated' => false, 'remaining' => max(0, MAX_LOGIN_FAILURES - (int) $failure['count']), 'error' => 'รหัสผ่านไม่ถูกต้อง'], 401);
        }
        update_login_state(function (&$state) use ($key) { unset($state[$key]); return null; });
        issue_session($SESSION_SECRET);
        json_response(['authenticated' => true]);
    }
    if (!session_is_valid($SESSION_SECRET)) json_response(['ok' => false, 'error' => 'Authentication required'], 401);
    if ($api === 'data' && $method === 'GET') apps_script_request($APPS_SCRIPT_URL, $SHEET_API_SECRET, 'GET');
    if ($api === 'action' && $method === 'POST') apps_script_request($APPS_SCRIPT_URL, $SHEET_API_SECRET, 'POST', request_json());
    json_response(['ok' => false, 'error' => 'Not found'], 404);
}

// Render the same production React application from the files next to this PHP file.
$index = @file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . 'index.html');
if ($index === false) {
    http_response_code(500);
    echo '<h1>Let We Cook files are incomplete.</h1><p>Upload tech_feed_todo.php together with index.html, assets/, and avatars/.</p>';
    exit;
}
$api_config = '<script>window.__LWC_ASSET_BASE=".";window.__LWC_PHP_API={data:"?api=data",action:"?api=action",login:"?api=login",session:"?api=session",logout:"?api=logout"};</script>';
echo str_replace('</head>', $api_config . '</head>', $index);
