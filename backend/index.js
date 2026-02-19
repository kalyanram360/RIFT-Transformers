require("dotenv").config();
const express = require("express");
const app = express();

// Middleware
app.use(express.json());

// Routes
const userRoutes = require("./routes/userRoutes");
const dockerRoutes = require("./routes/dockerRoutes");
const testRunnerRoutes = require("./routes/testRunnerRoutes");
app.use("/api/users", userRoutes);
app.use("/api/docker", dockerRoutes);
app.use("/api/test-runner", testRunnerRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
