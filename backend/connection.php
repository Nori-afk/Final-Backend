<?php

define('DB_HOST', 'localhost');
define('DB_NAME', 'vbetter');
define('DB_USER', 'root');       // TODO: change before deploy
define('DB_PASS', 'root');           // TODO: change before deploy
define('DB_CHARSET', 'utf8mb4');
#define is a type of variable holder that is constant and available anywhere, as long as it is php file
 
#this method will availble in all php file. it creates the connection between the database and the php file, you can 
#just call the function "DB" to use it.
function db(): PDO {
    static $pdo = null; #static means that the variable will remain null unless we created another connection
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
 
/* ── JSON Response Helper ─────────────────── */
function json_out(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');   // TODO: restrict to your domain in prod
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;
    echo json_encode($data);
    exit;
}
 
/* ── Auth Guard ───────────────────────────── */
function require_auth(): array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        json_out(['error' => 'Unauthorized'], 401);
    }
    $token = substr($header, 7);
    
    // Query the correct table and columns that match login.php
    $stmt  = db()->prepare('
        SELECT 
            u.user_id as id, 
            CONCAT(n.First_name, " ", n.Last_name) as full_name, 
            u.Email as email, 
            r.Role_name as role
        FROM user_table u
        JOIN name_table n ON u.Name_ID = n.Name_id
        JOIN role_table r ON u.Role_ID = r.Role_id
        WHERE u.Token = ? AND u.Token_expires > NOW()
    ');
    $stmt->execute([$token]);
    $user = $stmt->fetch();
    if (!$user) json_out(['error' => 'Invalid or expired token'], 401);
    return $user;
}
 
?>
