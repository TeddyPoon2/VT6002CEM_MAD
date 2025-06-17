const express = require('express');
const bodyParser = require('body-parser');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth"); // Import Firebase Auth
const { db } = require('./firebase'); // Import Firestore instance
const { collection, doc, setDoc, getDoc } = require("firebase/firestore");
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-admin.json');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Initialize Firebase Auth
const auth = getAuth();

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: serviceAccount.databaseURL,
});

// User login (or account creation if not found)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    // Attempt to log in the user
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    res.status(200).json({ success: true, token, uid: userCredential.user.uid });
  } catch (error) {
    // Handle specific errors
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      try {
        // Automatically register the user if login fails due to non-existent credentials
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        res.status(201).json({
          success: true,
          message: 'Account created and login successful!',
          token,
          uid: userCredential.user.uid,
        });
      } catch (registrationError) {
        console.error('Error during registration:', registrationError);
        let errorMessage;
        switch (registrationError.code) {
          case 'auth/invalid-email':
            errorMessage = 'Invalid email. Please check your email and try again.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Weak password. Please use a stronger password.';
            break;
          case 'auth/email-already-in-use':
            errorMessage = 'Email already in use. Please use a different email.';
            break;
          default:
            errorMessage = 'Registration failed. Please try again.';
        }
        res.status(500).json({ success: false, message: errorMessage });
      }
    } else {
      // Handle other login errors
      console.error('Error during login:', error);
      let errorMessage;
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        default:
          errorMessage = 'Login failed. Please try again.';
      }
      res.status(401).json({ success: false, message: errorMessage });
    }
  }
});

// Middleware to verify Firebase token
async function verifyToken(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ success: false, message: 'Missing Authorization header' });
  const token = header.split(' ')[1];
  
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    console.error('Token verification error:', err);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Backup endpoint: save expenses/accounts for user
app.post('/backup', verifyToken, async (req, res) => {
  const { expenses, accounts } = req.body;
  const uid = req.uid;
  try {
    await setDoc(doc(collection(db, 'backups'), uid), { expenses, accounts, updatedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Backup successful' });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, message: 'Backup failed' });
  }
});

// Restore endpoint: get expenses/accounts for user
app.get('/restore', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const docSnap = await getDoc(doc(collection(db, 'backups'), uid));
    if (!docSnap.exists()) return res.status(404).json({ success: false, message: 'No backup found' });
    const data = docSnap.data();
    res.json({ success: true, expenses: data.expenses || [], accounts: data.accounts || [], updatedAt: data.updatedAt });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ success: false, message: 'Restore failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});