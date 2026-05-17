<?php
/* =============================================
   BVETTER — Availability API
   File: backend/availability.php

   GET /backend/availability.php?vet_id=X&date=2025-06-15
     → returns which time slots are booked
       so the frontend can mark them as unavailable

   Returns:
   {
     success: true,
     date: "2025-06-15",
     vet_id: 1,
     booked_slots: ["09:00", "14:00"],
     all_slots: [
       { time: "08:00", label: "8:00 AM",  available: true },
       { time: "09:00", label: "9:00 AM",  available: false },
       ...
     ]
   }
   ============================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once 'connection.php';

// ── All possible time slots ───────────────────
// Must match the slot-btn values in book-appointment.html
$ALL_SLOTS = [
    ['time' => '08:00', 'label' => '8:00 AM'],
    ['time' => '09:00', 'label' => '9:00 AM'],
    ['time' => '10:00', 'label' => '10:00 AM'],
    ['time' => '11:00', 'label' => '11:00 AM'],
    ['time' => '13:00', 'label' => '1:00 PM'],
    ['time' => '14:00', 'label' => '2:00 PM'],
    ['time' => '15:00', 'label' => '3:00 PM'],
    ['time' => '16:00', 'label' => '4:00 PM'],
];

try {
    $vet_id = (int)($_GET['vet_id'] ?? 0);
    $date   = trim($_GET['date']   ?? '');

    if (!$vet_id || !$date) {
        http_response_code(422);
        echo json_encode(['error' => 'vet_id and date are required']);
        exit;
    }

    // validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        http_response_code(422);
        echo json_encode(['error' => 'date must be YYYY-MM-DD format']);
        exit;
    }

    // ── Get all confirmed/pending appointments for this vet on this date ──
    // Only confirmed + pending block slots. Cancelled/completed free up the slot.
    $stmt = db()->prepare("
        SELECT TIME_FORMAT(scheduled_time, '%H:%i') AS booked_time
        FROM appointment_table
        WHERE User_ID_vet    = ?
          AND scheduled_date = ?
          AND Status IN ('pending', 'confirmed')
    ");
    $stmt->execute([$vet_id, $date]);
    $booked_rows = $stmt->fetchAll();
    $booked_times = array_column($booked_rows, 'booked_time');

    // ── Build slot list with availability ────────
    $slots = array_map(function($slot) use ($booked_times) {
        return [
            'time'      => $slot['time'],
            'label'     => $slot['label'],
            'available' => !in_array($slot['time'], $booked_times),
        ];
    }, $ALL_SLOTS);

    echo json_encode([
        'success'      => true,
        'date'         => $date,
        'vet_id'       => $vet_id,
        'booked_slots' => $booked_times,
        'all_slots'    => $slots,
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}