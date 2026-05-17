<?php
/* =============================================
   BVETTER — Barangays List
   File: backend/barangays.php

   GET /backend/barangays.php
   Returns all barangays from barangay_masterlist
   Used by signup dropdown.

   No auth required — public endpoint.
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'connection.php';

try {
    $rows = db()->query("
        SELECT barangay_id, barangay
        FROM barangay_masterlist
        ORDER BY barangay ASC
    ")->fetchAll();

    echo json_encode([
        'success'   => true,
        'barangays' => $rows
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not load barangays']);
}