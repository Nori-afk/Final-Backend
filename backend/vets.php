<?php
/* =============================================
   BVETTER — Vets API
   File: backend/vets.php

   GET /backend/vets.php
     → returns all verified vet staff accounts

   GET /backend/vets.php?id=X
     → returns single vet with full profile
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once 'connection.php';

try {
    $id = $_GET['id'] ?? null;

    if ($id) {
        // single vet
        $stmt = db()->prepare("
            SELECT
                u.user_id,
                n.First_name,
                n.Last_name,
                u.Email,
                u.Profile_image,
                u.ratings,
                a.barangay
            FROM user_table u
            JOIN name_table    n ON u.Name_ID    = n.Name_id
            JOIN role_table    r ON u.Role_ID    = r.Role_id
            LEFT JOIN address_table a ON u.Address_ID = a.Address_ID
            WHERE u.user_id = ?
              AND r.Role_name = 'veterinarian'
              AND u.isBlocked = 0
        ");
        $stmt->execute([$id]);
        $vet = $stmt->fetch();

        if (!$vet) {
            http_response_code(404);
            echo json_encode(['error' => 'Vet not found']);
            exit;
        }

        echo json_encode(['success' => true, 'vet' => format_vet($vet)]);
        exit;
    }

    // all vets
    $rows = db()->query("
        SELECT
            u.user_id,
            n.First_name,
            n.Last_name,
            u.Email,
            u.Profile_image,
            u.ratings,
            a.barangay
        FROM user_table u
        JOIN name_table    n ON u.Name_ID    = n.Name_id
        JOIN role_table    r ON u.Role_ID    = r.Role_id
        LEFT JOIN address_table a ON u.Address_ID = a.Address_ID
        WHERE r.Role_name = 'veterinarian'
          AND u.isBlocked = 0
        ORDER BY n.Last_name ASC
    ")->fetchAll();

    echo json_encode([
        'success' => true,
        'vets'    => array_map('format_vet', $rows),
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function format_vet(array $v): array {
    $name = $v['First_name'] . ' ' . $v['Last_name'];
    // initials for avatar fallback
    $initials = strtoupper(substr($v['First_name'], 0, 1) . substr($v['Last_name'], 0, 1));

    return [
        'id'            => (int)$v['user_id'],
        'name'          => $name,
        'initials'      => $initials,
        'email'         => $v['Email'],
        'profile_image' => $v['Profile_image']
            ? 'http://localhost/withbackend/BVETTER-MAIN/' . $v['Profile_image']
            : null,
        'rating'        => $v['ratings'] ?? '4.5',
        'barangay'      => $v['barangay'] ?? 'Baliwag Vet Clinic',
        // static fields — update these in DB or add columns later
        'title'         => 'Veterinarian',
        'specialty'     => 'General Veterinary Care',
    ];
}