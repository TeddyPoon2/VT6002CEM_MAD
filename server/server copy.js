const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const { db } = require('./firebase'); // Import Firestore database instance from firebase.js
const { collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc } = require("firebase/firestore");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth"); // Import Firebase Auth

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Initialize Firebase Auth
const auth = getAuth();

// Get all tasks
app.get('/tasks', async (req, res) => {
  try {
    const tasksCollection = collection(db, 'tasks');
    const tasksSnapshot = await getDocs(tasksCollection);
    const tasks = tasksSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).send("Failed to fetch tasks.");
  }
});

// Get a specific task by ID
app.get('/tasks/:id', async (req, res) => {
  try {
    const taskRef = doc(db, 'tasks', req.params.id);
    const taskDoc = await getDoc(taskRef);

    if (taskDoc.exists()) {
      res.json({ id: taskDoc.id, ...taskDoc.data() });
    } else {
      res.status(404).send('Task not found');
    }
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).send("Failed to fetch task.");
  }
});

// Create a new task
app.post('/tasks', async (req, res) => {
  const { title, description, user } = req.body; // Include user in the request body
  const newTask = {
    title,
    description,
    user: user || "default_user", // Default to "default_user" if user is not provided
    createdAt: new Date().toISOString(),
    comments: [],
    commentCount: 0,
  };

  try {
    const tasksCollection = collection(db, 'tasks');
    const taskRef = await addDoc(tasksCollection, newTask);
    res.status(201).json({ id: taskRef.id, ...newTask });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).send("Failed to create task.");
  }
});

// Update a task by ID
app.put('/tasks/:id', async (req, res) => {
  try {
    const taskRef = doc(db, 'tasks', req.params.id);
    const taskDoc = await getDoc(taskRef);

    if (taskDoc.exists()) {
      await updateDoc(taskRef, req.body);
      res.json({ id: req.params.id, ...req.body });
    } else {
      res.status(404).send('Task not found');
    }
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).send("Failed to update task.");
  }
});

// Delete a task by ID
app.delete('/tasks/:id', async (req, res) => {
  try {
    const taskRef = doc(db, 'tasks', req.params.id);
    const taskDoc = await getDoc(taskRef);

    if (taskDoc.exists()) {
      await deleteDoc(taskRef);
      res.json({ id: req.params.id });
    } else {
      res.status(404).send('Task not found');
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).send("Failed to delete task.");
  }
});

// Get comments for a specific task
app.get('/tasks/:id/comments', async (req, res) => {
  try {
    const taskRef = doc(db, 'tasks', req.params.id);
    const taskDoc = await getDoc(taskRef);

    if (taskDoc.exists()) {
      res.json(taskDoc.data().comments || []);
    } else {
      res.status(404).send('Task not found');
    }
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).send("Failed to fetch comments.");
  }
});

// Add a comment to a specific task
app.post('/tasks/:id/comments', async (req, res) => {
  const { title, user } = req.body; // Include user in the request body
  const newComment = {
    id: uuidv4(),
    title,
    user: user || "default_user", // Default to "default_user" if user is not provided
    createdAt: new Date().toISOString(),
  };

  try {
    const taskRef = doc(db, 'tasks', req.params.id);
    const taskDoc = await getDoc(taskRef);
    if (taskDoc.exists()) {
      const taskData = taskDoc.data();
      const updatedComments = [...(taskData.comments || []), newComment];
      await updateDoc(taskRef, {
        comments: updatedComments,
        commentCount: (taskData.commentCount || 0) + 1,
      });

      res.status(201).json(newComment);
    } else {
      res.status(404).send('Task not found');
    }
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).send("Failed to add comment.");
  }
});

// Delete a comment from a specific task
app.delete('/tasks/:taskId/comments/:commentId', async (req, res) => {
  try {
    const taskRef = doc(db, 'tasks', req.params.taskId);
    const taskDoc = await getDoc(taskRef);

    if (taskDoc.exists()) {
      const taskData = taskDoc.data();
      const updatedComments = (taskData.comments || []).filter(
        (comment) => comment.id !== req.params.commentId
      );

      if (updatedComments.length < (taskData.comments || []).length) {
        await updateDoc(taskRef, {
          comments: updatedComments,
          commentCount: updatedComments.length,
        });

        res.json({ id: req.params.commentId });
      } else {
        res.status(404).send('Comment not found');
      }
    } else {
      res.status(404).send('Task not found');
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).send("Failed to delete comment.");
  }
});

// Login or Register Endpoint
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
