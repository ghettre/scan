import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Request Google Sheets and Drive File scopes
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope("https://www.googleapis.com/auth/spreadsheets");
googleAuthProvider.addScope("https://www.googleapis.com/auth/drive.file");
googleAuthProvider.addScope("https://www.googleapis.com/auth/drive.metadata.readonly");

// Google OAuth token storage that persists across page refreshes for robust spreadsheet syncing
let cachedAccessToken: string | null = localStorage.getItem("billflow_google_token");
let isSigningIn = false;

// Initialize Auth listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // In a real OAuth POPUP flow, the cachedAccessToken is set within googleSignIn.
      // If we refresh, we need the user to re-sign in to obtain a fresh Google Auth token.
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Attempt to check if we can reuse, or fallback
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Main sign-in with Google Auth popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve the Google Access Token from Authentication POPUP.");
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem("billflow_google_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Google Authentication sign-in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve token
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Explicitly set cached token (e.g., if loaded)
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Logout
export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem("billflow_google_token");
};
