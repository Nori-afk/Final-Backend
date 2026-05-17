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
    if ($id) {
        $stmt = db()->prepare('SELECT * FROM lost_pet WHERE lost_ID = ?'); $stmt->execute([$id]); echo json_encode(['success'=>true,'lost'=>$stmt->fetch()]); return;
    }
    $rows = db()->query('SELECT * FROM lost_pet ORDER BY created_at DESC')->fetchAll();
    echo json_encode(['success'=>true,'lost_list'=>$rows]);
}

function handle_post() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { http_response_code(422); echo json_encode(['error'=>'Invalid body']); return; }
    $user_ID = $body['user_ID'] ?? null; $Date_lost = $body['Date_lost'] ?? null;
    if (!$user_ID || !$Date_lost) { http_response_code(422); echo json_encode(['error'=>'user_ID and Date_lost required']); return; }
    $stmt = db()->prepare('INSERT INTO lost_pet (user_ID, Date_lost, Pet_name, Pet_type, Sex, Address_Lost, Image, Marking, Description, Size, Breed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user_ID,$Date_lost,$body['Pet_name'] ?? null,$body['Pet_type'] ?? null,$body['Sex'] ?? 'Unknown',$body['Address_Lost'] ?? null,$body['Image'] ?? null,$body['Marking'] ?? null,$body['Description'] ?? null,$body['Size'] ?? null,$body['Breed'] ?? null]);
    echo json_encode(['success'=>true,'lost_ID'=>db()->lastInsertId()]);
}

function handle_patch() {
    $id = $_GET['id'] ?? null; if (!$id) { http_response_code(422); echo json_encode(['error'=>'id required']); return; }
    $body = json_decode(file_get_contents('php://input'), true);
    $updates=[]; $values=[];
    $allowed=['Pet_name','Pet_type','Sex','Address_Lost','Image','Marking','Description','Size','Breed','status'];
    foreach($allowed as $f) if(isset($body[$f])) { $updates[]="$f = ?"; $values[]=$body[$f]; }
    if(empty($updates)){ echo json_encode(['success'=>true]); return; }
    $values[]=$id; db()->prepare('UPDATE lost_pet SET '.implode(',',$updates).' WHERE lost_ID = ?')->execute($values);
    echo json_encode(['success'=>true]);
}

?>
