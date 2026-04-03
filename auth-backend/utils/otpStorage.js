// OTP Storage - In-memory storage for OTP codes
// OTPs expire after 10 minutes

const otpStore = new Map(); // phone -> { code, expiresAt, attempts }

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5; // Maximum verification attempts

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP for a phone number
export function storeOTP(phone) {
  const code = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  
  otpStore.set(phone, {
    code,
    expiresAt,
    attempts: 0,
    createdAt: Date.now(),
  });
  
  // Clean up expired OTPs
  cleanupExpiredOTPs();
  
  return code;
}

// Verify OTP for a phone number
export function verifyOTP(phone, inputCode) {
  const stored = otpStore.get(phone);
  
  if (!stored) {
    return { valid: false, message: "OTP not found. Please request a new OTP." };
  }
  
  // Check if expired
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(phone);
    return { valid: false, message: "OTP has expired. Please request a new OTP." };
  }
  
  // If already verified, just check if code matches (don't increment attempts)
  if (stored.verified === true) {
    if (stored.code === inputCode) {
      return { valid: true, message: "OTP already verified." };
    } else {
      return { valid: false, message: "Invalid OTP code." };
    }
  }
  
  // Check attempts (only for unverified OTPs)
  if (stored.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { valid: false, message: "Too many failed attempts. Please request a new OTP." };
  }
  
  // Verify code
  if (stored.code !== inputCode) {
    stored.attempts += 1;
    const remaining = MAX_ATTEMPTS - stored.attempts;
    return { 
      valid: false, 
      message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` 
    };
  }
  
  // Valid OTP - mark as verified but don't delete yet (for password reset)
  stored.verified = true;
  stored.verifiedAt = Date.now();
  
  return { valid: true, message: "OTP verified successfully." };
}

// Check if OTP is verified for a phone number
export function isOTPVerified(phone) {
  const stored = otpStore.get(phone);
  return stored && stored.verified === true && Date.now() <= stored.expiresAt;
}

// Delete OTP after use
export function deleteOTP(phone) {
  otpStore.delete(phone);
}

// Get OTP info (for debugging)
export function getOTPInfo(phone) {
  const stored = otpStore.get(phone);
  if (!stored) return null;
  
  return {
    phone,
    expiresAt: new Date(stored.expiresAt),
    attempts: stored.attempts,
    verified: stored.verified || false,
    timeRemaining: Math.max(0, stored.expiresAt - Date.now()),
  };
}

// Clean up expired OTPs
function cleanupExpiredOTPs() {
  const now = Date.now();
  for (const [phone, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(phone);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

