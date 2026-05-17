<?php
require_once 'connection.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET': handle_get(); break;
        case 'POST': handle_post(); break;
        case 'PATCH': handle_patch(); break;
        default: http_response_code(405); echo json_encode(['error'=>'Method not allowed']);
    }
} catch (Exception $e) { http_response_code(500); echo json_encode(['error'=>$e->getMessage()]); }

function handle_get() {
    $id = $_GET['id'] ?? null;
    if ($id) { $stmt = db()->prepare('SELECT * FROM claim_table WHERE Claim_id = ?'); $stmt->execute([$id]); echo json_encode(['success'=>true,'claim'=>$stmt->fetch()]); return; }
    $rows = db()->query('SELECT * FROM claim_table ORDER BY Claim_date DESC')->fetchAll();
    echo json_encode(['success'=>true,'claims'=>$rows]);
}

function handle_post() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { http_response_code(422); echo json_encode(['error'=>'Invalid body']); return; }
    $User_id = $body['User_id'] ?? null; $found_ID = $body['found_ID'] ?? null;
    if (!$User_id || !$found_ID) { http_response_code(422); echo json_encode(['error'=>'User_id and found_ID required']); return; }
    $stmt = db()->prepare('INSERT INTO claim_table (User_id, found_ID, proof_of_ownership) VALUES (?, ?, ?)');
    $stmt->execute([$User_id,$found_ID,$body['proof_of_ownership'] ?? null]);
    echo json_encode(['success'=>true,'Claim_id'=>db()->lastInsertId()]);
}

function handle_patch() {
    $id = $_GET['id'] ?? null; if (!$id) { http_response_code(422); echo json_encode(['error'=>'id required']); return; }
    $body = json_decode(file_get_contents('php://input'), true);
    $updates=[]; $values=[];
    $allowed=['Claim_Status','proof_of_ownership'];
    foreach($allowed as $f) if(isset($body[$f])) { $updates[]="$f = ?"; $values[]=$body[$f]; }
    if(empty($updates)){ echo json_encode(['success'=>true]); return; }
    $values[]=$id; db()->prepare('UPDATE claim_table SET '.implode(',',$updates).' WHERE Claim_id = ?')->execute($values);
    echo json_encode(['success'=>true]);
}

?>
