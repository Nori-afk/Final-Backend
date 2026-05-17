<?php
/* Simple Pet API
   GET    /backend/pet.php?user_id=...    - list pets by owner
   GET    /backend/pet.php?id=...         - get single pet
   POST   /backend/pet.php                - create pet (body JSON)
   PATCH  /backend/pet.php?id=...         - update pet
   DELETE /backend/pet.php?id=...         - delete pet
*/
require_once 'connection.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$TEST_MODE = true;

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET': handle_get(); break;
        case 'POST': handle_post(); break;
        case 'PATCH': handle_patch(); break;
        case 'DELETE': handle_delete(); break;
        default: http_response_code(405); echo json_encode(['error'=>'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
}

function handle_get() {
    $id = $_GET['id'] ?? null;
    $user_id = $_GET['user_id'] ?? null;
    if ($id) {
        $stmt = db()->prepare('SELECT * FROM pet_table WHERE Pet_ID = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        echo json_encode(['success'=>true,'pet'=>$row]);
        return;
    }
    if ($user_id) {
        $stmt = db()->prepare('SELECT * FROM pet_table WHERE user_ID = ? ORDER BY Pet_name');
        $stmt->execute([$user_id]);
        $rows = $stmt->fetchAll();
        echo json_encode(['success'=>true,'pets'=>$rows]);
        return;
    }
    // list all (admin)
    $rows = db()->query('SELECT * FROM pet_table ORDER BY Pet_ID DESC')->fetchAll();
    echo json_encode(['success'=>true,'pets'=>$rows]);
}

function handle_post() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { http_response_code(422); echo json_encode(['error'=>'Invalid body']); return; }
    $user_ID = $body['user_ID'] ?? null;
    $Pet_name = $body['Pet_name'] ?? null;
    $Pet_type = $body['Pet_type'] ?? null;
    if (!$user_ID || !$Pet_name || !$Pet_type) { http_response_code(422); echo json_encode(['error'=>'user_ID, Pet_name and Pet_type are required']); return; }

    $stmt = db()->prepare('INSERT INTO pet_table (user_ID, Pet_name, Pet_type, Pet_breed, Pet_Age, Pet_weight, pet_sex, pet_Markings, Pet_description, recent_visit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $user_ID,
        $Pet_name,
        $Pet_type,
        $body['Pet_breed'] ?? null,
        $body['Pet_Age'] ?? null,
        $body['Pet_weight'] ?? null,
        $body['pet_sex'] ?? 'Unknown',
        $body['pet_Markings'] ?? null,
        $body['Pet_description'] ?? null,
        $body['recent_visit'] ?? null,
    ]);
    echo json_encode(['success'=>true,'Pet_ID'=>db()->lastInsertId()]);
}

function handle_patch() {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(422); echo json_encode(['error'=>'id required']); return; }
    $body = json_decode(file_get_contents('php://input'), true);
    $fields = [];
    $values = [];
    $allowed = ['Pet_name','Pet_type','Pet_breed','Pet_Age','Pet_weight','pet_sex','pet_Markings','Pet_description','recent_visit'];
    foreach ($allowed as $f) {
        if (isset($body[$f])) { $fields[] = "$f = ?"; $values[] = $body[$f]; }
    }
    if (empty($fields)) { echo json_encode(['success'=>true]); return; }
    $values[] = $id;
    $sql = 'UPDATE pet_table SET '.implode(', ',$fields).' WHERE Pet_ID = ?';
    $stmt = db()->prepare($sql); $stmt->execute($values);
    echo json_encode(['success'=>true]);
}

function handle_delete() {
    $id = $_GET['id'] ?? null;
    if (!$id) { http_response_code(422); echo json_encode(['error'=>'id required']); return; }
    db()->prepare('DELETE FROM pet_table WHERE Pet_ID = ?')->execute([$id]);
    echo json_encode(['success'=>true]);
}

?>
