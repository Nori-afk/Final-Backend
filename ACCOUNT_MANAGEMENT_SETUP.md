# Account Management API Integration Setup

## What Was Done

Your admin account management page is now fully connected to your PHP backend.

### Backend API Created
**File:** `backend/admin-users.php`

Endpoints (all require Bearer token with admin role):
- `GET /backend/admin-users.php` - Get all users
- `POST /backend/admin-users.php` - Create new user
- `PATCH /backend/admin-users.php?id=...` - Update user
- `DELETE /backend/admin-users.php?id=...` - Delete user

### Frontend Updated
**File:** `admin/js/account-management.js`

All operations now use real API calls instead of mock data:
- ✅ Loads users from database on page load
- ✅ Create users via modal
- ✅ Edit user info
- ✅ Block/unblock users
- ✅ Delete users
- ✅ Verify/approve pending users
- ✅ Reject pending applications

## Before Testing

### 1. Make Sure Your Database Tables Exist
Required tables:
- `user_table` (with fields: user_id, Name_ID, Email, Password, Role_ID, Phone_number, Token, Token_expires, isBlocked, Isverfied_ID, created_at)
- `name_table` (Name_id, First_name, Last_name)
- `role_table` (Role_id, Role_name)
- `is_verified_table` (Isverfied_ID, verified)
- `barangay_masterlist` (barangay_id, barangay)

### 2. Login First
- Your admin page requires Bearer token from login
- The token must be stored in `sessionStorage.getItem('bvetter_token')`
- Make sure your login page saves the token after successful login

### 3. Test It
1. Login as admin
2. Go to admin/pages/account-management.html
3. Try creating, editing, and deleting users
4. Check browser console (F12) for any errors

## How It Works

1. **Authentication**: Uses Bearer token from `sessionStorage.bvetter_token`
2. **API Headers**: Automatically includes `Authorization: Bearer [token]`
3. **Error Handling**: Shows alerts if operations fail
4. **Real-time Updates**: Reloads user list after each operation

## API Request Examples

### Get All Users
```javascript
GET /backend/admin-users.php
Headers: {
  "Authorization": "Bearer [token]",
  "Content-Type": "application/json"
}
```

### Create User
```javascript
POST /backend/admin-users.php
Headers: { Authorization: "Bearer [token]", Content-Type: "application/json" }
Body: {
  "name": "Dr. John Doe",
  "email": "john@clinic.com",
  "role": "vet",
  "phone": "09123456789"
}
```

### Update User
```javascript
PATCH /backend/admin-users.php?id=123
Body: {
  "name": "Jane Doe",
  "email": "jane@clinic.com",
  "status": "active"
}
```

### Delete User
```javascript
DELETE /backend/admin-users.php?id=123
```

## Troubleshooting

**401 Unauthorized**: Token is missing or expired
- Make sure you're logged in
- Check that token is saved in sessionStorage

**403 Forbidden**: Not an admin
- Use an admin account to log in

**422 Validation Error**: Missing required fields
- Check that all required fields are provided

**500 Server Error**: Database issue
- Check PHP error logs in `php://input`
- Verify database tables exist and have correct structure

## Next Steps

- [ ] Verify database tables are correct
- [ ] Test login flow saves token
- [ ] Test user creation/editing/deletion
- [ ] Deploy to production (change API_BASE URL)
