// Shared constants for the donation / supporter system.

// Admin account — gates the hidden admin tab and the "Unlimited" quota badge.
// Not a secret: the admin *panel password* (backend .env) is what protects
// admin actions; this only hides UI.
export const ADMIN_USN = 'JS240955';

// UPI destination for support payments (Support page + popup).
export const UPI_ID = 'msrikanthreddy107@oksbi';
