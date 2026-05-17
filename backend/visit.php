<?php
/* Visit records API
   POST   /backend/visit.php        - create visit (vet/admin)
   GET    /backend/visit.php?pet_id - list visits by pet
*/
require_once 'connection.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

$TEST_MODE = true;

try {
    switch ($_SERVER['REQUEST_METHOD']) {
        case 'GET': handle_get(); break;
        case 'POST': handle_post(); break;
        default: http_response_code(405); echo json_encode(['error'=>'Method not allowed']);
    }
} catch (Exception $e) { http_response_code(500); echo json_encode(['error'=>$e->getMessage()]); }

function handle_get() {
    $pet_id = $_GET['pet_id'] ?? null;
    if (!$pet_id) { http_response_code(422); echo json_encode(['error'=>'pet_id required']); return; }
    $stmt = db()->prepare('SELECT * FROM visit_table WHERE Pet_ID = ? ORDER BY visit_date DESC');
    $stmt->execute([$pet_id]);
    echo json_encode(['success'=>true,'visits'=>$stmt->fetchAll()]);
}

function handle_post() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { http_response_code(422); echo json_encode(['error'=>'Invalid body']); return; }
    $Pet_ID = $body['Pet_ID'] ?? null;
    $User_ID_vet = $body['User_ID_vet'] ?? null;
    $visit_date = $body['visit_date'] ?? null;
    if (!$Pet_ID || !$User_ID_vet || !$visit_date) { http_response_code(422); echo json_encode(['error'=>'Pet_ID, User_ID_vet and visit_date are required']); return; }

    $stmt = db()->prepare('INSERT INTO visit_table (Pet_ID, User_ID_vet, appointment_ID, Case_ID, visit_date, follow_up_date, symptoms, treatment_provided, medication, visit_time, Vaccination_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $Pet_ID,
        $User_ID_vet,
        $body['appointment_ID'] ?? null,
        $body['Case_ID'] ?? null,
        $visit_date,
        $body['follow_up_date'] ?? null,
        $body['symptoms'] ?? null,
        $body['treatment_provided'] ?? null,
        $body['medication'] ?? null,
        $body['visit_time'] ?? null,
        $body['Vaccination_status'] ?? null,
    ]);
    echo json_encode(['success'=>true,'Visit_ID'=>db()->lastInsertId()]);
}

?>
