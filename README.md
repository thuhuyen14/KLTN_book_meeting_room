# Meeting Room Booking - Full Demo
This project includes a multi-page frontend (Bootstrap) and a Node.js Express backend with SQLite.

## Run locally
1. Install Node.js (>=14)
2. In project folder, run:
   ```bash
   npm install
   npm start
   ```
3. Open browser: http://localhost:3000

## Notes
- DB file `booking.db` will be created automatically.
- APIs:
  - GET /api/rooms
  - GET /api/bookings?room_id=&date=
  - POST /api/book  {room_id, title, organizer, start_iso, end_iso}
  - DELETE /api/bookings/:id
- This is a demo. For production: add authentication, input sanitization, CSRF protection, file upload handling, and validations.
