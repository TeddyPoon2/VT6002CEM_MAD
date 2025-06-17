const express = require('express');
const bodyParser = require('body-parser');
// const fs = require('fs');
// const path = require('path');
// const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
// const { db } = require('./firebase'); // Import Firestore instance
// const { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc } = require("firebase/firestore");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth"); // Import Firebase Auth

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Initialize Firebase Auth
const auth = getAuth();

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});