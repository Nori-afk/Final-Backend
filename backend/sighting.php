<?php
require_once 'connection.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET': handle_get(); break;
        case 'POST': handle_post(); break;
        default: http_response_code(405); echo json_encode(['error'=>'Method not allowed']);
    }
} catch (Exception $e) { http_response_code(500); echo json_encode(['error'=>$e->getMessage()]); }

function handle_get() {
    $lost_id = $_GET['lost_id'] ?? null;
    if ($lost_id) { $stmt = db()->prepare('SELECT * FROM sighting_table WHERE lost_ID = ? ORDER BY created_at DESC'); $stmt->execute([$lost_id]); echo json_encode(['success'=>true,'sightings'=>$stmt->fetchAll()]); return; }
    $rows = db()->query('SELECT * FROM sighting_table ORDER BY created_at DESC')->fetchAll();
    echo json_encode(['success'=>true,'sightings'=>$rows]);
}

function handle_post() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { http_response_code(422); echo json_encode(['error'=>'Invalid body']); return; }
    $user_ID = $body['user_ID'] ?? null; $Date_sighted = $body['Date_sighted'] ?? null;
    if (!$user_ID || !$Date_sighted) { http_response_code(422); echo json_encode(['error'=>'user_ID and Date_sighted required']); return; }
    $stmt = db()->prepare('INSERT INTO sighting_table (user_ID, lost_ID, Date_sighted, time_sighted, location_sighted, description, Evidence, barangay, landmark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user_ID,$body['lost_ID'] ?? null,$Date_sighted,$body['time_sighted'] ?? null,$body['location_sighted'] ?? null,$body['description'] ?? null,$body['Evidence'] ?? null,$body['barangay'] ?? null,$body['landmark'] ?? null]);
    echo json_encode(['success'=>true,'Sighting_ID'=>db()->lastInsertId()]);
}

?>
